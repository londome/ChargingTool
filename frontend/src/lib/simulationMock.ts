import { SimulationRun, ResultSummary, RouteResult, InfrastructureEstimate, SimulationStatus } from '@shared/types';

export const DEMO_RUN_ID = 'demo';

export const DEMO_SIMULATION_RUN: SimulationRun = {
  id: DEMO_RUN_ID,
  project_id: 'demo-project',
  scenario_id: 'demo-scenario',
  status: SimulationStatus.COMPLETED,
  started_at: new Date(Date.now() - 8000).toISOString(),
  completed_at: new Date(Date.now() - 5000).toISOString(),
  error_message: null,
};

export const DEMO_RESULT_SUMMARY: ResultSummary = {
  id: 'demo-summary',
  simulation_run_id: DEMO_RUN_ID,
  total_vehicles: 20,
  electrifiable_count: 16,
  electrifiable_pct: 80.0,
  annual_fuel_cost_ice: 115200,
  annual_electricity_cost_ev: 61880,
  opex_ice: 175200,
  opex_ev: 97880,
  tco_ice: 2201600,
  tco_ev: 1783040,
  co2e_ice_t: 203.5,
  co2e_ev_t: 94.2,
  co2e_savings_t: 109.3,
  co2e_savings_pct: 53.7,
  payback_years: 4.6,
  recommended_charger_count: 8,
};

export const DEMO_ROUTE_RESULTS: RouteResult[] = [
  {
    id: 'r1', simulation_run_id: DEMO_RUN_ID, route_id: 'TOUR-001', vehicle_id: 'VH-01',
    distance_km: 87.4, fuel_use_l: 6.47, fuel_cost: 10.36, ice_co2e_kg: 17.08,
    ev_energy_kwh: 24.5, feasible_without_charging: true, feasible_with_charging: true,
    required_charge_energy_kwh: 0, annual_cost_delta: -1820, annual_co2e_delta_kg: -4250,
  },
  {
    id: 'r2', simulation_run_id: DEMO_RUN_ID, route_id: 'TOUR-002', vehicle_id: 'VH-02',
    distance_km: 124.8, fuel_use_l: 9.24, fuel_cost: 14.78, ice_co2e_kg: 24.39,
    ev_energy_kwh: 35.0, feasible_without_charging: false, feasible_with_charging: true,
    required_charge_energy_kwh: 12.4, annual_cost_delta: -2340, annual_co2e_delta_kg: -5820,
  },
  {
    id: 'r3', simulation_run_id: DEMO_RUN_ID, route_id: 'TOUR-003', vehicle_id: 'VH-03',
    distance_km: 54.2, fuel_use_l: 4.01, fuel_cost: 6.42, ice_co2e_kg: 10.59,
    ev_energy_kwh: 15.2, feasible_without_charging: true, feasible_with_charging: true,
    required_charge_energy_kwh: 0, annual_cost_delta: -1240, annual_co2e_delta_kg: -2910,
  },
  {
    id: 'r4', simulation_run_id: DEMO_RUN_ID, route_id: 'TOUR-004', vehicle_id: 'VH-04',
    distance_km: 198.3, fuel_use_l: 14.67, fuel_cost: 23.47, ice_co2e_kg: 38.73,
    ev_energy_kwh: 55.5, feasible_without_charging: false, feasible_with_charging: false,
    required_charge_energy_kwh: 28.6, annual_cost_delta: 1100, annual_co2e_delta_kg: -3200,
  },
  {
    id: 'r5', simulation_run_id: DEMO_RUN_ID, route_id: 'TOUR-005', vehicle_id: 'VH-05',
    distance_km: 73.1, fuel_use_l: 5.41, fuel_cost: 8.66, ice_co2e_kg: 14.28,
    ev_energy_kwh: 20.5, feasible_without_charging: true, feasible_with_charging: true,
    required_charge_energy_kwh: 0, annual_cost_delta: -1580, annual_co2e_delta_kg: -3690,
  },
];

export const DEMO_INFRASTRUCTURE: InfrastructureEstimate = {
  id: 'demo-infra',
  simulation_run_id: DEMO_RUN_ID,
  wallbox_price_eur: 1200,
  installation_cost_per_point: 3500,
  infra_capex_total: 8 * (1200 + 3500),
  total_ev_count: 16,
  daily_energy_demand_kwh: 1240,
  required_charger_count: 8,
  depot_chargers: 7,
  public_chargers: 1,
  avg_charging_power_kw: 22,
  charging_window_hours: 9.5,
  warnings: [
    'Ladezeiten >8h für 2 Fahrzeuge: Schnellladesäule (DC) empfohlen',
  ],
};
