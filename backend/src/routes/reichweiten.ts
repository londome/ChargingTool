import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { runReichweitenSimulation, ReichweitenSimulationResult } from '../simulation/reichweitenSimulator';

const router = Router();

// POST /api/reichweiten/run
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { project_id, selected_ev_ids = [] } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const runId = uuidv4();

    await query(
      `INSERT INTO reichweiten_runs (id, project_id, status, selected_ev_ids, created_at)
       VALUES ($1, $2, 'pending', $3, NOW())`,
      [runId, project_id, JSON.stringify(selected_ev_ids)]
    );

    // Run asynchronously — conditions are read per-route from the DB
    setImmediate(async () => {
      try {
        await query(`UPDATE reichweiten_runs SET status = 'running' WHERE id = $1`, [runId]);
        const results = await runReichweitenSimulation(project_id, selected_ev_ids);
        await query(
          `UPDATE reichweiten_runs
           SET status = 'completed', results = $1, completed_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(results), runId]
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await query(
          `UPDATE reichweiten_runs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
          [msg, runId]
        );
      }
    });

    res.status(202).json({ data: { run_id: runId, status: 'pending' } });
  } catch (error) {
    console.error('Error starting Reichweiten simulation:', error);
    res.status(500).json({ error: 'Failed to start Reichweiten simulation' });
  }
});

// GET /api/reichweiten/:runId/status
router.get('/:runId/status', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const result = await query(
      'SELECT id, project_id, status, error_message, created_at, completed_at FROM reichweiten_runs WHERE id = $1',
      [runId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json({ data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// GET /api/reichweiten/:runId/results
router.get('/:runId/results', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const result = await query<{ status: string; results: ReichweitenSimulationResult; error_message: string }>(
      'SELECT status, results, error_message FROM reichweiten_runs WHERE id = $1',
      [runId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Run not found' });
    }
    const row = result.rows[0];
    if (row.status !== 'completed') {
      return res.status(202).json({ data: { status: row.status, error_message: row.error_message } });
    }
    res.json({ data: row.results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// GET /api/reichweiten/project/:projectId/latest
router.get('/project/:projectId/latest', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query(
      `SELECT id, status, results, error_message, created_at, completed_at
       FROM reichweiten_runs
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'No runs found for this project' });
    }
    const row = result.rows[0];
    res.json({
      data: {
        run_id: row.id,
        status: row.status,
        results: row.results,
        error_message: row.error_message,
        created_at: row.created_at,
        completed_at: row.completed_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest run' });
  }
});

export default router;
