/**
 * Feasibility Engine: Classifies tours/routes for EV electrification
 */

import {
  Route, EVModel, Scenario, FeasibilityStatus, FeasibilityResult, FleetFeasibilityResult,
} from '../../../shared/types';

import {
  calculateAdjustedConsumption,
  calculateEnergyPerTour,
  calculateSocAfterTour,
  checkFeasibilityWithoutCharging,
  checkFeasibilityWithCharging,
  buildConsumptionFactors,
} from './evCalculator';

/**
 * Classify a single tour for a given EV model and scenario
 */
export function classifyTour(route: Route, evModel: EVModel, scenario: Scenario): FeasibilityResult {
  const factors = buildConsumptionFactors(
    route.payload_kg,
    evModel.payload_kg ?? 1000,
    route.outside_temperature_c,
    route.avg_speed_kmh,
    route.elevation_gain_m,
    0,
    scenario.temperature_factor
  );

  const ec_adj = calculateAdjustedConsumption(evModel.nominal_consumption_kwh_100km, factors);
  const energy_kwh = calculateEnergyPerTour(route.distance_km, ec_adj);
  // Use soc_target as departure SOC (the vehicle charges to this level before leaving the depot).
  // soc_start is deprecated; soc_target is the single SOC configuration parameter.
  const departure_soc = scenario.soc_target ?? scenario.soc_start ?? 90;
  const soc_end = calculateSocAfterTour(departure_soc, energy_kwh, evModel.battery_usable_kwh);

  // Check without charging
  if (checkFeasibilityWithoutCharging(soc_end, scenario.soc_min)) {
    return {
      status: FeasibilityStatus.FEASIBLE,
      soc_after_tour: soc_end,
      energy_required_kwh: energy_kwh,
      charge_time_needed_min: 0,
      margin_kwh: ((soc_end - scenario.soc_min) / 100) * evModel.battery_usable_kwh,
    };
  }

  // Check with intermediate charging (only if charging is allowed)
  if (scenario.allow_public_charging || route.dwell_time_min > 0) {
    const chargingPower = Math.min(scenario.charging_power_kw, evModel.max_ac_kw);
    return checkFeasibilityWithCharging(
      soc_end,
      route.dwell_time_min,
      chargingPower,
      evModel.battery_usable_kwh,
      scenario.soc_min,
      scenario.charging_efficiency
    );
  }

  return {
    status: FeasibilityStatus.NOT_FEASIBLE,
    soc_after_tour: soc_end,
    energy_required_kwh: energy_kwh,
    charge_time_needed_min: 0,
    margin_kwh: ((soc_end - scenario.soc_min) / 100) * evModel.battery_usable_kwh,
  };
}

/**
 * Analyze entire fleet feasibility across all routes for a given EV model
 */
export function analyzeFleetFeasibility(
  routes: Route[],
  evModel: EVModel,
  scenario: Scenario
): FleetFeasibilityResult {
  let feasible = 0;
  let feasibleWithCharging = 0;
  let notFeasible = 0;

  const routeResults = routes.map(route => {
    const result = classifyTour(route, evModel, scenario);

    switch (result.status) {
      case FeasibilityStatus.FEASIBLE:
        feasible++;
        break;
      case FeasibilityStatus.FEASIBLE_WITH_CHARGING:
        feasibleWithCharging++;
        break;
      default:
        notFeasible++;
    }

    return {
      route_id: route.route_id,
      distance_km: route.distance_km,
      feasibility: result.status,
      energy_kwh: result.energy_required_kwh,
      margin_kwh: result.margin_kwh,
    };
  });

  const total = routes.length;
  const electrifiable = feasible + feasibleWithCharging;
  const feasibility_pct = total > 0 ? (electrifiable / total) * 100 : 0;

  return {
    total_routes: total,
    feasible,
    feasible_with_charging: feasibleWithCharging,
    not_feasible: notFeasible,
    feasibility_pct,
    route_results: routeResults as unknown as import('../../../shared/types').RouteResult[],
  };
}

/**
 * Calculate payload factor based on payload vs max payload
 */
export function calculatePayloadFactor(payload_kg: number | null, max_payload_kg: number): number {
  if (!payload_kg || max_payload_kg <= 0) return 1.0;
  const fraction = Math.min(payload_kg / max_payload_kg, 1.0);
  return 1.0 + 0.20 * fraction;
}

/**
 * Calculate temperature factor
 * Base: 20°C → 1.0
 * 0°C → ~1.25, -10°C → ~1.40, +35°C → ~1.10
 */
export function calculateTemperatureFactor(outside_temp_c: number | null): number {
  if (outside_temp_c === null) return 1.0;
  if (outside_temp_c < 0) {
    return 1.0 + Math.min(Math.abs(outside_temp_c) * 0.018, 0.50);
  }
  if (outside_temp_c > 25) {
    return 1.0 + Math.min((outside_temp_c - 25) * 0.004, 0.10);
  }
  return 1.0;
}

/**
 * Calculate speed factor
 */
export function calculateSpeedFactor(avg_speed_kmh: number | null): number {
  if (avg_speed_kmh === null) return 1.0;
  if (avg_speed_kmh < 40) return 1.05;
  if (avg_speed_kmh <= 80) return 1.0;
  // Highway: +3% per 10 km/h above 80
  return 1.0 + Math.min((avg_speed_kmh - 80) / 100 * 0.30, 0.35);
}

/**
 * Calculate terrain/elevation factor
 */
export function calculateTerrainFactor(elevation_gain_m: number | null): number {
  if (!elevation_gain_m || elevation_gain_m <= 0) return 1.0;
  return Math.min(1.0 + elevation_gain_m * 0.0001, 1.15);
}

/**
 * Calculate battery aging factor
 */
export function calculateAgingFactor(vehicle_age_years: number): number {
  return 1.0 + vehicle_age_years * 0.01;
}

/**
 * Get recommended minimum battery size for a route
 * Based on worst-case energy requirement + safety buffer
 */
export function getMinimumBatteryForRoute(
  route: Route,
  soc_start: number = 90,
  soc_min: number = 20,
  consumption_kwh_100km: number = 28,
  safety_margin: number = 1.15
): number {
  const usable_soc_fraction = (soc_start - soc_min) / 100;
  const energy_kwh = (route.distance_km / 100) * consumption_kwh_100km * safety_margin;
  const required_battery_kwh = energy_kwh / usable_soc_fraction;
  return required_battery_kwh;
}
