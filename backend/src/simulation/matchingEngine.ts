/**
 * EV Matching Engine: Matches EV models to routes and fleet vehicles
 */

import {
  Route, EVModel, Scenario, FleetVehicle, FeasibilityStatus, EVMatchResult, VehicleSegment,
} from '../../../shared/types';

import { classifyTour } from './feasibilityEngine';
import {
  calculateAdjustedConsumption,
  calculateAnnualEnergy,
  calculateGridEnergy,
  calculateElectricityCost,
  calculateEvCO2e,
  buildConsumptionFactors,
} from './evCalculator';
import {
  calculateAnnualFuelCost,
  calculateAnnualIceCO2e,
  annualizeCapex,
  DEFAULT_LIFETIME_YEARS,
  DEFAULT_DIESEL_PRICE,
  DEFAULT_DIESEL_EMISSION_FACTOR,
} from './iceCalculator';

// Segment compatibility map: ICE segment → compatible EV segments
const SEGMENT_COMPATIBILITY: Record<string, VehicleSegment[]> = {
  small_van: [VehicleSegment.SMALL_VAN, VehicleSegment.MEDIUM_VAN],
  medium_van: [VehicleSegment.MEDIUM_VAN, VehicleSegment.LARGE_VAN],
  large_van: [VehicleSegment.LARGE_VAN],
  light_truck: [VehicleSegment.LIGHT_TRUCK, VehicleSegment.LARGE_VAN],
  medium_truck: [VehicleSegment.MEDIUM_TRUCK],
  heavy_truck: [VehicleSegment.HEAVY_TRUCK],
  car: [VehicleSegment.CAR, VehicleSegment.SMALL_VAN],
  minibus: [VehicleSegment.MINIBUS],
};

/**
 * Filter EV models compatible with a given vehicle segment
 */
export function getCompatibleEVModels(segment: VehicleSegment, evModels: EVModel[]): EVModel[] {
  const compatibleSegments = SEGMENT_COMPATIBILITY[segment] || [segment];
  return evModels.filter(ev => compatibleSegments.includes(ev.segment) && ev.is_active);
}

/**
 * Calculate match score for an EV model against a route or vehicle
 * Returns normalized score 0-100 for different criteria
 */
function scoreEVModel(
  ev: EVModel,
  vehicle: FleetVehicle,
  route: Route | null,
  scenario: Scenario,
  feasibilityStatus: FeasibilityStatus,
  ice_tco: number,
  ev_tco: number,
  ice_co2: number,
  ev_co2: number
): { smallest_battery: number; best_tco: number; best_co2: number; overall: number } {
  // Score: smallest_battery - prefer smallest battery that still works (efficiency)
  // Lower battery = higher score (more right-sized)
  const battery_score = feasibilityStatus !== FeasibilityStatus.NOT_FEASIBLE
    ? Math.max(0, 100 - ev.battery_usable_kwh)
    : 0;

  // Score: best_tco - prefer lower TCO
  const tco_savings = ice_tco - ev_tco;
  const tco_score = tco_savings > 0 ? Math.min(100, (tco_savings / ice_tco) * 200) : 0;

  // Score: best_co2 - prefer lower CO2
  const co2_savings = ice_co2 - ev_co2;
  const co2_score = co2_savings > 0 ? Math.min(100, (co2_savings / ice_co2) * 150) : 0;

  // Feasibility bonus
  const feasibility_bonus = feasibilityStatus === FeasibilityStatus.FEASIBLE ? 30
    : feasibilityStatus === FeasibilityStatus.FEASIBLE_WITH_CHARGING ? 15
    : -50;

  // Payload compatibility
  const payload_ok = !vehicle.payload_kg || !ev.payload_kg || ev.payload_kg >= vehicle.payload_kg * 0.9;
  const payload_bonus = payload_ok ? 10 : -20;

  // Overall weighted score
  const overall = Math.max(0,
    battery_score * 0.15
    + tco_score * 0.35
    + co2_score * 0.20
    + feasibility_bonus
    + payload_bonus
  );

  return {
    smallest_battery: Math.max(0, battery_score),
    best_tco: Math.max(0, tco_score),
    best_co2: Math.max(0, co2_score),
    overall: Math.min(100, overall),
  };
}

/**
 * Match EV models to a specific route
 */
