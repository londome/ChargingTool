// MILP-based EV Fleet V2G (Vehicle-to-Grid) arbitrage optimizer.
// The EV fleet arrives at the depot and can:
//   - Charge (buy from grid) when prices are low
//   - Discharge back to grid (V2G) when prices are high
// Only active within the connected window: arrival_interval → departure_interval
//
// Decision variables per interval t (0..95):
//   Pc_t  >= 0   charging power [kW]  from grid to battery
//   Pd_t  >= 0   discharging power [kW]  from battery to grid (V2G)
//   b_t   in {0,1}   1 = charging mode, 0 = discharging mode

// eslint-disable-next-line @typescript-eslint/no-require-imports
const solver = require('javascript-lp-solver');

export interface ArbitrageInput {
  prices_15min: number[];       // 96 values €/kWh
  battery_kwh: number;          // usable EV battery capacity kWh
  max_power_kw: number;         // min(wallbox_power_kw, ev.max_ac_kw)
  eta_c: number;                // charging efficiency e.g. 0.92
  eta_d: number;                // discharging efficiency e.g. 0.92
  soc_initial_pct: number;      // SOC at arrival (computed from route energy)
  soc_min_pct: number;          // min SOC % floor e.g. 20
  soc_max_pct: number;          // max SOC % ceiling = 100
  gcp_max_kw: number;           // grid connection limit kW
  arrival_interval: number;     // 0-95, interval when fleet connects at depot
  departure_interval: number;   // 1-96, interval when fleet must leave (clamped to 96)
  soc_final_pct: number;        // SOC that must be reached before departure (= soc_target)
  date: string;
}

export interface ArbitrageResult {
  status: 'optimal' | 'infeasible' | 'error';
  schedule_charge_kw: number[];         // 96 values — V2G optimized
  schedule_discharge_kw: number[];      // 96 values — V2G optimized
  net_grid_kw: number[];                // 96 values: +charge, -discharge
  soc_curve_pct: number[];              // 97 values (initial + 96 end-of-interval)
  reference_charge_kw: number[];        // 96 values — greedy charge-only baseline
  reference_soc_curve_pct: number[];    // 97 values — SOC curve for reference plan
  total_revenue_eur: number;
  total_cost_eur: number;
  net_profit_eur: number;
  charge_only_cost_eur: number;         // baseline cost (greedy charging)
  computation_time_ms: number;
  date: string;
  prices_15min: number[];
  cycles: number;
}

const DT = 0.25; // 15 min = 0.25 h
const N = 96;    // intervals per day

