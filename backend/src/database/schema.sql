-- Fleet Electrification Platform Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'DE',
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  fleet_type VARCHAR(100),
  industry VARCHAR(100),
  depot_location VARCHAR(255),
  charging_options TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- ============================================================
-- FLEETS
-- ============================================================
CREATE TABLE IF NOT EXISTS fleets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX idx_fleets_project_id ON fleets(project_id);

-- ============================================================
-- FLEET VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fleet_id UUID NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  segment VARCHAR(50) NOT NULL,
  fuel_type VARCHAR(20) NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  consumption_l_100km DECIMAL(6,2),
  annual_km DECIMAL(10,2),
  payload_kg DECIMAL(8,2),
  maintenance_cost_annual DECIMAL(10,2),
  acquisition_type VARCHAR(20) NOT NULL DEFAULT 'purchase',
  capex DECIMAL(12,2),
  lease_monthly DECIMAL(10,2)
);

CREATE INDEX idx_fleet_vehicles_fleet_id ON fleet_vehicles(fleet_id);

-- ============================================================
-- EV MODELS
-- ============================================================
CREATE TABLE IF NOT EXISTS ev_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manufacturer VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  segment VARCHAR(50) NOT NULL,
  battery_gross_kwh DECIMAL(8,2) NOT NULL,
  battery_usable_kwh DECIMAL(8,2) NOT NULL,
  nominal_consumption_kwh_100km DECIMAL(6,2) NOT NULL,
  max_ac_kw DECIMAL(6,2) NOT NULL,
  max_dc_kw DECIMAL(6,2),
  payload_kg DECIMAL(8,2),
  cargo_volume_m3 DECIMAL(6,2),
  purchase_price DECIMAL(12,2),
  lease_monthly DECIMAL(10,2),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ev_models_segment ON ev_models(segment);
CREATE INDEX idx_ev_models_active ON ev_models(is_active);

-- ============================================================
-- ROUTES (TOUR DATA)
-- ============================================================
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vehicle_id VARCHAR(100),
  route_id VARCHAR(100) NOT NULL,
  date DATE,
  start_time TIME,
  end_time TIME,
  distance_km DECIMAL(10,2) NOT NULL,
  stops INTEGER NOT NULL DEFAULT 0,
  dwell_time_min DECIMAL(8,2) NOT NULL DEFAULT 0,
  avg_speed_kmh DECIMAL(6,2),
  payload_kg DECIMAL(8,2),
  depot_id VARCHAR(100),
  start_location VARCHAR(255),
  end_location VARCHAR(255),
  elevation_gain_m DECIMAL(8,2),
  outside_temperature_c DECIMAL(5,2),
  source_type VARCHAR(20) NOT NULL DEFAULT 'upload',
  consumption_l_100km DECIMAL(6,3),
  trips_per_year INTEGER,
  vehicle_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_routes_project_id ON routes(project_id);
CREATE INDEX idx_routes_vehicle_id ON routes(vehicle_id);
CREATE INDEX idx_routes_date ON routes(date);

-- ============================================================
-- SCENARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'custom',
  electrification_pct DECIMAL(5,2) NOT NULL DEFAULT 100,
  soc_start DECIMAL(5,2) NOT NULL DEFAULT 90,
  soc_min DECIMAL(5,2) NOT NULL DEFAULT 20,
  soc_target DECIMAL(5,2) NOT NULL DEFAULT 80,
  charging_power_kw DECIMAL(8,2) NOT NULL DEFAULT 22,
  charging_efficiency DECIMAL(5,3) NOT NULL DEFAULT 0.92,
  electricity_price DECIMAL(8,4) NOT NULL DEFAULT 0.25,
  diesel_price DECIMAL(8,4) NOT NULL DEFAULT 1.75,
  grid_emission_factor DECIMAL(8,4) NOT NULL DEFAULT 0.380,
  temperature_factor DECIMAL(5,3) NOT NULL DEFAULT 1.0,
  allow_public_charging BOOLEAN NOT NULL DEFAULT FALSE,
  winter_surcharge DECIMAL(5,3) NOT NULL DEFAULT 0.15,
  notes TEXT
);