export function matchEVsToRoute(
  route: Route,
  vehicle: FleetVehicle,
  evModels: EVModel[],
  scenario: Scenario
): EVMatchResult[] {
  const compatible = getCompatibleEVModels(vehicle.segment, evModels);
  const results: EVMatchResult[] = [];

  const ice_annual_fuel = calculateAnnualFuelCost(vehicle.annual_km, vehicle.consumption_l_100km, DEFAULT_DIESEL_PRICE);
  const ice_annual_co2_kg = calculateAnnualIceCO2e(vehicle.annual_km, vehicle.consumption_l_100km, DEFAULT_DIESEL_EMISSION_FACTOR);
  const ice_capex_annual = vehicle.capex ? annualizeCapex(vehicle.capex) : (vehicle.lease_monthly ?? 0) * 12;
  const ice_opex = ice_annual_fuel + vehicle.maintenance_cost_annual;
  const ice_tco = (ice_capex_annual + ice_opex) * DEFAULT_LIFETIME_YEARS;

  for (const ev of compatible) {
    const feasibilityResult = classifyTour(route, ev, scenario);
    const factors = buildConsumptionFactors(
      route.payload_kg, ev.payload_kg ?? 1000,
      route.outside_temperature_c, route.avg_speed_kmh, route.elevation_gain_m
    );
    const ec_adj = calculateAdjustedConsumption(ev.nominal_consumption_kwh_100km, factors);

    const annual_net_energy = calculateAnnualEnergy(vehicle.annual_km, ec_adj);
    const annual_grid_energy = calculateGridEnergy(annual_net_energy, scenario.charging_efficiency);
    const annual_elec_cost = calculateElectricityCost(annual_grid_energy, scenario.electricity_price);
    const annual_ev_co2_kg = calculateEvCO2e(annual_grid_energy, scenario.grid_emission_factor);

    const ev_maintenance = vehicle.maintenance_cost_annual * 0.6; // EV 40% lower maintenance
    const ev_opex = annual_elec_cost + ev_maintenance;
    const ev_capex_annual = ev.purchase_price ? annualizeCapex(ev.purchase_price) : (ev.lease_monthly ?? 0) * 12;
    const ev_tco = (ev_capex_annual + ev_opex) * DEFAULT_LIFETIME_YEARS;

    const scores = scoreEVModel(
      ev, vehicle, route, scenario,
      feasibilityResult.status,
      ice_tco, ev_tco,
      ice_annual_co2_kg, annual_ev_co2_kg
    );

    results.push({
      ev_model: ev,
      feasibility: feasibilityResult.status,
      score_smallest_battery: scores.smallest_battery,
      score_best_tco: scores.best_tco,
      score_best_co2: scores.best_co2,
      score_overall: scores.overall,
      adjusted_consumption: ec_adj,
      annual_ev_cost: ev_opex,
      tco_ev: ev_tco,
      co2e_ev_t: annual_ev_co2_kg / 1000,
    });
  }

  // Sort by overall score descending
  return results.sort((a, b) => b.score_overall - a.score_overall);
}

/**
 * Match EV models to a fleet vehicle (using typical route profile)
 */
export function matchEVsToFleetVehicle(
  vehicle: FleetVehicle,
  evModels: EVModel[],
  scenario: Scenario
): EVMatchResult[] {
  // Create synthetic route from vehicle annual_km / 250 working days
  const typical_daily_km = vehicle.annual_km / 250;
  const synthetic_route: Route = {
    id: 'synthetic',
    project_id: '',
    vehicle_id: vehicle.id,
    route_id: `synthetic_${vehicle.id}`,
    date: new Date().toISOString().split('T')[0],
    start_time: null,
    end_time: null,
    distance_km: typical_daily_km,
    stops: 3,
    dwell_time_min: 45,
    avg_speed_kmh: 55,
    payload_kg: vehicle.payload_kg ? vehicle.payload_kg * 0.6 : null,
    depot_id: null,
    start_location: null,
    end_location: null,
    elevation_gain_m: null,
    outside_temperature_c: 15,
    source_type: 'manual',
    consumption_l_100km: null,
    trips_per_year: null,
    vehicle_count: null,
  };

  return matchEVsToRoute(synthetic_route, vehicle, evModels, scenario);
}

/**
 * Get the best EV match for a vehicle
 */
export function getBestEVMatch(
  vehicle: FleetVehicle,
  evModels: EVModel[],
  scenario: Scenario
): EVMatchResult | null {
  const matches = matchEVsToFleetVehicle(vehicle, evModels, scenario);
  const feasibleMatches = matches.filter(m => m.feasibility !== FeasibilityStatus.NOT_FEASIBLE);
  return feasibleMatches.length > 0 ? feasibleMatches[0] : (matches.length > 0 ? matches[0] : null);
}