export async function solveArbitrage(input: ArbitrageInput): Promise<ArbitrageResult> {
  const startTime = Date.now();
  const {
    prices_15min,
    battery_kwh,
    max_power_kw,
    eta_c,
    eta_d,
    soc_initial_pct,
    soc_min_pct,
    soc_max_pct,
    gcp_max_kw,
    arrival_interval,
    departure_interval,
    soc_final_pct,
    date,
  } = input;

  // Greedy charge-only baseline (no V2G) — returns schedule, SOC curve and cost
  const computeChargeOnly = (): {
    cost: number;
    schedule_kw: number[];
    soc_curve: number[];
  } => {
    let soc = soc_initial_pct;
    let cost = 0;
    const schedule_kw = Array(N).fill(0);
    const soc_curve: number[] = [soc_initial_pct];
    for (let t = 0; t < N; t++) {
      const inWindow = t >= arrival_interval && t < departure_interval;
      if (inWindow && soc < soc_final_pct) {
        const socNeeded = soc_final_pct - soc;
        const gridEnergyNeeded = (socNeeded / 100) * battery_kwh / eta_c;
        const p = Math.min(max_power_kw, gridEnergyNeeded / DT, gcp_max_kw);
        if (p > 0.001) {
          schedule_kw[t] = p;
          soc = Math.min(soc_max_pct, soc + (p * DT * eta_c / battery_kwh) * 100);
          cost += p * DT * prices_15min[t];
        }
      }
      soc_curve.push(soc);
    }
    return { cost, schedule_kw, soc_curve };
  };

  const empty = (): ArbitrageResult => {
    const ref = computeChargeOnly();
    return {
      status: 'error',
      schedule_charge_kw: Array(N).fill(0),
      schedule_discharge_kw: Array(N).fill(0),
      net_grid_kw: Array(N).fill(0),
      soc_curve_pct: Array(N + 1).fill(soc_initial_pct),
      reference_charge_kw: ref.schedule_kw,
      reference_soc_curve_pct: ref.soc_curve,
      total_revenue_eur: 0,
      total_cost_eur: 0,
      net_profit_eur: 0,
      charge_only_cost_eur: ref.cost,
      computation_time_ms: Date.now() - startTime,
      date,
      prices_15min,
      cycles: 0,
    };
  };

  try {
    // SOC contribution coefficients
    const socCoeffCharge    = (eta_c * DT / battery_kwh) * 100;
    const socCoeffDischarge = (DT / battery_kwh) * 100;

    const variables:   Record<string, Record<string, number>> = {};
    const constraints: Record<string, { min?: number; max?: number }> = {};
    const binaries:    Record<string, number> = {};

    // Pre-declare SOC cumulative upper/lower constraints for all 96 intervals
    for (let t = 0; t < N; t++) {
      constraints[`soc_upper_${t}`] = { max: soc_max_pct - soc_initial_pct };
      constraints[`soc_lower_${t}`] = { min: soc_min_pct - soc_initial_pct };
    }

    // Final SOC constraint: cumulative SOC change from arrival to departure must reach soc_final_pct
    // Σ_{t=arrival}^{departure-1} (Pc_t * η_c - Pd_t) * DT / battery_kwh * 100 ≥ soc_final_pct - soc_initial_pct
    constraints['soc_final_min'] = { min: soc_final_pct - soc_initial_pct };

    for (let t = 0; t < N; t++) {
      const price = prices_15min[t];
      const inWindow = t >= arrival_interval && t < departure_interval;

      // ── Binary variable b_t ──────────────────────────────────────────────────
      const bName = `b_${t}`;
      binaries[bName] = 1;

      if (inWindow) {
        constraints[`charge_ub_${t}`]    = { max: 0 };
        constraints[`discharge_ub_${t}`] = { max: max_power_kw };
        constraints[`gcp_c_${t}`]        = { max: gcp_max_kw };
        constraints[`gcp_d_${t}`]        = { max: gcp_max_kw };

        variables[bName] = {
          profit: 0,
          [`charge_ub_${t}`]:    -max_power_kw,
          [`discharge_ub_${t}`]: max_power_kw,
        };
      } else {
        // Outside connected window: binary is irrelevant but must be defined
        variables[bName] = { profit: 0 };
      }

      // ── Charging variable Pc_t ───────────────────────────────────────────────
      const pcName = `Pc_${t}`;

      if (inWindow) {
        const pcVarDef: Record<string, number> = {
          profit: -price * DT,
          [`charge_ub_${t}`]: 1,
          [`gcp_c_${t}`]: 1,
        };
        // SOC cumulative: Pc_t affects soc_upper_j / soc_lower_j for j >= t
        for (let j = t; j < N; j++) {
          pcVarDef[`soc_upper_${j}`] = socCoeffCharge;
          pcVarDef[`soc_lower_${j}`] = socCoeffCharge;
        }
        // Final SOC constraint: only intervals within the connected window
        pcVarDef['soc_final_min'] = socCoeffCharge;
        variables[pcName] = pcVarDef;
      } else {
        // Force Pc_t = 0 outside window
        constraints[`fix_c_${t}`] = { min: 0, max: 0 };
        variables[pcName] = { profit: 0, [`fix_c_${t}`]: 1 };
      }

      // ── Discharging variable Pd_t ────────────────────────────────────────────
      const pdName = `Pd_${t}`;

      if (inWindow) {
        const pdVarDef: Record<string, number> = {
          profit: price * DT * eta_d,
          [`discharge_ub_${t}`]: 1,
          [`gcp_d_${t}`]: eta_d,
        };
        for (let j = t; j < N; j++) {
          pdVarDef[`soc_upper_${j}`] = -socCoeffDischarge;
          pdVarDef[`soc_lower_${j}`] = -socCoeffDischarge;
        }
        // Final SOC constraint: discharge reduces final SOC
        pdVarDef['soc_final_min'] = -socCoeffDischarge;
        variables[pdName] = pdVarDef;
      } else {
        // Force Pd_t = 0 outside window
        constraints[`fix_d_${t}`] = { min: 0, max: 0 };
        variables[pdName] = { profit: 0, [`fix_d_${t}`]: 1 };
      }
    }

    const model = {
      optimize: 'profit',
      opType: 'max',
      constraints,
      variables,
      binaries,
    };

    const result = solver.Solve(model);

    if (!result.feasible) {
      return { ...empty(), status: 'infeasible' };
    }

    // ── Extract solution ─────────────────────────────────────────────────────
    const schedule_charge_kw: number[] = [];
    const schedule_discharge_kw: number[] = [];

    for (let t = 0; t < N; t++) {
      schedule_charge_kw.push(Math.max(0, result[`Pc_${t}`] ?? 0));
      schedule_discharge_kw.push(Math.max(0, result[`Pd_${t}`] ?? 0));
    }

    // ── Compute SOC curve analytically ──────────────────────────────────────
    const soc_curve_pct: number[] = [soc_initial_pct];
    let socCurrent = soc_initial_pct;
    for (let t = 0; t < N; t++) {
      const delta = (schedule_charge_kw[t] * eta_c - schedule_discharge_kw[t]) * DT / battery_kwh * 100;
      socCurrent = Math.max(soc_min_pct - 0.01, Math.min(soc_max_pct + 0.01, socCurrent + delta));
      soc_curve_pct.push(socCurrent);
    }

    // ── Net grid power ───────────────────────────────────────────────────────
    // Positive = charging from grid, Negative = discharging to grid (V2G)
    const net_grid_kw = schedule_charge_kw.map((pc, t) => pc - schedule_discharge_kw[t] * eta_d);

    // ── Financial summary ────────────────────────────────────────────────────
    let total_revenue_eur = 0;
    let total_cost_eur = 0;
    for (let t = 0; t < N; t++) {
      total_revenue_eur += prices_15min[t] * schedule_discharge_kw[t] * eta_d * DT;
      total_cost_eur    += prices_15min[t] * schedule_charge_kw[t] * DT;
    }
    const net_profit_eur = total_revenue_eur - total_cost_eur;

    // ── Cycles: total charge energy / battery capacity ───────────────────────
    const total_charge_kwh = schedule_charge_kw.reduce((s, p) => s + p * DT, 0);
    const cycles = battery_kwh > 0 ? total_charge_kwh / battery_kwh : 0;

    const ref = computeChargeOnly();
    return {
      status: 'optimal',
      schedule_charge_kw,
      schedule_discharge_kw,
      net_grid_kw,
      soc_curve_pct,
      reference_charge_kw: ref.schedule_kw,
      reference_soc_curve_pct: ref.soc_curve,
      total_revenue_eur,
      total_cost_eur,
      net_profit_eur,
      charge_only_cost_eur: ref.cost,
      computation_time_ms: Date.now() - startTime,
      date,
      prices_15min,
      cycles,
    };
  } catch (err) {
    console.error('MILP V2G arbitrage solver error:', err);
    return empty();
  }
}
