// LP-based charging optimizer using javascript-lp-solver (CJS-compatible).
// Minimizes total charging cost subject to SOC, wallbox, and GCP constraints.
//
// NOTE: glpk.js is ESM-only and incompatible with ts-node CJS output.
// javascript-lp-solver is used instead; it wraps a revised simplex method.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const solver = require('javascript-lp-solver');

export interface ChargingVehicle {
  id: string;
  name: string;
  battery_kwh: number;
  max_charge_power_kw: number;
  charging_efficiency: number; // e.g. 0.92
  soc_arrival_pct: number;
  soc_target_pct: number;
  soc_min_pct: number;
  arrival_interval: number;        // 0-95 (15-min slot index)
  departure_interval: number;      // 0-95 or 96 (LP solver — can be 96 for overnight)
  departure_interval_raw?: number; // 0-95 display value passed through to result (Gantt)
}

export interface OptimizationInput {
  vehicles: ChargingVehicle[];
  prices_15min: number[]; // 96 values in €/kWh
  gcp_max_kw: number;
  date: string;
  depot_profile_kw?: number[]; // optional 96-value depot background load [kW]
}

export interface VehicleOptResult {
  vehicle_id: string;
  vehicle_name: string;
  schedule_kw: number[];     // 96 values
  soc_curve_pct: number[];   // 97 values (initial + 96 end-of-interval)
  energy_kwh: number;        // grid energy drawn (incl. charging losses)
  battery_energy_kwh: number; // energy stored in battery (= route consumption)
  cost_eur: number;
  arrival_interval?: number;
  departure_interval?: number;
  departure_interval_raw?: number; // 0-95 display value (departure_interval can be 96 for overnight)
}

export interface OptimizationResult {
  status: 'optimal' | 'infeasible' | 'error';
  vehicles: VehicleOptResult[];
  total_cost_eur: number;
  total_energy_kwh: number;
  fleet_power_kw: number[];         // 96 values — optimized EV charging
  naive_fleet_power_kw: number[];   // 96 values — immediate (greedy) charging
  naive_total_cost_eur: number;     // cost if charging immediately on arrival
  depot_profile_kw?: number[];      // 96 values — background depot load (if provided)
  computation_time_ms: number;
  date: string;
  prices_15min: number[];
}

/** Simulate greedy (immediate) charging as baseline for cost comparison. */
function computeNaiveCharging(
  vehicles: ChargingVehicle[],
  prices_15min: number[],
  gcp_max_kw: number,
): { naive_total_cost_eur: number; naive_fleet_power_kw: number[] } {
  const fleetPower = Array(N_INTERVALS).fill(0);
  let totalCost = 0;

  for (const veh of vehicles) {
    let soc = veh.soc_arrival_pct;
    const arr = Math.max(0, Math.min(veh.arrival_interval, N_INTERVALS - 1));
    const dep = Math.max(1, Math.min(veh.departure_interval, N_INTERVALS));

    for (let t = arr; t < dep; t++) {
      if (soc >= veh.soc_target_pct) break;
      const gcpHeadroom = Math.max(0, gcp_max_kw - fleetPower[t]);
      const socNeeded = veh.soc_target_pct - soc;
      const gridEnergyNeeded = (socNeeded / 100) * veh.battery_kwh / veh.charging_efficiency;
      const p = Math.min(veh.max_charge_power_kw, gridEnergyNeeded / DT, gcpHeadroom);
      if (p > 0.001) {
        fleetPower[t] += p;
        soc = Math.min(100, soc + (p * DT * veh.charging_efficiency / veh.battery_kwh) * 100);
        totalCost += p * DT * prices_15min[t];
      }
    }
  }
  return { naive_total_cost_eur: totalCost, naive_fleet_power_kw: fleetPower };
}

const DT = 0.25; // 15 min = 0.25 h
const N_INTERVALS = 96;

/**
 * Solve the charging optimization LP.
 *
 * Because javascript-lp-solver uses a named-variable JSON model,
 * we build the model with:
 *   - Decision vars: P_v_t  (charging power [kW] for vehicle v at interval t)
 *   - SOC computed analytically from P schedule after solving
 *   - Constraints: GCP, wallbox upper bounds, SOC target as post-check
 *
 * For SOC target feasibility we use a greedy post-check and adjust.
 */
