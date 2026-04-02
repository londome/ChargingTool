/**
 * Mock data for demo mode
 */

import { Project, FleetVehicle, Route, Scenario, ResultSummary, FuelType, VehicleSegment, ChargingOption, ScenarioType, AcquisitionType, SimulationStatus } from '../../../shared/types';

export const mockProject: Project = {
  id: 'demo-project-1',
  user_id: null as unknown as string,
  name: 'Demo Stadtlogistik GmbH',
  country: 'DE',
  currency: 'EUR',
  fleet_type: 'Stadtlogistik',
  industry: 'KEP-Dienste',
  depot_location: 'Frankfurt am Main',
  charging_options: [ChargingOption.DEPOT_AC, ChargingOption.PUBLIC_AC],
  created_at: '2024-01-15T08:00:00Z',
  updated_at: '2024-03-01T10:30:00Z',
};

export const mockFleetVehicles: FleetVehicle[] = [
  {
    id: 'v1', fleet_id: 'f1', segment: VehicleSegment.LARGE_VAN,
    fuel_type: FuelType.DIESEL, count: 15,
    consumption_l_100km: 9.8, annual_km: 35000, payload_kg: 900,
    maintenance_cost_annual: 4200, acquisition_type: AcquisitionType.PURCHASE,
    capex: 52000, lease_monthly: null,
  },
  {
    id: 'v2', fleet_id: 'f1', segment: VehicleSegment.MEDIUM_VAN,
    fuel_type: FuelType.DIESEL, count: 8,
    consumption_l_100km: 8.2, annual_km: 28000, payload_kg: 700,
    maintenance_cost_annual: 3500, acquisition_type: AcquisitionType.LEASE,
    capex: null, lease_monthly: 650,
  },
  {
    id: 'v3', fleet_id: 'f1', segment: VehicleSegment.SMALL_VAN,
    fuel_type: FuelType.DIESEL, count: 5,
    consumption_l_100km: 6.8, annual_km: 22000, payload_kg: 500,
    maintenance_cost_annual: 2800, acquisition_type: AcquisitionType.PURCHASE,
    capex: 38000, lease_monthly: null,
  },
];

export const mockRoutes: Route[] = [
  {
    id: 'r1', project_id: 'demo-project-1', vehicle_id: 'v1',
    route_id: 'ROUTE_001', date: '2024-03-01', start_time: '06:30',
    end_time: '16:45', distance_km: 185, stops: 12, dwell_time_min: 95,
    avg_speed_kmh: 48, payload_kg: 750, depot_id: 'DEPOT_FRA',
    start_location: 'Frankfurt Depot', end_location: 'Frankfurt Depot',
    elevation_gain_m: 150, outside_temperature_c: 8, source_type: 'upload', consumption_l_100km: null, trips_per_year: null, vehicle_count: null,
  },
  {
    id: 'r2', project_id: 'demo-project-1', vehicle_id: 'v1',
    route_id: 'ROUTE_002', date: '2024-03-01', start_time: '07:00',
    end_time: '15:30', distance_km: 142, stops: 9, dwell_time_min: 75,
    avg_speed_kmh: 52, payload_kg: 820, depot_id: 'DEPOT_FRA',
    start_location: 'Frankfurt Depot', end_location: 'Frankfurt Depot',
    elevation_gain_m: 80, outside_temperature_c: 8, source_type: 'upload', consumption_l_100km: null, trips_per_year: null, vehicle_count: null,
  },
  {
    id: 'r3', project_id: 'demo-project-1', vehicle_id: 'v2',
    route_id: 'ROUTE_003', date: '2024-03-01', start_time: '06:00',
    end_time: '17:00', distance_km: 220, stops: 7, dwell_time_min: 45,
    avg_speed_kmh: 65, payload_kg: 600, depot_id: 'DEPOT_FRA',
    start_location: 'Frankfurt Depot', end_location: 'Frankfurt Depot',
    elevation_gain_m: 250, outside_temperature_c: 8, source_type: 'upload', consumption_l_100km: null, trips_per_year: null, vehicle_count: null,
  },
  {
    id: 'r4', project_id: 'demo-project-1', vehicle_id: 'v2',
    route_id: 'ROUTE_004', date: '2024-03-01', start_time: '07:30',
    end_time: '14:00', distance_km: 98, stops: 15, dwell_time_min: 120,
    avg_speed_kmh: 35, payload_kg: 450, depot_id: 'DEPOT_FRA',
    start_location: 'Frankfurt Depot', end_location: 'Frankfurt Depot',
    elevation_gain_m: 50, outside_temperature_c: 8, source_type: 'upload', consumption_l_100km: null, trips_per_year: null, vehicle_count: null,
  },
  {
    id: 'r5', project_id: 'demo-project-1', vehicle_id: 'v3',
    route_id: 'ROUTE_005', date: '2024-03-01', start_time: '08:00',
    end_time: '16:00', distance_km: 115, stops: 20, dwell_time_min: 90,
    avg_speed_kmh: 38, payload_kg: 380, depot_id: 'DEPOT_FRA',
    start_location: 'Frankfurt Depot', end_location: 'Frankfurt Depot',
    elevation_gain_m: 60, outside_temperature_c: 8, source_type: 'upload', consumption_l_100km: null, trips_per_year: null, vehicle_count: null,
  },
];

