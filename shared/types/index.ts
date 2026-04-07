// Shared TypeScript types for fleet electrification platform

// ============================================================
// ENUMS
// ============================================================

export enum FuelType {
  DIESEL = 'diesel',
  PETROL = 'petrol',
  CNG = 'cng',
  LPG = 'lpg',
  HEV = 'hev',
  PHEV = 'phev',
  BEV = 'bev',
}

export enum VehicleSegment {
  SMALL_VAN = 'small_van',        // < 3.5t, e.g. VW Caddy
  MEDIUM_VAN = 'medium_van',      // 3.5t, e.g. VW Transporter
  LARGE_VAN = 'large_van',        // 3.5t high roof, e.g. VW Crafter
  LIGHT_TRUCK = 'light_truck',    // 7.5t
  MEDIUM_TRUCK = 'medium_truck',  // 12-18t
  HEAVY_TRUCK = 'heavy_truck',    // > 18t
  CAR = 'car',
  MINIBUS = 'minibus',
}

export enum ChargingOption {
  DEPOT_AC = 'depot_ac',
  DEPOT_DC = 'depot_dc',
  PUBLIC_AC = 'public_ac',
  PUBLIC_DC = 'public_dc',
  ENROUTE_DC = 'enroute_dc',
}

export enum FeasibilityStatus {
  FEASIBLE = 'feasible',                    // machbar ohne Zwischenladen
  FEASIBLE_WITH_CHARGING = 'feasible_with_charging',  // machbar mit Zwischenladen
  NOT_FEASIBLE = 'not_feasible',            // nicht machbar
  UNKNOWN = 'unknown',
}

export enum ScenarioType {
  BASELINE = 'baseline',
  OPTIMISTIC = 'optimistic',
  CONSERVATIVE = 'conservative',
  CUSTOM = 'custom',
}

export enum SimulationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum AcquisitionType {
  PURCHASE = 'purchase',
  LEASE = 'lease',
  RENTAL = 'rental',
}

export enum InstallationType {
  SIMPLE = 'simple',       // nur Montage, keine Bauarbeiten
  STANDARD = 'standard',   // Elektroinstallation, Kabelführung
  AUFWENDIG = 'aufwendig', // Bauliche Maßnahmen, Tiefbau, Trafo
}

// ============================================================
// CORE ENTITIES
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  country: string;
  currency: string;
  fleet_type: string;
  industry: string;
  depot_location: string;
  charging_options: ChargingOption[];
  wizard_module?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Fleet {
  id: string;
  project_id: string;
  vehicle_count: number;
  notes: string | null;
}

export interface FleetVehicle {
  id: string;
  fleet_id: string;
  segment: VehicleSegment;
  fuel_type: FuelType;
  count: number;
  consumption_l_100km: number;
  annual_km: number;
  payload_kg: number;
  maintenance_cost_annual: number;
  acquisition_type: AcquisitionType;
  capex: number | null;
  lease_monthly: number | null;
}

export interface EVModel {
  id: string;
  manufacturer: string;
  model: string;
  segment: VehicleSegment;
  battery_gross_kwh: number;
  battery_usable_kwh: number;
  nominal_consumption_kwh_100km: number;
  max_ac_kw: number;
  max_dc_kw: number | null;
  payload_kg: number;
  cargo_volume_m3: number | null;
  purchase_price: number;
  lease_monthly: number | null;
  notes: string | null;
  is_active: boolean;
}

export interface Route {
  id: string;
  project_id: string;
  vehicle_id: string | null;
  route_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  distance_km: number;
  stops: number;
  dwell_time_min: number;
  avg_speed_kmh: number | null;
  payload_kg: number | null;
  depot_id: string | null;
  start_location: string | null;
  end_location: string | null;
  elevation_gain_m: number | null;
  outside_temperature_c: number | null;
  source_type: 'upload' | 'manual' | 'fleet_level';
  consumption_l_100km: number | null;
  trips_per_year: number | null;
  vehicle_count: number | null;
}

export interface Scenario {
  id: string;
  project_id: string;
  name: string;
  type: ScenarioType;
  electrification_pct: number;
  soc_start: number;
  soc_min: number;
  soc_target: number;
  charging_power_kw: number;
  charging_efficiency: number;
  electricity_price: number;
  diesel_price: number;
  grid_emission_factor: number;
  temperature_factor: number;
  allow_public_charging: boolean;
  winter_surcharge: number;
  notes: string | null;
  wallbox_price_eur: number;
  installation_type: InstallationType;
}

export interface Tariff {
  id: string;
  project_id: string;
  name: string;
  type: 'flat' | 'time_of_use';
  flat_price: number | null;
  time_of_use_data: TariffSlot[] | null;
}

export interface TariffSlot {
  from_hour: number;
  to_hour: number;
  price_per_kwh: number;
}

