import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { fetchDayAheadPrices, fetchDayAheadPricesPeriod } from '../services/entsoePrices';
import { solveChargingOptimization, ChargingVehicle } from '../optimization/lpCharging';
import { buildVehiclePhysics, simulateRange, UsageMix } from '../simulation/physicsEngine';

const router = Router();

function timeToInterval(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return Math.floor(h * 4 + m / 15);
}

// POST /api/optimization/run
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      project_id,
      date,
      date_to,            // optional — if present and > date, run multi-day period
      bidding_zone = 'DE_LU',
      gcp_max_kw = 100,
      wallbox_power_kw = 22,
      soc_target_pct = 80,
      soc_min_pct = 20,
      arrival_time,       // optional override; if absent, read from routes
      departure_time,     // optional override; if absent, read from routes
      selected_ev_ids,    // string[] from wizard Step 5
      depot_profile_kw,   // optional 96-value depot background load [kW]
    } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const runId = uuidv4();
    const optimizationDate = date ? new Date(date) : new Date();

    // Insert pending run
    await query(
      `INSERT INTO optimization_runs (id, project_id, status, optimization_date, bidding_zone, gcp_max_kw, created_at)
       VALUES ($1, $2, 'pending', $3, $4, $5, NOW())`,
      [runId, project_id, optimizationDate.toISOString().split('T')[0], bidding_zone, gcp_max_kw]
    );

    res.status(202).json({ data: { run_id: runId, status: 'pending' } });

    // Run asynchronously
    setImmediate(async () => {
      try {
        await query(`UPDATE optimization_runs SET status = 'running' WHERE id = $1`, [runId]);

        // 1. Load fleet vehicles from DB
        // fleet_vehicles has no ev_model_id column — use simulation results if available,
        // otherwise use defaults from Step4 params passed in the request
        const fleetsResult = await query<{
          id: string; segment: string; count: number; annual_km: number;
        }>(
          `SELECT fv.id, fv.segment, fv.count, fv.annual_km
           FROM fleet_vehicles fv
           JOIN fleets f ON fv.fleet_id = f.id
           WHERE f.project_id = $1`,
          [project_id]
        );

        if (!fleetsResult.rows.length) {
          console.warn('No fleet vehicles found, continuing with route-based vehicle list');
        }

        // ── EV specs ─────────────────────────────────────────────────────────────
        // Priority: selected_ev_ids sent from wizard Step 5 → query ev_models directly
        let evName = '';
        let batteryKwh = 60;
        let evMaxChargePower = wallbox_power_kw;
        let nominalConsumptionKwh100km = 25; // fallback

        if (selected_ev_ids && Array.isArray(selected_ev_ids) && selected_ev_ids.length > 0) {
          const evResult = await query<{
            model: string; battery_usable_kwh: number; max_ac_kw: number; nominal_consumption_kwh_100km: number;
          }>(
            `SELECT model, battery_usable_kwh, max_ac_kw, nominal_consumption_kwh_100km
             FROM ev_models WHERE id = ANY($1::uuid[]) AND is_active = TRUE LIMIT 1`,
            [selected_ev_ids]
          );
          if (evResult.rows[0]) {
            const ev = evResult.rows[0];
            evName = ev.model;
            batteryKwh = parseFloat(String(ev.battery_usable_kwh)) || 60;
            evMaxChargePower = parseFloat(String(ev.max_ac_kw)) || wallbox_power_kw;
            nominalConsumptionKwh100km = parseFloat(String(ev.nominal_consumption_kwh_100km)) || 25;
          }
        }
        const maxChargeKw = Math.min(wallbox_power_kw, evMaxChargePower);

        // ── Load routes with per-route times and vehicle_count ───────────────────
        const routesResult = await query<{
          route_id: string; distance_km: number; vehicle_count: number;
          start_time: string | null; end_time: string | null; trips_per_year: number;
          sim_temperature_c: number | null; sim_hvac_on: boolean | null;
          sim_city_share: number | null; sim_rural_share: number | null; sim_hwy_share: number | null;
          outside_temperature_c: number | null; avg_speed_kmh: number | null; payload_kg: number | null;
        }>(
          `SELECT route_id, distance_km, COALESCE(vehicle_count, 1) as vehicle_count,
                  start_time, end_time, COALESCE(trips_per_year, 250) as trips_per_year,
                  sim_temperature_c, sim_hvac_on, sim_city_share, sim_rural_share, sim_hwy_share,
                  outside_temperature_c, avg_speed_kmh, payload_kg
           FROM routes WHERE project_id = $1 ORDER BY route_id`,
          [project_id]
        );

        if (!routesResult.rows.length) {
          throw new Error('Keine Routendaten für dieses Projekt gefunden. Bitte den Wizard abschließen.');
        }

        // ── Build ChargingVehicle list — one entry per vehicle per route ──────────
        let vehicleCounter = 0;
        let totalSocArrivalWarning: string | null = null;
        let hasSocWarning = false;

        const vehicles: ChargingVehicle[] = routesResult.rows.flatMap((route) => {
          const count = Math.max(1, Number(route.vehicle_count) || 1);

          // Per-route arrival/departure
          const routeArrival   = arrival_time   ?? (route.end_time   ? route.end_time.substring(0, 5)   : '17:00');
          const routeDeparture = departure_time ?? (route.start_time ? route.start_time.substring(0, 5) : '07:00');

          const arrInterval  = timeToInterval(routeArrival);
          const deptInterval = timeToInterval(routeDeparture);
          const effectiveDept = deptInterval <= arrInterval ? deptInterval + 96 : deptInterval;
          const clampedDept  = Math.min(effectiveDept, 96);

          // Per-route SOC on arrival — use physicsEngine with per-route sim conditions
          const dist = parseFloat(String(route.distance_km)) || 0;
          const routeMix: UsageMix = {
            city_share:  route.sim_city_share  ?? 0.5,
            rural_share: route.sim_rural_share ?? 0.3,
            hwy_share:   route.sim_hwy_share   ?? 0.2,
          };
          const routeTemp = route.sim_temperature_c ?? route.outside_temperature_c ?? 15;
          const routeHvac = route.sim_hvac_on ?? false;
          let effectiveConsumption = nominalConsumptionKwh100km;
          if (batteryKwh > 0 && evName) {
            try {
              const vp = buildVehiclePhysics(batteryKwh, nominalConsumptionKwh100km, 'medium_van', route.payload_kg ?? 0);
              effectiveConsumption = simulateRange(vp, routeMix, routeTemp, routeHvac).consumption_kwh_per_100km;
            } catch { /* fallback to nominal */ }
          }
          const energyKwh = (dist * effectiveConsumption) / 100;
          const socDrop   = batteryKwh > 0 ? (energyKwh / batteryKwh) * 100 : 0;
          const rawSocArr   = soc_target_pct - socDrop;
          const socArrival  = Math.max(0, Math.min(soc_target_pct, rawSocArr));

          if (rawSocArr < soc_min_pct && !hasSocWarning) {
            hasSocWarning = true;
            totalSocArrivalWarning =
              `⚠️ SOC bei Ankunft (${rawSocArr.toFixed(1)} %) liegt unter dem Minimum (${soc_min_pct} %). ` +
              `Route ${route.route_id}: ${dist} km × ${nominalConsumptionKwh100km} kWh/100km = ${energyKwh.toFixed(1)} kWh ` +
              `bei ${batteryKwh} kWh Batterie.`;
          }

          return Array.from({ length: count }, (_, vi) => {
            vehicleCounter++;
            return {
              id: `${route.route_id}_v${vi}`,
              name: evName
                ? `${evName} – Tour ${route.route_id}${count > 1 ? ` #${vi + 1}` : ''}`
                : `Fahrzeug ${vehicleCounter} – Tour ${route.route_id}`,
              battery_kwh:         batteryKwh,
              max_charge_power_kw: maxChargeKw,
              charging_efficiency: 0.92,
              soc_arrival_pct:     socArrival,
              soc_target_pct,
              soc_min_pct,
              arrival_interval:    Math.max(0, Math.min(arrInterval, 95)),
              departure_interval:  Math.max(1, Math.min(clampedDept, 96)),   // used by LP solver (overnight-adjusted)
              departure_interval_raw: Math.max(0, Math.min(deptInterval, 95)), // raw 0-95 for Gantt display
            };
          });
        });

        const computedSocArrival = vehicles[0]?.soc_arrival_pct ?? soc_target_pct;
        const socArrivalWarning  = totalSocArrivalWarning;

        // 3. Determine if multi-day
        const dateTo = date_to ? new Date(date_to) : null;
        const isMultiDay = dateTo !== null && dateTo > optimizationDate;

        if (isMultiDay && dateTo) {
          // Multi-day: fetch period prices once, loop per day
          const periodResult = await fetchDayAheadPricesPeriod(optimizationDate, dateTo, bidding_zone);

          let totalCostEur = 0;
          let totalEnergyKwh = 0;
          const dayResults: object[] = [];

          for (const dayPrices of periodResult.days) {
            const dayOptResult = await solveChargingOptimization({
              vehicles,
              prices_15min: dayPrices.prices_15min,
              gcp_max_kw,
              date: dayPrices.date,
              depot_profile_kw,
            });
            totalCostEur += dayOptResult.total_cost_eur ?? 0;
            totalEnergyKwh += dayOptResult.total_energy_kwh ?? 0;
            dayResults.push({
              date: dayPrices.date,
              total_cost_eur: dayOptResult.total_cost_eur,
              total_energy_kwh: dayOptResult.total_energy_kwh,
              fleet_power_kw: dayOptResult.fleet_power_kw,
              vehicles: dayOptResult.vehicles,
              prices_15min: dayPrices.prices_15min,
              status: dayOptResult.status,
            });
          }

          const periodResults = {
            type: 'period',
            days: dayResults,
            totals: {
              total_cost_eur: totalCostEur,
              total_energy_kwh: totalEnergyKwh,
              days_count: periodResult.total_days,
            },
            soc_arrival_pct: computedSocArrival,
            soc_arrival_warning: socArrivalWarning,
          };

          await query(
            `UPDATE optimization_runs
             SET status = 'completed', results = $1, prices = $2, completed_at = NOW()
             WHERE id = $3`,
            [
              JSON.stringify(periodResults),
              JSON.stringify({ source: periodResult.source }),
              runId,
            ]
          );
        } else {
          // Single-day: existing path
          const pricesResult = await fetchDayAheadPrices(optimizationDate, bidding_zone);

          const optResult = await solveChargingOptimization({
            vehicles,
            prices_15min: pricesResult.prices_15min,
            gcp_max_kw,
            date: optimizationDate.toISOString().split('T')[0],
            depot_profile_kw,
          });

          await query(
            `UPDATE optimization_runs
             SET status = $1, results = $2, prices = $3, completed_at = NOW()
             WHERE id = $4`,
            [
              optResult.status === 'optimal' ? 'completed' : optResult.status,
              JSON.stringify({ ...optResult, soc_arrival_pct: computedSocArrival, soc_arrival_warning: socArrivalWarning }),
              JSON.stringify({ prices_15min: pricesResult.prices_15min, source: pricesResult.source }),
              runId,
            ]
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Optimization run failed:', msg);
        await query(
          `UPDATE optimization_runs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
          [msg, runId]
        );
      }
    });
  } catch (error) {
    console.error('Error starting optimization run:', error);
    res.status(500).json({ error: 'Failed to start optimization run' });
  }
});

// GET /api/optimization/project/:projectId/latest
router.get('/project/:projectId/latest', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT id, status, results, prices, error_message, bidding_zone, gcp_max_kw, optimization_date, created_at, completed_at
       FROM optimization_runs
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'No optimization runs found for this project' });
    }
    const row = result.rows[0];
    res.json({
      data: {
        run_id: row.id,
        status: row.status,
        results: row.results,
        prices: row.prices,
        error_message: row.error_message,
        bidding_zone: row.bidding_zone,
        gcp_max_kw: row.gcp_max_kw,
        optimization_date: row.optimization_date,
        created_at: row.created_at,
        completed_at: row.completed_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest optimization run' });
  }
});

// GET /api/optimization/:runId/results
router.get('/:runId/results', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const result = await query(
      'SELECT id, status, results, prices, error_message, bidding_zone, gcp_max_kw, optimization_date FROM optimization_runs WHERE id = $1',
      [runId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Optimization run not found' });
    }
    const row = result.rows[0];
    if (row.status === 'pending' || row.status === 'running') {
      return res.status(202).json({ data: { status: row.status } });
    }
    res.json({
      data: {
        run_id: row.id,
        status: row.status,
        results: row.results,
        prices: row.prices,
        error_message: row.error_message,
        bidding_zone: row.bidding_zone,
        gcp_max_kw: row.gcp_max_kw,
        optimization_date: row.optimization_date,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch optimization results' });
  }
});

export default router;
