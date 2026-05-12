/**
 * Simulation Orchestrator: Ties together all simulation components
 * Runs a complete simulation for a project/scenario and saves results to DB
 */

import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../database/db';
import {
  Scenario, FleetVehicle, Route, EVModel, FeasibilityStatus,
} from '../../../shared/types';

import {
  calculateEnergyPerTour,
  calculateSocAfterTour,
  calculateGridEnergy,
  calculateElectricityCost,
  calculateEvCO2e,
  calculateAnnualEnergy,
  calculateEvTCO,
} from './evCalculator';

import {
  buildVehiclePhysics,
  simulateRange,
  UsageMix,
} from './physicsEngine';

import {
  calculateFuelConsumption,
  calculateFuelCost,
  calculateIceCO2e,
  calculateIceTCO,
  annualizeCapex,
  calculateAnnualFuelCost,
  DEFAULT_DIESEL_PRICE,
  DEFAULT_DIESEL_EMISSION_FACTOR,
  DEFAULT_LIFETIME_YEARS,
} from './iceCalculator';

import { classifyTour } from './feasibilityEngine';
import { getBestEVMatch } from './matchingEngine';
import { rankCandidates } from './rankingEngine';
import { estimateChargers } from './infrastructureEstimator';

function computeChargingWindowMin(startTime: string | null, endTime: string | null): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some(isNaN)) return null;
  const dep_min = sh * 60 + sm;
  const arr_min = eh * 60 + em;
  const window = (dep_min - arr_min + 1440) % 1440;
  return window === 0 ? 1440 : window;
}

