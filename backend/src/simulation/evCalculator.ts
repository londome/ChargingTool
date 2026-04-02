/**
 * EV (Battery Electric Vehicle) Calculation Functions
 * All monetary values in EUR, distances in km, energy in kWh, CO2 in kg
 */

import { FeasibilityResult, FeasibilityStatus, ConsumptionFactors, EVModel, Scenario } from '../../../shared/types';
import { DEFAULT_LIFETIME_YEARS, DEFAULT_DISCOUNT_RATE, annualizeCapex } from './iceCalculator';

// German grid emission factor kg CO2e / kWh (Umweltbundesamt 2023)
export const DEFAULT_GRID_EMISSION_FACTOR = 0.380;
// Default charging efficiency AC (wall-to-wheel)
export const DEFAULT_CHARGING_EFFICIENCY = 0.92;
// Battery aging factor per year (0.97 = 3% capacity loss/year)
export const BATTERY_AGING_FACTOR_PER_YEAR = 0.97;
// Default EV maintenance cost as fraction of ICE maintenance cost
export const EV_MAINTENANCE_FACTOR = 0.6;
// Infrastructure capex per depot charger (22kW AC, EUR)
export const DEPOT_CHARGER_CAPEX = 8500;
// Infrastructure capex per DC fast charger (50kW+, EUR)
export const DC_CHARGER_CAPEX = 35000;

/**
 * Calculate adjusted energy consumption based on operating factors
 * EC_adj = EC_nom × f_payload × f_temperature × f_speed × f_terrain × f_hvac × f_aging
 *
 * @param base_kwh_100km - Nominal consumption from manufacturer spec
 * @param factors - Object with adjustment factors (default: all 1.0)
 * @returns Adjusted consumption in kWh/100km
 */
export function calculateAdjustedConsumption(
  base_kwh_100km: number,
  factors: Partial<ConsumptionFactors> = {}
): number {
  const f = {
    f_payload: factors.f_payload ?? 1.0,
    f_temperature: factors.f_temperature ?? 1.0,
    f_speed: factors.f_speed ?? 1.0,
    f_terrain: factors.f_terrain ?? 1.0,
    f_hvac: factors.f_hvac ?? 1.0,
    f_aging: factors.f_aging ?? 1.0,
  };

  return base_kwh_100km * f.f_payload * f.f_temperature * f.f_speed * f.f_terrain * f.f_hvac * f.f_aging;
}

/**
 * Calculate energy needed for a single tour
 * E_tour = distance_km × EC_adj / 100
 *
 * @param distance_km - Tour distance
 * @param ec_adj_kwh_100km - Adjusted consumption in kWh/100km
 * @returns Energy in kWh (gross, before charging efficiency)
 */
export function calculateEnergyPerTour(distance_km: number, ec_adj_kwh_100km: number): number {
  return (distance_km / 100) * ec_adj_kwh_100km;
}

/**
 * Calculate annual energy consumption
 * @param annual_km - Annual kilometers
 * @param ec_adj_kwh_100km - Adjusted consumption kWh/100km
 * @returns Annual energy in kWh (net from battery)
 */
export function calculateAnnualEnergy(annual_km: number, ec_adj_kwh_100km: number): number {
  return (annual_km / 100) * ec_adj_kwh_100km;
}

/**
 * Calculate State of Charge after a tour
 * SOC_end = SOC_start - (E_tour / battery_usable_kwh × 100)
 *
 * @param soc_start_pct - Starting SOC in percent (0-100)
 * @param energy_kwh - Energy needed for tour in kWh
 * @param battery_usable_kwh - Usable battery capacity in kWh
 * @returns End SOC in percent
 */
export function calculateSocAfterTour(soc_start_pct: number, energy_kwh: number, battery_usable_kwh: number): number {
  const soc_drop_pct = (energy_kwh / battery_usable_kwh) * 100;
  return soc_start_pct - soc_drop_pct;
}

/**
 * Check if a tour is feasible without any intermediate charging
 * @param soc_end_pct - SOC at tour end
 * @param soc_min_pct - Minimum allowed SOC
 * @param battery_usable_kwh - Usable capacity (not directly used, included for context)
 * @returns true if feasible without charging
 */
export function checkFeasibilityWithoutCharging(
  soc_end_pct: number,
  soc_min_pct: number,
  _battery_usable_kwh?: number
): boolean {
  return soc_end_pct >= soc_min_pct;
}

