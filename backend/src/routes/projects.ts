import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { Project } from '../../../shared/types';

const router = Router();

// GET /api/projects/dashboard-stats - Aggregated stats for dashboard
router.get('/dashboard-stats', async (req: Request, res: Response) => {
  try {
    const [projectCount, vehicleCount, simCount, lastProject] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM projects'),
      query<{ count: string }>('SELECT COALESCE(SUM(vehicle_count), 0) as count FROM fleets'),
      query<{ count: string }>(`SELECT COUNT(*) as count FROM simulation_runs WHERE status = 'completed'`),
      query<{ created_at: string }>('SELECT created_at FROM projects ORDER BY created_at DESC LIMIT 1'),
    ]);
    res.json({
      data: {
        project_count: parseInt(projectCount.rows[0]?.count ?? '0'),
        vehicle_count: parseInt(vehicleCount.rows[0]?.count ?? '0'),
        simulation_count: parseInt(simCount.rows[0]?.count ?? '0'),
        last_activity: lastProject.rows[0]?.created_at ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/projects - List all projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query<Project>(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get single project
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query<Project>(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create project
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      country = 'DE',
      currency = 'EUR',
      fleet_type,
      industry,
      depot_location,
      charging_options = [],
      wizard_module = null,
      user_id,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const id = uuidv4();
    const result = await query<Project>(
      `INSERT INTO projects (id, user_id, name, country, currency, fleet_type, industry, depot_location, charging_options, wizard_module)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, user_id || null, name, country, currency, fleet_type, industry, depot_location, charging_options, wizard_module]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      country,
      currency,
      fleet_type,
      industry,
      depot_location,
      charging_options,
    } = req.body;

    const result = await query<Project>(
      `UPDATE projects
       SET name = COALESCE($1, name),
           country = COALESCE($2, country),
           currency = COALESCE($3, currency),
           fleet_type = COALESCE($4, fleet_type),
           industry = COALESCE($5, industry),
           depot_location = COALESCE($6, depot_location),
           charging_options = COALESCE($7, charging_options),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, country, currency, fleet_type, industry, depot_location, charging_options, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM projects WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/projects/:id/summary - Project summary with counts
router.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [projectResult, fleetResult, routeResult, scenarioResult, runResult] = await Promise.all([
      query('SELECT * FROM projects WHERE id = $1', [id]),
      query('SELECT COUNT(*) as count FROM fleets WHERE project_id = $1', [id]),
      query('SELECT COUNT(*) as count FROM routes WHERE project_id = $1', [id]),
      query('SELECT COUNT(*) as count FROM scenarios WHERE project_id = $1', [id]),
      query(`SELECT sr.*, rs.electrifiable_pct, rs.co2e_savings_pct, rs.payback_years
             FROM simulation_runs sr
             LEFT JOIN result_summaries rs ON rs.simulation_run_id = sr.id
             WHERE sr.project_id = $1 AND sr.status = 'completed'
             ORDER BY sr.completed_at DESC LIMIT 1`, [id]),
    ]);

    if (!projectResult.rows.length) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      data: {
        project: projectResult.rows[0],
        fleet_count: parseInt((fleetResult.rows[0] as { count: string }).count),
        route_count: parseInt((routeResult.rows[0] as { count: string }).count),
        scenario_count: parseInt((scenarioResult.rows[0] as { count: string }).count),
        latest_run: runResult.rows[0] || null,
      },
    });
  } catch (error) {
    console.error('Error fetching project summary:', error);
    res.status(500).json({ error: 'Failed to fetch project summary' });
  }
});

export default router;