export async function runSimulation(
  runId: string,
  projectId: string,
  scenarioId: string
): Promise<void> {
  // Load all required data
  const [scenarioResult, vehicleResult, routeResult, evModelResult] = await Promise.all([
    query<Scenario>('SELECT * FROM scenarios WHERE id = $1', [scenarioId]),
    query<FleetVehicle>(
      `SELECT fv.* FROM fleet_vehicles fv
       JOIN fleets f ON f.id = fv.fleet_id
       WHERE f.project_id = $1`,
      [projectId]
    ),
    query<Route>(
      'SELECT * FROM routes WHERE project_id = $1 ORDER BY date, route_id',
      [projectId]
    ),
    query<EVModel>('SELECT * FROM ev_models WHERE is_active = TRUE ORDER BY segment, manufacturer'),
  ]);

  if (!scenarioResult.rows.length) {
    throw new Error('Scenario not found');
  }

  const scenario = scenarioResult.rows[0];
  const vehicles = vehicleResult.rows;
  const routes = routeResult.rows;
  const evModels = evModelResult.rows;

  // If no routes, generate synthetic routes from fleet vehicles
  const effectiveRoutes: Route[] = routes.length > 0 ? routes : vehicles.flatMap(v => {
    const dailyKm = v.annual_km / 250;
    return [{
      id: uuidv4(),
      project_id: projectId,
      vehicle_id: v.id,
      route_id: `synthetic_${v.id}`,
      date: new Date().toISOString().split('T')[0],
      start_time: null,
      end_time: null,
      distance_km: dailyKm,
      stops: 3,
      dwell_time_min: 60,
      avg_speed_kmh: 55,
      payload_kg: v.payload_kg ? v.payload_kg * 0.6 : null,
      depot_id: null,
      start_location: null,
      end_location: null,
      elevation_gain_m: null,
      outside_temperature_c: 10,
      source_type: 'manual' as const,
      consumption_l_100km: null,
      trips_per_year: null,
      vehicle_count: null,
    }];
  });

  // Per-route analysis
  const routeResults: {
    route_id: string;
    vehicle_id: string | null;
    vehicle_count: number;
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
    date: string | null;
  }[] = [];

  let total_fuel_l = 0;
  let total_fuel_cost = 0;
  let total_ice_co2e_kg = 0;
  let total_ev_energy_kwh = 0;
  let total_ev_cost = 0;
  let total_ev_co2e_kg = 0;
  let electrifiable_routes = 0;
  let total_route_vehicles = 0;

  for (const route of effectiveRoutes) {
    // Find matching vehicle for this route
    const vehicle = vehicles.find(v => v.id === route.vehicle_id)
      ?? vehicles.find(v => v.fleet_id === route.vehicle_id)
      ?? vehicles[0];

    if (!vehicle) continue;

    // vehicle_count: how many vehicles follow this route pattern (default 1)
    const vehicle_count = route.vehicle_count ?? 1;
    total_route_vehicles += vehicle_count;

    // Compute effective dwell_time: use stored value if > 0, else derive from departure/arrival times
    const computed_dwell = route.dwell_time_min > 0
      ? route.dwell_time_min
      : (computeChargingWindowMin(route.start_time, route.end_time) ?? 60);
    const routeWithDwell = computed_dwell !== route.dwell_time_min
      ? { ...route, dwell_time_min: computed_dwell }
      : route;

    // Determine consumption: use route-specific value if available (from CSV), else vehicle default
    const consumption_l_100km = route.consumption_l_100km ?? vehicle.consumption_l_100km;

    // ICE calculations
    const fuel_l = calculateFuelConsumption(route.distance_km, consumption_l_100km);
    const diesel_price = scenario.diesel_price ?? DEFAULT_DIESEL_PRICE;
    const fuel_cost = calculateFuelCost(fuel_l, diesel_price);
    const ice_co2e_kg = calculateIceCO2e(fuel_l, DEFAULT_DIESEL_EMISSION_FACTOR);

    // Scale to annual:
    // - If route has explicit trips_per_year → use it
    // - If routes come from CSV upload → each row = 1 trip/year (total km = sum of all rows)
    // - Otherwise (synthetic/fleet_level) → infer from annual_km / route distance
    const annual_trips = route.trips_per_year
      ? route.trips_per_year
      : route.source_type === 'upload'
        ? 1
        : vehicle.annual_km > 0 ? Math.round(vehicle.annual_km / route.distance_km) : 250;
    const annual_fuel_cost = fuel_cost * annual_trips;
    const annual_ice_co2e = ice_co2e_kg * annual_trips;

    total_fuel_l += fuel_l * annual_trips * vehicle_count;
    total_fuel_cost += annual_fuel_cost * vehicle_count;
    total_ice_co2e_kg += annual_ice_co2e * vehicle_count;

    // EV calculations - find best match
    const bestMatch = getBestEVMatch(vehicle, evModels, scenario);

    let ev_energy_kwh = 0;
    let feasible_without = false;
    let feasible_with = false;
    let required_charge_kwh = 0;
    let ev_annual_cost = 0;
    let ev_co2e_annual = 0;

    if (bestMatch) {
      // FEASIBILITY: uses SOC to check if the vehicle can complete the route.
      // soc_start → energy consumed (ev_model.consumption × distance) → soc_end → check soc_end >= soc_min
      // SOC does NOT determine energy cost — it is only a pass/fail check.
      const feasResult = classifyTour(routeWithDwell, bestMatch.ev_model, scenario);
      feasible_without = feasResult.status === FeasibilityStatus.FEASIBLE;
      feasible_with = feasResult.status === FeasibilityStatus.FEASIBLE_WITH_CHARGING || feasible_without;
      required_charge_kwh = feasResult.energy_required_kwh;

      // ENERGY COST: physicsEngine with per-route sim conditions (temperature, HVAC, usage mix).
      // Falls back to route.outside_temperature_c and calibration defaults when sim_* not set.
      const routeMix: UsageMix = {
        city_share:  route.sim_city_share  ?? 0.5,
        rural_share: route.sim_rural_share ?? 0.3,
        hwy_share:   route.sim_hwy_share   ?? 0.2,
      };
      const routeTemp  = route.sim_temperature_c  ?? route.outside_temperature_c ?? 15;
      const routeHvac  = route.sim_hvac_on        ?? false;
      const vehiclePhysics = buildVehiclePhysics(
        bestMatch.ev_model.battery_usable_kwh,
        bestMatch.ev_model.nominal_consumption_kwh_100km,
        bestMatch.ev_model.segment ?? vehicle.segment,
        route.payload_kg ?? 0
      );
      const physResult = simulateRange(vehiclePhysics, routeMix, routeTemp, routeHvac);
      ev_energy_kwh = calculateEnergyPerTour(route.distance_km, physResult.consumption_kwh_per_100km);

      const grid_energy = calculateGridEnergy(ev_energy_kwh, scenario.charging_efficiency);
      const ev_trip_cost = calculateElectricityCost(grid_energy, scenario.electricity_price);
      ev_co2e_annual = calculateEvCO2e(grid_energy * annual_trips, scenario.grid_emission_factor);
      // NOTE: maintenance is NOT added here — it is added once at fleet level (like ICE).
      ev_annual_cost = ev_trip_cost * annual_trips;

      if (feasible_with) electrifiable_routes += vehicle_count;
    }

    total_ev_energy_kwh += ev_energy_kwh * annual_trips * vehicle_count;
    total_ev_cost += ev_annual_cost * vehicle_count;
    total_ev_co2e_kg += ev_co2e_annual * vehicle_count;

    // Per-route delta: energy/fuel costs only (maintenance is fleet-level, not per route)
    const annual_cost_delta = ev_annual_cost - annual_fuel_cost;
    const annual_co2e_delta = ev_co2e_annual - annual_ice_co2e;

    routeResults.push({
      route_id: route.route_id,
      vehicle_id: route.vehicle_id,
      vehicle_count,
      distance_km: route.distance_km,
      fuel_use_l: fuel_l * annual_trips,
      fuel_cost: annual_fuel_cost,
      ice_co2e_kg: annual_ice_co2e,
      ev_energy_kwh: ev_energy_kwh * annual_trips,
      feasible_without_charging: feasible_without,
      feasible_with_charging: feasible_with,
      required_charge_energy_kwh: required_charge_kwh,
      annual_cost_delta,
      annual_co2e_delta_kg: annual_co2e_delta,
      start_time: route.start_time ?? null,
      end_time: route.end_time ?? null,
      date: route.date ?? null,
    });
  }

  // Fleet-level TCO
  const total_vehicles = vehicles.reduce((sum, v) => sum + v.count, 0);
  // electrifiable_routes is already a vehicle count (weighted by vehicle_count per route)
  const electrifiable_base = total_route_vehicles > 0 ? total_route_vehicles : total_vehicles;
  const electrifiable_count = electrifiable_routes; // already weighted by vehicle_count
  const electrifiable_pct = electrifiable_base > 0 ? (electrifiable_routes / electrifiable_base) * 100 : 0;

  // Aggregate OpEx
  // Maintenance is added once per fleet vehicle (not per route) for both ICE and EV — symmetric treatment.
  // Maintenance uses total_route_vehicles as the actual fleet size
  const maintenanceScale = (() => {
    const fleetCount = vehicles.reduce((s, v) => s + v.count, 0);
    return fleetCount > 0 && total_route_vehicles > 0 ? total_route_vehicles / fleetCount : 1;
  })();
  const ice_maintenance_total = vehicles.reduce((sum, v) => sum + v.maintenance_cost_annual * v.count * maintenanceScale, 0);
  const ev_maintenance_total  = vehicles.reduce((sum, v) => sum + v.maintenance_cost_annual * 0.6 * v.count * maintenanceScale, 0);
  const opex_ice = total_fuel_cost + ice_maintenance_total;
  const opex_ev = total_ev_cost + ev_maintenance_total;

  // TCO (using vehicle CAPEX)
  // fleet_vehicles.count can be 1 (UI default) even when routes have vehicle_count > 1.
  // Scale CAPEX by total_route_vehicles so it matches actual fleet size.
  const totalFleetVehicleCount = vehicles.reduce((s, v) => s + v.count, 0);
  const capexScaleFactor = totalFleetVehicleCount > 0 && total_route_vehicles > 0
    ? total_route_vehicles / totalFleetVehicleCount
    : 1;

  const ice_capex_annual = vehicles.reduce((sum, v) => {
    const capex = v.capex ? annualizeCapex(v.capex) : (v.lease_monthly ?? 0) * 12;
    return sum + capex * v.count * capexScaleFactor;
  }, 0);

  // EV CAPEX — same scale factor applied
  const ev_capex_annual = vehicles.reduce((sum, v) => {
    const bestMatch = getBestEVMatch(v, evModels, scenario);
    if (!bestMatch?.ev_model) return sum;
    const ev = bestMatch.ev_model;
    const capex = ev.purchase_price ? annualizeCapex(ev.purchase_price) : (ev.lease_monthly ?? 0) * 12;
    return sum + capex * v.count * capexScaleFactor;
  }, 0);

  // Infrastructure estimation (must come before TCO to include infra_capex_total)
  const daily_energy_demand = total_ev_energy_kwh / 250;
  const dwell_times = effectiveRoutes.map(r => r.dwell_time_min);
  const infraEstimate = estimateChargers(
    electrifiable_count,
    daily_energy_demand,
    dwell_times,
    scenario.charging_power_kw,
    0.80,
    10,
    scenario.charging_efficiency
  );

  const INSTALLATION_COST_MAP: Record<string, number> = {
    simple: 1000,
    standard: 3500,
    aufwendig: 8000,
  };

  const wallbox_price = Number(scenario.wallbox_price_eur) || 1200;
  const installation_cost_per_point = INSTALLATION_COST_MAP[scenario.installation_type as string] ?? 3500;
  const infra_capex_total = infraEstimate.required_charger_count * (wallbox_price + installation_cost_per_point);

  const tco_ice = (ice_capex_annual + opex_ice) * DEFAULT_LIFETIME_YEARS;
  const tco_ev = (ev_capex_annual + opex_ev) * DEFAULT_LIFETIME_YEARS + infra_capex_total;

  const co2e_ice_t = total_ice_co2e_kg / 1000;
  const co2e_ev_t = total_ev_co2e_kg / 1000;
  const co2e_savings_t = co2e_ice_t - co2e_ev_t;
  const co2e_savings_pct = co2e_ice_t > 0 ? (co2e_savings_t / co2e_ice_t) * 100 : 0;

  // Payback
  const capex_incremental = (ev_capex_annual - ice_capex_annual) * DEFAULT_LIFETIME_YEARS + infra_capex_total;
  const annual_opex_savings = opex_ice - opex_ev;
  const payback_years = annual_opex_savings > 0 ? capex_incremental / annual_opex_savings : 999;

  // Save results to DB in transaction
  await withTransaction(async (client) => {
    // Save summary
    const summaryId = uuidv4();
    await client.query(
      `INSERT INTO result_summaries
        (id, simulation_run_id, total_vehicles, electrifiable_count, electrifiable_pct,
         annual_fuel_cost_ice, annual_electricity_cost_ev, opex_ice, opex_ev,
         tco_ice, tco_ev, co2e_ice_t, co2e_ev_t, co2e_savings_t, co2e_savings_pct,
         payback_years, recommended_charger_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        summaryId, runId, total_vehicles, electrifiable_count,
        Math.round(electrifiable_pct * 100) / 100,
        Math.round(total_fuel_cost), Math.round(total_ev_cost),
        Math.round(opex_ice), Math.round(opex_ev),
        Math.round(tco_ice), Math.round(tco_ev),
        Math.round(co2e_ice_t * 1000) / 1000, Math.round(co2e_ev_t * 1000) / 1000,
        Math.round(co2e_savings_t * 1000) / 1000,
        Math.round(co2e_savings_pct * 100) / 100,
        Math.min(payback_years, 999),
        infraEstimate.required_charger_count,
      ]
    );

    // Save route results (batch insert)
    for (const rr of routeResults) {
      const rrId = uuidv4();
      await client.query(
        `INSERT INTO route_results
          (id, simulation_run_id, route_id, vehicle_id, vehicle_count, distance_km, fuel_use_l, fuel_cost,
           ice_co2e_kg, ev_energy_kwh, feasible_without_charging, feasible_with_charging,
           required_charge_energy_kwh, annual_cost_delta, annual_co2e_delta_kg,
           start_time, end_time, date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          rrId, runId, rr.route_id, rr.vehicle_id, rr.vehicle_count ?? 1,
          rr.distance_km, rr.fuel_use_l, rr.fuel_cost,
          rr.ice_co2e_kg, rr.ev_energy_kwh,
          rr.feasible_without_charging, rr.feasible_with_charging,
          rr.required_charge_energy_kwh, rr.annual_cost_delta, rr.annual_co2e_delta_kg,
          rr.start_time, rr.end_time, rr.date,
        ]
      );
    }

    // Save infrastructure estimate
    const infraId = uuidv4();
    await client.query(
      `INSERT INTO infrastructure_estimates
        (id, simulation_run_id, total_ev_count, daily_energy_demand_kwh, required_charger_count,
         depot_chargers, public_chargers, avg_charging_power_kw, charging_window_hours, warnings,
         wallbox_price_eur, installation_cost_per_point, infra_capex_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        infraId, runId,
        infraEstimate.total_ev_count,
        Math.round(infraEstimate.daily_energy_demand_kwh * 10) / 10,
        infraEstimate.required_charger_count,
        infraEstimate.depot_chargers,
        infraEstimate.public_chargers,
        infraEstimate.avg_charging_power_kw,
        infraEstimate.charging_window_hours,
        JSON.stringify(infraEstimate.warnings),
        wallbox_price, installation_cost_per_point, Math.round(infra_capex_total),
      ]
    );
  });

  console.log(`Simulation ${runId} completed: ${total_vehicles} vehicles, ${electrifiable_count} electrifiable (${electrifiable_pct.toFixed(1)}%)`);
}
