/**
 * Charging Infrastructure Estimator
 * Calculates required charger count based on fleet energy demand and dwell times
 */

import { InfraEstimate } from '../../../shared/types';

const DEFAULT_CHARGING_WINDOW_HOURS = 10; // Typical depot overnight window
const DEFAULT_UTILIZATION_TARGET = 0.80; // 80% charger utilization target
const DEFAULT_CHARGER_POWER_KW = 22; // AC depot charger
const PUBLIC_CHARGER_RATIO = 0.15; // 15% public charging for en-route topping up

/**
 * Estimate required charger count using the formula:
 * N_chargers = ceil(sum(t_charge_i) / (Window_charging × Utilization_target))
 *
 * Where t_charge_i is the charging time for each EV in hours
 *
 * @param evCount - Number of EVs in the fleet
 * @param dailyEnergyDemand_kwh - Total daily energy demand for all EVs in kWh
 * @param dwellTimes_min - Array of dwell times per vehicle in minutes
 * @param chargerPower_kw - Charger power in kW
 * @param utilizationTarget - Utilization target (0-1)
 * @param chargingWindowHours - Available charging window in hours
 * @param chargingEfficiency - Charging efficiency (0-1)
 * @returns Infrastructure estimate
 */
export function estimateChargers(
  evCount: number,
  dailyEnergyDemand_kwh: number,
  dwellTimes_min: number[],
  chargerPower_kw: number = DEFAULT_CHARGER_POWER_KW,
  utilizationTarget: number = DEFAULT_UTILIZATION_TARGET,
  chargingWindowHours: number = DEFAULT_CHARGING_WINDOW_HOURS,
  chargingEfficiency: number = 0.92
): InfraEstimate {
  const warnings: string[] = [];

  if (evCount === 0) {
    return {
      total_ev_count: 0,
      daily_energy_demand_kwh: 0,
      required_charger_count: 0,
      depot_chargers: 0,
      public_chargers: 0,
      avg_charging_power_kw: chargerPower_kw,
      charging_window_hours: chargingWindowHours,
      warnings: ['Keine EV-Fahrzeuge für Infrastrukturabschätzung vorhanden'],
    };
  }

  // Calculate charging time needed per EV
  // t_charge_i = E_daily_i / (P_charger × η_charging)
  const energy_per_ev_kwh = dailyEnergyDemand_kwh / evCount;
  const charge_time_per_ev_hours = energy_per_ev_kwh / (chargerPower_kw * chargingEfficiency);

  // Total charging time needed across all EVs
  const total_charge_time_hours = charge_time_per_ev_hours * evCount;

  // Required chargers = ceil(total_charge_time / (window × utilization))
  const effective_window = chargingWindowHours * utilizationTarget;
  const required_charger_count = Math.ceil(total_charge_time_hours / effective_window);

  // Split depot vs public
  const public_chargers = Math.ceil(required_charger_count * PUBLIC_CHARGER_RATIO);
  const depot_chargers = required_charger_count - public_chargers;

  // Check warnings
  if (charge_time_per_ev_hours > chargingWindowHours) {
    warnings.push(
      `Warnung: Ladezeit pro Fahrzeug (${charge_time_per_ev_hours.toFixed(1)}h) übersteigt das Ladefenster (${chargingWindowHours}h). ` +
      `Schnellladetechnologie (DC) oder verlängertes Ladefenster empfohlen.`
    );
  }

  // Check if dwell times are sufficient
  if (dwellTimes_min.length > 0) {
    const avgDwellMin = dwellTimes_min.reduce((a, b) => a + b, 0) / dwellTimes_min.length;
    const avgDwellHours = avgDwellMin / 60;
    if (avgDwellHours < charge_time_per_ev_hours * 0.5) {
      warnings.push(
        `Hinweis: Durchschnittliche Standzeit (${avgDwellMin.toFixed(0)} min) ist kurz im Verhältnis zum Ladebedarf. ` +
        `DC-Schnellladen oder depot-basiertes Laden empfohlen.`
      );
    }
  }

  // Peak demand check
  const peak_power_kw = required_charger_count * chargerPower_kw;
  if (peak_power_kw > 100) {
    warnings.push(
      `Hinweis: Gleichzeitige Netzlast bei voller Auslastung: ${peak_power_kw.toFixed(0)} kW. ` +
      `Lastmanagement und Netzanschlusskapazität prüfen.`
    );
  }

  return {
    total_ev_count: evCount,
    daily_energy_demand_kwh: Math.round(dailyEnergyDemand_kwh * 10) / 10,
    required_charger_count,
    depot_chargers,
    public_chargers,
    avg_charging_power_kw: chargerPower_kw,
    charging_window_hours: chargingWindowHours,
    warnings,
  };
}

/**
 * Estimate daily energy demand for a fleet
 */
export function estimateDailyEnergyDemand(
  annualKmPerVehicle: number[],
  consumptionKwh100km: number,
  workingDaysPerYear: number = 250
): number {
  const totalAnnualKm = annualKmPerVehicle.reduce((a, b) => a + b, 0);
  const totalAnnualEnergy = (totalAnnualKm / 100) * consumptionKwh100km;
  return totalAnnualEnergy / workingDaysPerYear;
}

/**
 * Get investment cost estimate for infrastructure
 */
export function estimateInfrastructureInvestment(
  depot_chargers: number,
  dc_chargers: number = 0,
  installation_factor: number = 1.4
): {
  equipment_cost: number;
  installation_cost: number;
  total_cost: number;
  cost_per_charger: number;
} {
  const AC_CHARGER_PRICE = 3500; // 22kW wallbox
  const DC_CHARGER_PRICE = 25000; // 50kW DC charger

  const equipment_cost = depot_chargers * AC_CHARGER_PRICE + dc_chargers * DC_CHARGER_PRICE;
  const installation_cost = equipment_cost * (installation_factor - 1);
  const total_cost = equipment_cost * installation_factor;
  const total_chargers = depot_chargers + dc_chargers;
  const cost_per_charger = total_chargers > 0 ? total_cost / total_chargers : 0;

  return {
    equipment_cost: Math.round(equipment_cost),
    installation_cost: Math.round(installation_cost),
    total_cost: Math.round(total_cost),
    cost_per_charger: Math.round(cost_per_charger),
  };
}
