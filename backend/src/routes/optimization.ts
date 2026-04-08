import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { fetchDayAheadPrices, fetchDayAheadPricesPeriod } from '../services/entsoePrices';
import { solveChargingOptimization, ChargingVehicle } from '../optimization/lpCharging';

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
          throw new Error('Keine Flottendaten für dieses Projekt gefunden. Bitte den Wizard abschließen.');
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

        // ── Arrival/departure times from routes ───────────────────────────────────
        // routes.start_time = departure (Abfahrt), routes.end_time = arrival at depot (Ankunft)
        // Use the earliest start_time and latest end_time across all routes of the project.
        const routeTimesResult = await query<{
          min_start: string | null; max_end: string | null;
        }>(
          `SELECT MIN(start_time::text) as min_start, MAX(end_time::text) as max_end
           FROM routes WHERE project_id = $1`,
          [project_id]
        );

        const resolvedDepartureTime: string =
          departure_time ??
          (routeTimesResult.rows[0]?.min_start
            ? routeTimesResult.rows[0].min_start.substring(0, 5)
            : '07:00');

        const resolvedArrivalTime: string =
          arrival_time ??
          (routeTimesResult.rows[0]?.max_end
            ? routeTimesResult.rows[0].max_end.substring(0, 5)
            : '17:00');

        // ── SOC on arrival from route energy consumption ──────────────────────────
        // Strategy 1: use route_results from a previous simulation (ev_energy_kwh is annual → /trips_per_year)
        // Strategy 2 (fallback): compute directly from routes.distance_km × EV nominal consumption
        const routeEnergyResult = await query<{
          ev_energy_kwh: number; trips_per_year: number;
        }>(
          `SELECT rr.ev_energy_kwh, r.trips_per_year
           FROM route_results rr
           JOIN simulation_runs sr ON sr.id = rr.simulation_run_id
           JOIN routes r ON r.project_id = sr.project_id AND r.route_id = rr.route_id
           WHERE sr.project_id = $1
           ORDER BY sr.started_at DESC`,
          [project_id]
        );

        let dailyEnergyKwh = 0;
        if (routeEnergyResult.rows.length > 0) {
          // Use simulation results (more accurate)
          for (const r of routeEnergyResult.rows) {
            const tripsPerYear = parseFloat(String(r.trips_per_year)) || 1;
            const annualKwh = parseFloat(String(r.ev_energy_kwh)) || 0;
            dailyEnergyKwh += annualKwh / tripsPerYear;
          }
        } else {
          // Fallback: estimate from route distances × EV nominal consumption
          const routeDistResult = await query<{
            distance_km: number; trips_per_year: number;
          }>(
            `SELECT distance_km, trips_per_year FROM routes WHERE project_id = $1`,
            [project_id]
          );
          for (const r of routeDistResult.rows) {
            const dist = parseFloat(String(r.distance_km)) || 0;
            const tripsPerYear = parseFloat(String(r.trips_per_year)) || 1;
            // Energy per trip = distance × consumption/100; daily = per trip (1 trip/day assumption)
            dailyEnergyKwh += (dist * nominalConsumptionKwh100km) / 100;
          }
        }

        const socDropPct = batteryKwh > 0 ? (dailyEnergyKwh / batteryKwh) * 100 : 0;
        const rawSocArrival = soc_target_pct - socDropPct;
        const computedSocArrival = Math.max(0, Math.min(soc_target_pct, rawSocArrival));

        // ── SOC arrival warning ───────────────────────────────────────────────────
        const socArrivalBelowMin = rawSocArrival < soc_min_pct;
        const socArrivalWarning = socArrivalBelowMin
          ? `⚠️ SOC bei Ankunft (${rawSocArrival.toFixed(1)} %) liegt unter dem definierten Minimum (${soc_min_pct} %). ` +
            `Die Flotte verbraucht ${dailyEnergyKwh.toFixed(1)} kWh/Tag bei einer Batteriekapazität von ${batteryKwh} kWh. ` +
            `Prüfe ob die Fahrzeugreichweite für die definierten Touren ausreicht.`
          : null;

        // ── Build ChargingVehicle list ────────────────────────────────────────────
        const arrivalInterval = timeToInterval(resolvedArrivalTime);
        const departureInterval = timeToInterval(resolvedDepartureTime);

        const effectiveDepartureInterval =
          departureInterval <= arrivalInterval
            ? departureInterval + 96
            : departureInterval;
        const clampedDeparture = Math.min(effectiveDepartureInterval, 96);

        const vehicles: ChargingVehicle[] = fleetsResult.rows.map((row, idx) => ({
          id: String(row.id),
          name: evName
            ? `${evName} #${idx + 1}`
            : `Fahrzeug ${idx + 1} (${row.segment || 'EV'})`,
          battery_kwh:         batteryKwh,
          max_charge_power_kw: maxChargeKw,
          charging_efficiency: 0.92,
          soc_arrival_pct:     computedSocArrival,
          soc_target_pct,
          soc_min_pct,
          arrival_interval:   Math.max(0, Math.min(arrivalInterval, 95)),
          departure_interval: Math.max(1, Math.min(clampedDeparture, 96)),
        }));

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
