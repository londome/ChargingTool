/**
 * Ranking Engine: Identifies the best candidates for first electrification
 * Score weights: 35% feasibility, 20% range buffer, 20% TCO savings, 15% charging compat, 10% CO2
 */

import { Route, EVModel, Scenario, FleetVehicle, FeasibilityStatus, RankedCandidate } from '../../../shared/types';
import { classifyTour } from './feasibilityEngine';
import {
  calculateAdjustedConsumption,
  calculateEnergyPerTour,
  calculateSocAfterTour,
  buildConsumptionFactors,
  calculateAnnualEnergy,
  calculateGridEnergy,
  calculateElectricityCost,
  calculateEvCO2e,
} from './evCalculator';
import {
  calculateAnnualFuelCost,
  calculateAnnualIceCO2e,
  annualizeCapex,
  DEFAULT_DIESEL_PRICE,
  DEFAULT_DIESEL_EMISSION_FACTOR,
  DEFAULT_LIFETIME_YEARS,
} from './iceCalculator';
import { getBestEVMatch } from './matchingEngine';

/**
 * Calculate the "First to Electrify" composite score
 *
 * Score = 0.35 × S_feasibility
 *       + 0.20 × S_range_buffer
 *       + 0.20 × S_tco_savings
 *       + 0.15 × S_charging_compat
 *       + 0.10 × S_co2
 *
 * All sub-scores normalized 0-100
 */
export function calculateFirstToElectrifyScore(
  feasibilityStatus: FeasibilityStatus,
  range_buffer_kwh: number,
  tco_savings_eur: number,
  tco_ice: number,
  charging_compatible: boolean,
  co2_savings_pct: number
): number {
  // S_feasibility: 100 = fully feasible, 50 = with charging, 0 = not feasible
  const s_feasibility = feasibilityStatus === FeasibilityStatus.FEASIBLE ? 100
    : feasibilityStatus === FeasibilityStatus.FEASIBLE_WITH_CHARGING ? 50
    : 0;

  // S_range_buffer: range buffer as % of battery, capped at 50kWh
  const s_range_buffer = Math.min(100, Math.max(0, (range_buffer_kwh / 50) * 100));

  // S_tco_savings: TCO savings as % of ICE TCO
  const s_tco_savings = tco_ice > 0
    ? Math.min(100, Math.max(0, (tco_savings_eur / tco_ice) * 100 * 2))
    : 0;

  // S_charging_compat: bonus for depot charging compatibility
  const s_charging_compat = charging_compatible ? 100 : 40;

  // S_co2: CO2 savings percentage
  const s_co2 = Math.min(100, Math.max(0, co2_savings_pct * 1.5));

  const total = (
    s_feasibility * 0.35
    + s_range_buffer * 0.20
    + s_tco_savings * 0.20
    + s_charging_compat * 0.15
    + s_co2 * 0.10
  );

  return Math.round(total * 10) / 10;
}

/**
 * Rank all fleet vehicles by electrification priority
 */
export function rankCandidates(
  vehicles: FleetVehicle[],
  evModels: EVModel[],
  scenario: Scenario,
  routes: Route[] = []
): RankedCandidate[] {
  const candidates: RankedCandidate[] = [];

  for (const vehicle of vehicles) {
    // Find routes for this vehicle (if any)
    const vehicleRoutes = routes.filter(r => r.vehicle_id === vehicle.id);
    const representativeRoute = vehicleRoutes.length > 0 ? vehicleRoutes[0] : null;

    // Get best EV match
    const bestMatch = getBestEVMatch(vehicle, evModels, scenario);

    if (!bestMatch) {
      candidates.push({
        vehicle,
        route: representativeRoute,
        feasibility_score: 0,
        range_buffer_score: 0,
        tco_savings_score: 0,
        charging_compat_score: 0,
        co2_score: 0,
        total_score: 0,
        rank: 0,
        recommended_ev: null,
      });
      continue;
    }

    const ev = bestMatch.ev_model;

    // Calculate ICE costs
    const ice_annual_fuel = calculateAnnualFuelCost(vehicle.annual_km, vehicle.consumption_l_100km, DEFAULT_DIESEL_PRICE);
    const ice_annual_co2_kg = calculateAnnualIceCO2e(vehicle.annual_km, vehicle.consumption_l_100km, DEFAULT_DIESEL_EMISSION_FACTOR);
    const ice_capex_annual = vehicle.capex ? annualizeCapex(vehicle.capex) : (vehicle.lease_monthly ?? 0) * 12;
    const ice_opex = ice_annual_fuel + vehicle.maintenance_cost_annual;
    const ice_tco = (ice_capex_annual + ice_opex) * DEFAULT_LIFETIME_YEARS;

    // Calculate EV costs
    const ev_tco = bestMatch.tco_ev;
    const tco_savings = ice_tco - ev_tco;

    // CO2 savings
    const ev_co2_kg = bestMatch.co2e_ev_t * 1000;
    const co2_savings_pct = ice_annual_co2_kg > 0 ? ((ice_annual_co2_kg - ev_co2_kg) / ice_annual_co2_kg) * 100 : 0;

    // Range buffer
    let range_buffer_kwh = 0;
    if (representativeRoute) {
      const factors = buildConsumptionFactors(
        representativeRoute.payload_kg, ev.payload_kg ?? 1000,
        representativeRoute.outside_temperature_c, representativeRoute.avg_speed_kmh,
        representativeRoute.elevation_gain_m
      );
      const ec_adj = calculateAdjustedConsumption(ev.nominal_consumption_kwh_100km, factors);
      const energy = calculateEnergyPerTour(representativeRoute.distance_km, ec_adj);
      const departure_soc = scenario.soc_target ?? scenario.soc_start ?? 90;
      const soc_end = calculateSocAfterTour(departure_soc, energy, ev.battery_usable_kwh);
      range_buffer_kwh = Math.max(0, ((soc_end - scenario.soc_min) / 100) * ev.battery_usable_kwh);
    }

    // Charging compatibility
    const charging_compatible = ev.max_ac_kw >= 11 || ev.max_dc_kw !== null;

    const total_score = calculateFirstToElectrifyScore(
      bestMatch.feasibility,
      range_buffer_kwh,
      tco_savings,
      ice_tco,
      charging_compatible,
      co2_savings_pct
    );

    // Decompose for transparency
    const s_feasibility = bestMatch.feasibility === FeasibilityStatus.FEASIBLE ? 100
      : bestMatch.feasibility === FeasibilityStatus.FEASIBLE_WITH_CHARGING ? 50 : 0;
    const s_range = Math.min(100, (range_buffer_kwh / 50) * 100);
    const s_tco = Math.min(100, Math.max(0, (tco_savings / ice_tco) * 200));
    const s_charging = charging_compatible ? 100 : 40;
    const s_co2 = Math.min(100, co2_savings_pct * 1.5);

    candidates.push({
      vehicle,
      route: representativeRoute,
      feasibility_score: s_feasibility,
      range_buffer_score: s_range,
      tco_savings_score: s_tco,
      charging_compat_score: s_charging,
      co2_score: s_co2,
      total_score,
      rank: 0,
      recommended_ev: ev,
    });
  }

  // Sort by total score descending, assign ranks
  candidates.sort((a, b) => b.total_score - a.total_score);
  candidates.forEach((c, i) => {
    c.rank = i + 1;
  });

  return candidates;
}