export async function solveChargingOptimization(input: OptimizationInput): Promise<OptimizationResult> {
  const startTime = Date.now();
  const { vehicles, prices_15min, gcp_max_kw, date, depot_profile_kw } = input;

  if (vehicles.length === 0) {
    return {
      status: 'optimal',
      vehicles: [],
      total_cost_eur: 0,
      total_energy_kwh: 0,
      fleet_power_kw: Array(96).fill(0),
      naive_fleet_power_kw: Array(96).fill(0),
      naive_total_cost_eur: 0,
      computation_time_ms: 0,
      date,
      prices_15min,
    };
  }

  try {
    // javascript-lp-solver model format:
    // {
    //   optimize: 'cost',
    //   opType: 'min',
    //   constraints: { varName: { min: x, max: y } },
    //   variables: { varName: { cost: c, gcpT: 1, ... } }
    // }

    const variables: Record<string, Record<string, number>> = {};
    const constraints: Record<string, { min?: number; max?: number }> = {};

    // GCP constraints: sum_v P[v,t] <= gcp_max_kw - depot_load[t] for each t
    // If depot_profile_kw provided, reserve that headroom for existing depot load.
    for (let t = 0; t < N_INTERVALS; t++) {
      const depotLoad = depot_profile_kw?.[t] ?? 0;
      const available = Math.max(0, gcp_max_kw - depotLoad);
      constraints[`gcp_${t}`] = { max: available };
    }

    // For each vehicle, add minimum energy constraint
    // energy_v = sum_t P[v,t]*DT >= energy_needed[v]
    for (let v = 0; v < vehicles.length; v++) {
      const veh = vehicles[v];
      const socNeeded = Math.max(0, veh.soc_target_pct - veh.soc_arrival_pct);
      const energyNeeded = (socNeeded / 100) * veh.battery_kwh / veh.charging_efficiency;
      constraints[`energy_min_${v}`] = { min: energyNeeded };
      constraints[`energy_max_${v}`] = { max: (100 / 100) * veh.battery_kwh / veh.charging_efficiency * 1.1 };
    }

    // Build variables
    for (let v = 0; v < vehicles.length; v++) {
      const veh = vehicles[v];
      for (let t = 0; t < N_INTERVALS; t++) {
        const varName = `P_${v}_${t}`;
        const connected = t >= veh.arrival_interval && t < veh.departure_interval;

        if (!connected) {
          // Fixed at 0 — add as constraint
          constraints[`fix_${v}_${t}`] = { min: 0, max: 0 };
        }

        // Variable definition
        const varDef: Record<string, number> = {
          cost: prices_15min[t] * DT, // objective coefficient
        };

        // Contribute to GCP constraint at time t
        varDef[`gcp_${t}`] = 1;

        // Contribute to vehicle energy constraints
        varDef[`energy_min_${v}`] = DT;
        varDef[`energy_max_${v}`] = DT;

        // If not connected, add to fix constraint
        if (!connected) {
          varDef[`fix_${v}_${t}`] = 1;
        }

        variables[varName] = varDef;

        // Variable bounds
        if (connected) {
          constraints[`ub_${v}_${t}`] = { max: veh.max_charge_power_kw };
          varDef[`ub_${v}_${t}`] = 1;
        }
      }
    }

    const model = {
      optimize: 'cost',
      opType: 'min',
      constraints,
      variables,
    };

    const result = solver.Solve(model);

    // Naive charging baseline (always computed regardless of feasibility)
    const { naive_total_cost_eur, naive_fleet_power_kw } =
      computeNaiveCharging(vehicles, prices_15min, gcp_max_kw);

    // Check feasibility
    if (!result.feasible) {
      return {
        status: 'infeasible',
        vehicles: [],
        total_cost_eur: 0,
        total_energy_kwh: 0,
        fleet_power_kw: Array(96).fill(0),
        naive_fleet_power_kw,
        naive_total_cost_eur,
        ...(depot_profile_kw ? { depot_profile_kw } : {}),
        computation_time_ms: Date.now() - startTime,
        date,
        prices_15min,
      };
    }

    // Extract per-vehicle results
    const vehicleResults: VehicleOptResult[] = vehicles.map((veh, v) => {
      const schedule_kw: number[] = [];
      let socCurrent = veh.soc_arrival_pct;
      const soc_curve_pct: number[] = [socCurrent];
      const eta = veh.charging_efficiency;

      for (let t = 0; t < N_INTERVALS; t++) {
        const varName = `P_${v}_${t}`;
        const p = Math.max(0, result[varName] ?? 0);
        schedule_kw.push(p);

        // Update SOC
        const socDelta = (p * DT * eta / veh.battery_kwh) * 100;
        socCurrent = Math.min(100, Math.max(0, socCurrent + socDelta));
        soc_curve_pct.push(socCurrent);
      }

      const energy_kwh = schedule_kw.reduce((sum, p) => sum + p * DT, 0);            // grid energy
      const battery_energy_kwh = energy_kwh * eta;                                    // stored in battery
      const cost_eur = schedule_kw.reduce((sum, p, t) => sum + p * DT * prices_15min[t], 0);

      return {
        vehicle_id: veh.id,
        vehicle_name: veh.name,
        schedule_kw,
        soc_curve_pct,
        energy_kwh,
        battery_energy_kwh,
        cost_eur,
        arrival_interval:        veh.arrival_interval,
        departure_interval:      veh.departure_interval,
        departure_interval_raw:  veh.departure_interval_raw,
      };
    });

    const fleet_power_kw = Array(N_INTERVALS).fill(0).map((_, t) =>
      vehicleResults.reduce((sum, vr) => sum + vr.schedule_kw[t], 0)
    );

    const total_cost_eur = vehicleResults.reduce((s, vr) => s + vr.cost_eur, 0);
    const total_energy_kwh = vehicleResults.reduce((s, vr) => s + vr.energy_kwh, 0);

    return {
      status: 'optimal',
      vehicles: vehicleResults,
      total_cost_eur,
      total_energy_kwh,
      fleet_power_kw,
      naive_fleet_power_kw,
      naive_total_cost_eur,
      computation_time_ms: Date.now() - startTime,
      date,
      prices_15min,
    };
  } catch (err) {
    console.error('LP solver error:', err);
    const { naive_total_cost_eur, naive_fleet_power_kw } =
      computeNaiveCharging(vehicles, prices_15min, gcp_max_kw);
    return {
      status: 'error',
      vehicles: [],
      total_cost_eur: 0,
      total_energy_kwh: 0,
      fleet_power_kw: Array(96).fill(0),
      naive_fleet_power_kw,
      naive_total_cost_eur,
      computation_time_ms: Date.now() - startTime,
      date,
      prices_15min,
    };
  }
}