CREATE INDEX idx_scenarios_project_id ON scenarios(project_id);

-- ============================================================
-- TARIFFS
-- ============================================================
CREATE TABLE IF NOT EXISTS tariffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'flat',
  flat_price DECIMAL(8,4),
  time_of_use_data JSONB
);

CREATE INDEX idx_tariffs_project_id ON tariffs(project_id);

-- ============================================================
-- SIMULATION RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_simulation_runs_project_id ON simulation_runs(project_id);
CREATE INDEX idx_simulation_runs_scenario_id ON simulation_runs(scenario_id);
CREATE INDEX idx_simulation_runs_status ON simulation_runs(status);

-- ============================================================
-- RESULT SUMMARIES
-- ============================================================
CREATE TABLE IF NOT EXISTS result_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  total_vehicles INTEGER NOT NULL DEFAULT 0,
  electrifiable_count INTEGER NOT NULL DEFAULT 0,
  electrifiable_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  annual_fuel_cost_ice DECIMAL(14,2) NOT NULL DEFAULT 0,
  annual_electricity_cost_ev DECIMAL(14,2) NOT NULL DEFAULT 0,
  opex_ice DECIMAL(14,2) NOT NULL DEFAULT 0,
  opex_ev DECIMAL(14,2) NOT NULL DEFAULT 0,
  tco_ice DECIMAL(14,2) NOT NULL DEFAULT 0,
  tco_ev DECIMAL(14,2) NOT NULL DEFAULT 0,
  co2e_ice_t DECIMAL(12,3) NOT NULL DEFAULT 0,
  co2e_ev_t DECIMAL(12,3) NOT NULL DEFAULT 0,
  co2e_savings_t DECIMAL(12,3) NOT NULL DEFAULT 0,
  co2e_savings_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  payback_years DECIMAL(6,2),
  recommended_charger_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_result_summaries_run_id ON result_summaries(simulation_run_id);

-- ============================================================
-- ROUTE RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS route_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  route_id VARCHAR(100) NOT NULL,
  vehicle_id VARCHAR(100),
  distance_km DECIMAL(10,2) NOT NULL DEFAULT 0,
  fuel_use_l DECIMAL(10,3) NOT NULL DEFAULT 0,
  fuel_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  ice_co2e_kg DECIMAL(10,3) NOT NULL DEFAULT 0,
  ev_energy_kwh DECIMAL(10,3) NOT NULL DEFAULT 0,
  feasible_without_charging BOOLEAN NOT NULL DEFAULT FALSE,
  feasible_with_charging BOOLEAN NOT NULL DEFAULT FALSE,
  required_charge_energy_kwh DECIMAL(10,3) NOT NULL DEFAULT 0,
  annual_cost_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
  annual_co2e_delta_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  start_time VARCHAR(8) DEFAULT NULL,
  end_time VARCHAR(8) DEFAULT NULL,
  date DATE DEFAULT NULL
);

CREATE INDEX idx_route_results_run_id ON route_results(simulation_run_id);

-- ============================================================
-- INFRASTRUCTURE ESTIMATES
-- ============================================================
CREATE TABLE IF NOT EXISTS infrastructure_estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  total_ev_count INTEGER NOT NULL DEFAULT 0,
  daily_energy_demand_kwh DECIMAL(12,2) NOT NULL DEFAULT 0,
  required_charger_count INTEGER NOT NULL DEFAULT 0,
  depot_chargers INTEGER NOT NULL DEFAULT 0,
  public_chargers INTEGER NOT NULL DEFAULT 0,
  avg_charging_power_kw DECIMAL(8,2) NOT NULL DEFAULT 0,
  charging_window_hours DECIMAL(5,2) NOT NULL DEFAULT 8,
  warnings JSONB DEFAULT '[]'
);

CREATE INDEX idx_infra_estimates_run_id ON infrastructure_estimates(simulation_run_id);

-- ============================================================
-- FUNCTION: update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