/**
 * Check feasibility with possibility of intermediate charging during dwell time
 * Determines if enough charging can happen during stop times to complete the tour
 *
 * @param soc_end_pct - SOC if no intermediate charging (may be negative)
 * @param total_dwell_time_min - Total dwell/stop time available for charging in minutes
 * @param charger_power_kw - Available charging power in kW
 * @param battery_usable_kwh - Usable battery capacity in kWh
 * @param soc_min_pct - Minimum SOC buffer
 * @param charging_efficiency - Charging efficiency (default 0.92)
 * @returns FeasibilityResult with status and details
 */
export function checkFeasibilityWithCharging(
  soc_end_pct: number,
  total_dwell_time_min: number,
  charger_power_kw: number,
  battery_usable_kwh: number,
  soc_min_pct: number,
  charging_efficiency: number = DEFAULT_CHARGING_EFFICIENCY
): FeasibilityResult {
  // Energy deficit (kWh) = how much below SOC_min we are
  const soc_deficit_pct = soc_min_pct - soc_end_pct;

  if (soc_deficit_pct <= 0) {
    // Already feasible without charging
    return {
      status: FeasibilityStatus.FEASIBLE,
      soc_after_tour: soc_end_pct,
      energy_required_kwh: 0,
      charge_time_needed_min: 0,
      margin_kwh: ((soc_end_pct - soc_min_pct) / 100) * battery_usable_kwh,
    };
  }

  // How much energy we need to add (net into battery)
  const energy_deficit_kwh = (soc_deficit_pct / 100) * battery_usable_kwh;

  // How much time would be needed to charge this energy
  // t_charge = E_deficit / (P_charger × η) in hours
  const charge_time_hours = energy_deficit_kwh / (charger_power_kw * charging_efficiency);
  const charge_time_min = charge_time_hours * 60;

  // Check if available dwell time is sufficient
  // Apply a safety factor: only use 80% of dwell time for charging
  const available_charge_time_min = total_dwell_time_min * 0.80;

  if (available_charge_time_min >= charge_time_min) {
    return {
      status: FeasibilityStatus.FEASIBLE_WITH_CHARGING,
      soc_after_tour: soc_min_pct,
      energy_required_kwh: energy_deficit_kwh / charging_efficiency,
      charge_time_needed_min: charge_time_min,
      margin_kwh: 0,
    };
  }

  return {
    status: FeasibilityStatus.NOT_FEASIBLE,
    soc_after_tour: soc_end_pct,
    energy_required_kwh: energy_deficit_kwh / charging_efficiency,
    charge_time_needed_min: charge_time_min,
    margin_kwh: -(soc_deficit_pct / 100) * battery_usable_kwh,
  };
}

/**
 * Calculate electricity cost for charging
 * C_elec = E_kwh_grid × price_per_kwh
 *
 * @param energy_kwh - Energy drawn from grid in kWh
 * @param price_per_kwh - Electricity price in EUR/kWh
 * @returns Cost in EUR
 */
export function calculateElectricityCost(energy_kwh: number, price_per_kwh: number): number {
  return energy_kwh * price_per_kwh;
}

/**
 * Calculate EV CO2 equivalent emissions (well-to-wheel)
 * CO2e_ev = E_kwh × grid_emission_factor
 *
 * @param energy_kwh - Energy consumed from grid in kWh
 * @param grid_ef - Grid emission factor in kg CO2e / kWh
 * @returns CO2e in kg
 */
export function calculateEvCO2e(energy_kwh: number, grid_ef: number = DEFAULT_GRID_EMISSION_FACTOR): number {
  return energy_kwh * grid_ef;
}

/**
 * Calculate annual EV operational expenditure
 * @param elec_cost_annual - Annual electricity cost in EUR
 * @param maintenance_annual - Annual maintenance cost in EUR
 * @param public_charging_annual - Annual public charging costs in EUR
 * @param other_annual - Other annual costs in EUR
 * @returns Annual OpEx in EUR
 */
export function calculateEvOpex(
  elec_cost_annual: number,
  maintenance_annual: number,
  public_charging_annual: number = 0,
  other_annual: number = 0
): number {
  return elec_cost_annual + maintenance_annual + public_charging_annual + other_annual;
}

/**
 * Calculate EV Total Cost of Ownership
 * TCO_ev = (capex_annualized + opex_annual + infra_annualized) × lifetime_years
 *
 * @param capex_annualized - Annualized EV purchase/lease cost (EUR/year)
 * @param opex_annual - Annual operational costs (EUR/year)
 * @param infra_annualized - Annualized infrastructure cost share (EUR/year)
 * @param lifetime_years - Vehicle lifetime in years
 * @returns Total TCO in EUR
 */
export function calculateEvTCO(
  capex_annualized: number,
  opex_annual: number,
  infra_annualized: number = 0,
  lifetime_years: number = DEFAULT_LIFETIME_YEARS
): number {
  return (capex_annualized + opex_annual + infra_annualized) * lifetime_years;
}