export const mockScenarios: Scenario[] = [
  {
    id: 'sc1', project_id: 'demo-project-1',
    name: 'Baseline – Aktuelle Annahmen',
    type: ScenarioType.BASELINE,
    electrification_pct: 100,
    soc_start: 90, soc_min: 20, soc_target: 80,
    charging_power_kw: 22, charging_efficiency: 0.92,
    electricity_price: 0.28, grid_emission_factor: 0.380,
    temperature_factor: 1.0, allow_public_charging: false,
    winter_surcharge: 0.15, notes: 'Standardannahmen für erste Bewertung',
    wallbox_price_eur: 1200, installation_type: 'standard' as any,
  },
  {
    id: 'sc2', project_id: 'demo-project-1',
    name: 'Optimistisch – Günstige Bedingungen',
    type: ScenarioType.OPTIMISTIC,
    electrification_pct: 100,
    soc_start: 95, soc_min: 15, soc_target: 85,
    charging_power_kw: 22, charging_efficiency: 0.94,
    electricity_price: 0.22, grid_emission_factor: 0.300,
    temperature_factor: 0.95, allow_public_charging: true,
    winter_surcharge: 0.10, notes: 'Optimistische Annahmen: niedrige Strompreise, sauberer Strommix',
    wallbox_price_eur: 1200, installation_type: 'standard' as any,
  },
  {
    id: 'sc3', project_id: 'demo-project-1',
    name: 'Konservativ – Worst Case',
    type: ScenarioType.CONSERVATIVE,
    electrification_pct: 80,
    soc_start: 85, soc_min: 25, soc_target: 75,
    charging_power_kw: 11, charging_efficiency: 0.88,
    electricity_price: 0.35, grid_emission_factor: 0.420,
    temperature_factor: 1.1, allow_public_charging: false,
    winter_surcharge: 0.20, notes: 'Konservative Annahmen inkl. Winterzuschlag',
    wallbox_price_eur: 1200, installation_type: 'standard' as any,
  },
];

export const mockResultSummary: ResultSummary = {
  id: 'rs1',
  simulation_run_id: 'run1',
  total_vehicles: 28,
  electrifiable_count: 22,
  electrifiable_pct: 78.6,
  annual_fuel_cost_ice: 168500,
  annual_electricity_cost_ev: 52300,
  opex_ice: 235800,
  opex_ev: 98600,
  tco_ice: 2650000,
  tco_ev: 1980000,
  co2e_ice_t: 448.2,
  co2e_ev_t: 52.4,
  co2e_savings_t: 395.8,
  co2e_savings_pct: 88.3,
  payback_years: 4.8,
  recommended_charger_count: 12,
};

export const demoStats = {
  projects: 3,
  vehicles: 28,
  routes: 145,
  simulations: 7,
  co2_saved_t: 395.8,
  cost_saved_eur_annual: 137200,
};
