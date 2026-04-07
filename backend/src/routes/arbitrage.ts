import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { fetchDayAheadPrices } from '../services/entsoePrices';
import { solveArbitrage, ArbitrageInput } from '../optimization/milpArbitrage';

const router = Router();

function timeToInterval(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  return Math.floor(h * 4 + m / 15);
}

// POST /api/arbitrage/run
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      project_id,
      date,
      bidding_zone = 'DE_LU',
      gcp_max_kw = 100,
      wallbox_power_kw = 22,
      soc_target_pct = 80,
      soc_min_pct = 20,
      selected_ev_ids,
    } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const runId = uuidv4();
    const runDate = date ? new Date(date) : new Date();
    const runDateStr = runDate.toISOString().split('T')[0];

    // Insert pending run
    await query(
      `INSERT INTO arbitrage_runs
         (id, project_id, status, run_date, bidding_zone, gcp_max_kw, created_at)
       VALUES ($1, $2, 'pending', $3, $4, $5, NOW())`,
      [runId, project_id, runDateStr, bidding_zone, gcp_max_kw]
    );

    res.status(202).json({ data: { run_id: runId, status: 'pending' } });

    // Run asynchronously
    setImmediate(async () => {
      try {
        await query(`UPDATE arbitrage_runs SET status = 'running' WHERE id = $1`, [runId]);

        // 1. Fetch ENTSO-E day-ahead prices
        const pricesResult = await fetchDayAheadPrices(runDate, bidding_zone);

        // 2. Load fleet vehicles from DB
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

        // 3. EV specs from selected_ev_ids (same pattern as optimization.ts)
        let batteryKwh = 60;
        let evMaxChargePower = wallbox_power_kw;

        if (selected_ev_ids && Array.isArray(selected_ev_ids) && selected_ev_ids.length > 0) {
          const evResult = await query<{
            model: string; battery_usable_kwh: number; max_ac_kw: number;
          }>(
            `SELECT model, battery_usable_kwh, max_ac_kw
             FROM ev_models WHERE id = ANY($1::uuid[]) AND is_active = TRUE LIMIT 1`,
            [selected_ev_ids]
          );
          if (evResult.rows[0]) {
            const ev = evResult.rows[0];
            batteryKwh = parseFloat(String(ev.battery_usable_kwh)) || 60;
            evMaxChargePower = parseFloat(String(ev.max_ac_kw)) || wallbox_power_kw;
          }
        }
        const maxPowerKw = Math.min(wallbox_power_kw, evMaxChargePower);

        // 4. Arrival / departure times from routes table
        const routeTimesResult = await query<{
          min_start: string | null; max_end: string | null;
        }>(
          `SELECT MIN(start_time::text) as min_start, MAX(end_time::text) as max_end
           FROM routes WHERE project_id = $1`,
          [project_id]
        );

        const resolvedDepartureTime: string =
          routeTimesResult.rows[0]?.min_start
            ? routeTimesResult.rows[0].min_start.substring(0, 5)
            : '07:00';

        const resolvedArrivalTime: string =
          routeTimesResult.rows[0]?.max_end
            ? routeTimesResult.rows[0].max_end.substring(0, 5)
            : '17:00';

        // 5. Compute SOC at arrival from route energy consumption
        // route_results.ev_energy_kwh = ANNUAL energy (× trips_per_year)
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
        for (const r of routeEnergyResult.rows) {
          const tripsPerYear = parseFloat(String(r.trips_per_year)) || 1;
          const annualKwh = parseFloat(String(r.ev_energy_kwh)) || 0;
          dailyEnergyKwh += annualKwh / tripsPerYear;
        }

        const socDropPct = batteryKwh > 0 ? (dailyEnergyKwh / batteryKwh) * 100 : 0;
        const socArrivalPct = Math.max(
          soc_min_pct,
          Math.min(soc_target_pct, soc_target_pct - socDropPct)
        );

        // 6. Compute arrival/departure intervals (same overnight logic as optimization.ts)
        const arrivalInterval = timeToInterval(resolvedArrivalTime);
        const departureInterval = timeToInterval(resolvedDepartureTime);
        const effectiveDepartureInterval =
          departureInterval <= arrivalInterval
            ? departureInterval + 96
            : departureInterval;
        const clampedDeparture = Math.min(effectiveDepartureInterval, 96);

        // 7. Build MILP input (V2G: fleet batteries are the storage)
        const arbitrageInput: ArbitrageInput = {
          prices_15min: pricesResult.prices_15min,
          battery_kwh: batteryKwh,
          max_power_kw: maxPowerKw,
          eta_c: 0.92,
          eta_d: 0.92,
          soc_initial_pct: socArrivalPct,
          soc_min_pct,
          soc_max_pct: 100,
          gcp_max_kw,
          arrival_interval: Math.max(0, Math.min(arrivalInterval, 95)),
          departure_interval: Math.max(1, Math.min(clampedDeparture, 96)),
          soc_final_pct: soc_target_pct,
          date: runDateStr,
        };

        // 8. Solve MILP
        const arbResult = await solveArbitrage(arbitrageInput);

        // 9. Store results
        await query(
          `UPDATE arbitrage_runs
           SET status = $1, results = $2, prices = $3, completed_at = NOW()
           WHERE id = $4`,
          [
            arbResult.status === 'optimal' ? 'completed' : arbResult.status,
            JSON.stringify(arbResult),
            JSON.stringify({ prices_15min: pricesResult.prices_15min, source: pricesResult.source }),
            runId,
          ]
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Arbitrage run failed:', msg);
        await query(
          `UPDATE arbitrage_runs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
          [msg, runId]
        );
      }
    });
  } catch (error) {
    console.error('Error starting arbitrage run:', error);
    res.status(500).json({ error: 'Failed to start arbitrage run' });
  }
});

// GET /api/arbitrage/project/:projectId/latest
router.get('/project/:projectId/latest', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT id, status, results, prices, error_message, bidding_zone, gcp_max_kw, run_date, created_at, completed_at
       FROM arbitrage_runs
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'No arbitrage runs found for this project' });
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
        run_date: row.run_date,
        created_at: row.created_at,
        completed_at: row.completed_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest arbitrage run' });
  }
});

// GET /api/arbitrage/:runId/results
router.get('/:runId/results', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const result = await query(
      `SELECT id, status, results, prices, error_message, bidding_zone, gcp_max_kw, run_date
       FROM arbitrage_runs WHERE id = $1`,
      [runId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Arbitrage run not found' });
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
        run_date: row.run_date,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch arbitrage results' });
  }
});

export default router;