export interface SimulationRun {
  id: string;
  project_id: string;
  scenario_id: string;
  status: SimulationStatus;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// ============================================================
// RESULT TYPES
// ============================================================

export interface ResultSummary {
  id: string;
  simulation_run_id: string;
  total_vehicles: number;
  electrifiable_count: number;
  electrifiable_pct: number;
  annual_fuel_cost_ice: number;
  annual_electricity_cost_ev: number;
  opex_ice: number;
  opex_ev: number;
  tco_ice: number;
  tco_ev: number;
  co2e_ice_t: number;
  co2e_ev_t: number;
  co2e_savings_t: number;
  co2e_savings_pct: number;
  payback_years: number;
  recommended_charger_count: number;
}

export interface RouteResult {
  id: string;
  simulation_run_id: string;
  route_id: string;
  vehicle_id: string | null;
  distance_km: number;
  fuel_use_l: number;
  fuel_cost: number;
  ice_co2e_kg: number;
  ev_energy_kwh: number;
  feasible_without_charging: boolean;
  feasible_with_charging: boolean;
  required_charge_energy_kwh: number;
  annual_cost_delta: number;
  annual_co2e_delta_kg: number;
  start_time: string | null;
  end_time: string | null;
}

export interface InfrastructureEstimate {
  id: string;
  simulation_run_id: string;
  total_ev_count: number;
  daily_energy_demand_kwh: number;
  required_charger_count: number;
  depot_chargers: number;
  public_chargers: number;
  avg_charging_power_kw: number;
  charging_window_hours: number;
  warnings: string[];
  wallbox_price_eur: number;
  installation_cost_per_point: number;
  infra_capex_total: number;
}

export interface VehicleResult {
  vehicle_id: string;
  segment: VehicleSegment;
  count: number;
  recommended_ev_model: EVModel | null;
  feasibility_score: number;
  annual_ice_cost: number;
  annual_ev_cost: number;
  tco_ice: number;
  tco_ev: number;
  tco_savings: number;
  co2e_ice_t: number;
  co2e_ev_t: number;
  co2e_savings_t: number;
  payback_years: number;
  ranking_score: number;
}

// ============================================================
// SIMULATION INPUT/OUTPUT TYPES
// ============================================================

export interface SimulationInput {
  project_id: string;
  scenario_id: string;
  fleet_vehicles: FleetVehicle[];
  routes: Route[];
  ev_models: EVModel[];
  scenario: Scenario;
  fuel_price: number;
  diesel_emission_factor: number; // kg CO2e per liter
  vehicle_lifetime_years: number;
}

export interface FeasibilityResult {
  status: FeasibilityStatus;
  soc_after_tour: number;
  energy_required_kwh: number;
  charge_time_needed_min: number;
  margin_kwh: number;
}

export interface EVMatchResult {
  ev_model: EVModel;
  feasibility: FeasibilityStatus;
  score_smallest_battery: number;
  score_best_tco: number;
  score_best_co2: number;
  score_overall: number;
  adjusted_consumption: number;
  annual_ev_cost: number;
  tco_ev: number;
  co2e_ev_t: number;
}

export interface FleetFeasibilityResult {
  total_routes: number;
  feasible: number;
  feasible_with_charging: number;
  not_feasible: number;
  feasibility_pct: number;
  route_results: RouteResult[];
}

export interface RankedCandidate {
  vehicle: FleetVehicle;
  route: Route | null;
  feasibility_score: number;
  range_buffer_score: number;
  tco_savings_score: number;
  charging_compat_score: number;
  co2_score: number;
  total_score: number;
  rank: number;
  recommended_ev: EVModel | null;
}

export interface InfraEstimate {
  total_ev_count: number;
  daily_energy_demand_kwh: number;
  required_charger_count: number;
  depot_chargers: number;
  public_chargers: number;
  avg_charging_power_kw: number;
  charging_window_hours: number;
  warnings: string[];
}

export interface ConsumptionFactors {
  f_payload: number;
  f_temperature: number;
  f_speed: number;
  f_terrain: number;
  f_hvac: number;
  f_aging: number;
}

export interface SimulationOutput {
  run_id: string;
  summary: ResultSummary;
  route_results: RouteResult[];
  vehicle_results: VehicleResult[];
  infrastructure: InfrastructureEstimate;
  ranked_candidates: RankedCandidate[];
}

// ============================================================
// API TYPES
// ============================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Column mapping for CSV/XLSX upload
export interface ColumnMapping {
  route_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  distance_km?: string;
  stops?: string;
  dwell_time_min?: string;
  avg_speed_kmh?: string;
  payload_kg?: string;
  depot_id?: string;
  start_location?: string;
  end_location?: string;
  elevation_gain_m?: string;
  outside_temperature_c?: string;
  vehicle_id?: string;
}

export interface UploadPreview {
  headers: string[];
  rows: Record<string, string>[];
  total_rows: number;
  errors: string[];
}
