import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { Scenario } from '../../../shared/types';

const router = Router();

// GET /api/scenarios?project_id=xxx
router.get('/', async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const result = await query<Scenario>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM simulation_runs sr WHERE sr.scenario_id = s.id) as run_count,
        (SELECT sr2.status FROM simulation_runs sr2 WHERE sr2.scenario_id = s.id ORDER BY sr2.started_at DESC LIMIT 1) as last_run_status
       FROM scenarios s WHERE s.project_id = $1 ORDER BY s.name`,
      [project_id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({ error: 'Failed to fetch scenarios' });
  }
});

// GET /api/scenarios/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query<Scenario>('SELECT * FROM scenarios WHERE id = $1', [id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching scenario:', error);
    res.status(500).json({ error: 'Failed to fetch scenario' });
  }
});

// POST /api/scenarios - Create scenario
router.post('/', async (req: Request, res: Response) => {
  try {
    const s = req.body;

    if (!s.project_id || !s.name) {
      return res.status(400).json({ error: 'project_id and name are required' });
    }

    const id = uuidv4();
    const result = await query<Scenario>(
      `INSERT INTO scenarios (id, project_id, name, type, electrification_pct, soc_start, soc_min, soc_target,
        charging_power_kw, charging_efficiency, electricity_price, diesel_price, grid_emission_factor, temperature_factor,
        allow_public_charging, winter_surcharge, notes, wallbox_price_eur, installation_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        id, s.project_id, s.name, s.type || 'custom',
        s.electrification_pct ?? 100,
        s.soc_start ?? 90,
        s.soc_min ?? 20,
        s.soc_target ?? 80,
        s.charging_power_kw ?? 22,
        s.charging_efficiency ?? 0.92,
        s.electricity_price ?? 0.25,
        s.diesel_price ?? 1.75,
        s.grid_emission_factor ?? 0.380,
        s.temperature_factor ?? 1.0,
        s.allow_public_charging ?? false,
        s.winter_surcharge ?? 0.15,
        s.notes || null,
        s.wallbox_price_eur ?? 1200,
        s.installation_type ?? 'standard',
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error creating scenario:', error);
    res.status(500).json({ error: 'Failed to create scenario' });
  }
});

// PUT /api/scenarios/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const s = req.body;

    const result = await query<Scenario>(
      `UPDATE scenarios SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        electrification_pct = COALESCE($3, electrification_pct),
        soc_start = COALESCE($4, soc_start),
        soc_min = COALESCE($5, soc_min),
        soc_target = COALESCE($6, soc_target),
        charging_power_kw = COALESCE($7, charging_power_kw),
        charging_efficiency = COALESCE($8, charging_efficiency),
        electricity_price = COALESCE($9, electricity_price),
        diesel_price = COALESCE($10, diesel_price),
        grid_emission_factor = COALESCE($11, grid_emission_factor),
        temperature_factor = COALESCE($12, temperature_factor),
        allow_public_charging = COALESCE($13, allow_public_charging),
        winter_surcharge = COALESCE($14, winter_surcharge),
        notes = COALESCE($15, notes),
        wallbox_price_eur = COALESCE($16, wallbox_price_eur),
        installation_type = COALESCE($17, installation_type)
       WHERE id = $18 RETURNING *`,
      [
        s.name, s.type, s.electrification_pct, s.soc_start, s.soc_min, s.soc_target,
        s.charging_power_kw, s.charging_efficiency, s.electricity_price, s.diesel_price,
        s.grid_emission_factor, s.temperature_factor, s.allow_public_charging, s.winter_surcharge,
        s.notes, s.wallbox_price_eur, s.installation_type, id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating scenario:', error);
    res.status(500).json({ error: 'Failed to update scenario' });
  }
});

// DELETE /api/scenarios/project/:projectId - Delete all scenarios for a project
router.delete('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    await query('DELETE FROM scenarios WHERE project_id = $1', [projectId]);
    res.json({ message: 'All scenarios deleted' });
  } catch (error) {
    console.error('Error deleting scenarios:', error);
    res.status(500).json({ error: 'Failed to delete scenarios' });
  }
});

// DELETE /api/scenarios/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM scenarios WHERE id = $1', [id]);
    res.json({ message: 'Scenario deleted' });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});

// POST /api/scenarios/:id/duplicate - Duplicate scenario
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const original = await query<Scenario>('SELECT * FROM scenarios WHERE id = $1', [id]);

    if (!original.rows.length) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const s = original.rows[0];
    const newId = uuidv4();
    const result = await query<Scenario>(
      `INSERT INTO scenarios (id, project_id, name, type, electrification_pct, soc_start, soc_min, soc_target,
        charging_power_kw, charging_efficiency, electricity_price, diesel_price, grid_emission_factor, temperature_factor,
        allow_public_charging, winter_surcharge, notes, wallbox_price_eur, installation_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        newId, s.project_id, `${s.name} (Kopie)`, s.type, s.electrification_pct,
        s.soc_start, s.soc_min, s.soc_target, s.charging_power_kw, s.charging_efficiency,
        s.electricity_price, s.diesel_price ?? 1.75, s.grid_emission_factor, s.temperature_factor,
        s.allow_public_charging, s.winter_surcharge, s.notes,
        s.wallbox_price_eur ?? 1200, s.installation_type ?? 'standard',
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error duplicating scenario:', error);
    res.status(500).json({ error: 'Failed to duplicate scenario' });
  }
});

export default router;