/**
 * Calculate simple payback period
 * Payback = CAPEX_incremental / Annual_savings
 *
 * @param capex_incremental - Additional CAPEX of EV vs ICE in EUR
 * @param annual_savings - Annual cost savings (ICE OpEx - EV OpEx) in EUR
 * @returns Payback years (returns Infinity if no savings)
 */
export function calculatePayback(capex_incremental: number, annual_savings: number): number {
  if (annual_savings <= 0) return Infinity;
  return capex_incremental / annual_savings;
}

/**
 * Calculate annual energy from grid (including charging losses)
 * @param energy_consumed_kwh - Energy consumed by the vehicle from battery (kWh)
 * @param charging_efficiency - Charging efficiency (e.g. 0.92)
 * @returns Grid energy in kWh
 */
export function calculateGridEnergy(energy_consumed_kwh: number, charging_efficiency: number = DEFAULT_CHARGING_EFFICIENCY): number {
  return energy_consumed_kwh / charging_efficiency;
}

/**
 * Build consumption factors for a given route and scenario
 */
export function buildConsumptionFactors(
  payload_kg: number | null,
  max_payload_kg: number,
  outside_temp_c: number | null,
  avg_speed_kmh: number | null,
  elevation_gain_m: number | null,
  vehicle_age_years: number = 0,
  scenario_temp_factor: number = 1.0
): ConsumptionFactors {
  // f_payload: payload as fraction of max payload increases consumption
  // Empty: 1.0, Full: ~1.20
  const payload_fraction = payload_kg && max_payload_kg > 0 ? Math.min(payload_kg / max_payload_kg, 1.0) : 0.5;
  const f_payload = 1.0 + 0.20 * payload_fraction;

  // f_temperature: cold and hot temperatures increase consumption
  // 20°C = 1.0, 0°C = 1.25, -10°C = 1.40, 35°C = 1.10
  let f_temperature = 1.0;
  if (outside_temp_c !== null) {
    if (outside_temp_c < 0) {
      f_temperature = 1.0 + (Math.abs(outside_temp_c) * 0.018);
    } else if (outside_temp_c > 25) {
      f_temperature = 1.0 + ((outside_temp_c - 25) * 0.004);
    }
    f_temperature = Math.max(1.0, f_temperature);
  }
  f_temperature *= scenario_temp_factor;

  // f_speed: highway driving increases consumption
  // City (< 40 km/h) = 1.05, mixed = 1.0, highway (>80) = 1.15
  let f_speed = 1.0;
  if (avg_speed_kmh !== null) {
    if (avg_speed_kmh < 40) {
      f_speed = 1.05; // city stop-and-go (regenerative braking helps but frequent acceleration hurts)
    } else if (avg_speed_kmh > 80) {
      f_speed = 1.0 + ((avg_speed_kmh - 80) / 100) * 0.30;
    }
  }

  // f_terrain: elevation gain increases consumption
  // ~0.5 Wh/km per meter of elevation gain (very rough estimate for vans)
  let f_terrain = 1.0;
  if (elevation_gain_m !== null && elevation_gain_m > 0) {
    // For a typical tour distance, elevation has minor impact
    // We use a relative factor
    f_terrain = 1.0 + (elevation_gain_m * 0.0001);
    f_terrain = Math.min(f_terrain, 1.15); // cap at 15%
  }

  // f_hvac: heating/cooling (simplified - already partly covered by temperature)
  // Keep at 1.0 here as it's baked into f_temperature
  const f_hvac = 1.0;

  // f_aging: battery aging increases consumption (state of health reduction)
  // 0 years = 1.0, 3 years = 1.03, 8 years = 1.08 (simplified linear)
  const f_aging = 1.0 + vehicle_age_years * 0.01;

  return { f_payload, f_temperature, f_speed, f_terrain, f_hvac, f_aging };
}

/**
 * Calculate infrastructure cost annualized per EV
 */
export function calculateInfrastructureCostPerEv(
  total_ev_count: number,
  depot_charger_count: number,
  dc_charger_count: number = 0,
  lifetime_years: number = DEFAULT_LIFETIME_YEARS,
  discount_rate: number = DEFAULT_DISCOUNT_RATE
): number {
  const totalInfraCost = depot_charger_count * DEPOT_CHARGER_CAPEX + dc_charger_count * DC_CHARGER_CAPEX;
  const annualInfra = annualizeCapex(totalInfraCost, lifetime_years, discount_rate);
  return total_ev_count > 0 ? annualInfra / total_ev_count : 0;
}
