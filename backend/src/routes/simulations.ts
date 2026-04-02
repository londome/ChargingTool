import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { SimulationRun, ResultSummary, RouteResult, InfrastructureEstimate } from '../../../shared/types';
import { runSimulation } from '../simulation/simulationOrchestrator';

const router = Router();

// POST /api/simulations/run - Start a simulation
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { project_id, scenario_id } = req.body;

    if (!project_id || !scenario_id) {
      return res.status(400).json({ error: 'project_id and scenario_id are required' });
    }

    const runId = uuidv4();
    await query(
      `INSERT INTO simulation_runs (id, project_id, scenario_id, status, started_at)
       VALUES ($1, $2, $3, 'pending', NOW())`,
      [runId, project_id, scenario_id]
    );

    // Run simulation asynchronously
    setImmediate(async () => {
      try {
        await query(`UPDATE simulation_runs SET status = 'running' WHERE id = $1`, [runId]);
        await runSimulation(runId, project_id, scenario_id);
        await query(
          `UPDATE simulation_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [runId]
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await query(
          `UPDATE simulation_runs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
          [msg, runId]
        );
      }
    });

    res.status(202).json({ data: { run_id: runId, status: 'pending' } });
  } catch (error) {
    console.error('Error starting simulation:', error);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

// GET /api/simulations/:runId/status
router.get('/:runId/status', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const result = await query<SimulationRun>(
      'SELECT * FROM simulation_runs WHERE id = $1',
      [runId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Simulation run not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching simulation status:', error);
    res.status(500).json({ error: 'Failed to fetch simulation status' });
  }
});

// GET /api/simulations/project/:projectId - List runs for project
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT sr.*, s.name as scenario_name, s.type as scenario_type,
              rs.electrifiable_pct, rs.co2e_savings_pct, rs.payback_years, rs.tco_savings
       FROM simulation_runs sr
       JOIN scenarios s ON s.id = sr.scenario_id
       LEFT JOIN (
         SELECT simulation_run_id,
                electrifiable_pct,
                co2e_savings_pct,
                payback_years,
                (tco_ice - tco_ev) as tco_savings
         FROM result_summaries
       ) rs ON rs.simulation_run_id = sr.id
       WHERE sr.project_id = $1
       ORDER BY sr.started_at DESC`,
      [projectId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching simulation runs:', error);
    res.status(500).json({ error: 'Failed to fetch simulation runs' });
  }
});

// GET /api/simulations/:runId/results - Get full results
router.get('/:runId/results', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const [runResult, summaryResult, routeResults, infraResult] = await Promise.all([
      query<SimulationRun>('SELECT * FROM simulation_runs WHERE id = $1', [runId]),
      query<ResultSummary>('SELECT * FROM result_summaries WHERE simulation_run_id = $1', [runId]),
      query<RouteResult>('SELECT * FROM route_results WHERE simulation_run_id = $1 ORDER BY distance_km DESC', [runId]),
      query<InfrastructureEstimate>('SELECT * FROM infrastructure_estimates WHERE simulation_run_id = $1', [runId]),
    ]);

    if (!runResult.rows.length) {
      return res.status(404).json({ error: 'Simulation run not found' });
    }

    res.json({
      data: {
        run: runResult.rows[0],
        summary: summaryResult.rows[0] || null,
        route_results: routeResults.rows,
        infrastructure: infraResult.rows[0] || null,
      },
    });
  } catch (error) {
    console.error('Error fetching simulation results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// GET /api/simulations/:runId/summary
router.get('/:runId/summary', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const result = await query<ResultSummary>(
      'SELECT * FROM result_summaries WHERE simulation_run_id = $1',
      [runId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Results not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/simulations/scenario/:scenarioId/latest
router.get('/scenario/:scenarioId/latest', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const result = await query(
      `SELECT sr.*, rs.*
       FROM simulation_runs sr
       LEFT JOIN result_summaries rs ON rs.simulation_run_id = sr.id
       WHERE sr.scenario_id = $1 AND sr.status = 'completed'
       ORDER BY sr.completed_at DESC LIMIT 1`,
      [scenarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'No completed simulation found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching latest simulation:', error);
    res.status(500).json({ error: 'Failed to fetch latest simulation' });
  }
});

export default router;
