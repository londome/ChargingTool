import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { EVModel } from '../../../shared/types';

const router = Router();

// GET /api/ev-models - List EV models with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { segment, manufacturer, min_payload, max_price, active_only = 'true' } = req.query;

    let sql = 'SELECT * FROM ev_models WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (active_only === 'true') {
      sql += ` AND is_active = TRUE`;
    }

    if (segment) {
      sql += ` AND segment = $${idx++}`;
      params.push(segment);
    }

    if (manufacturer) {
      sql += ` AND manufacturer ILIKE $${idx++}`;
      params.push(`%${manufacturer}%`);
    }

    if (min_payload) {
      sql += ` AND payload_kg >= $${idx++}`;
      params.push(parseFloat(min_payload as string));
    }

    if (max_price) {
      sql += ` AND purchase_price <= $${idx++}`;
      params.push(parseFloat(max_price as string));
    }

    sql += ' ORDER BY manufacturer, model';

    const result = await query<EVModel>(sql, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching EV models:', error);
    res.status(500).json({ error: 'Failed to fetch EV models' });
  }
});

// GET /api/ev-models/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query<EVModel>('SELECT * FROM ev_models WHERE id = $1', [id]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'EV model not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching EV model:', error);
    res.status(500).json({ error: 'Failed to fetch EV model' });
  }
});

// POST /api/ev-models - Create custom EV model
router.post('/', async (req: Request, res: Response) => {
  try {
    const model = req.body;
    const id = uuidv4();

    const result = await query<EVModel>(
      `INSERT INTO ev_models (id, manufacturer, model, segment, battery_gross_kwh, battery_usable_kwh,
        nominal_consumption_kwh_100km, max_ac_kw, max_dc_kw, payload_kg, cargo_volume_m3,
        purchase_price, lease_monthly, notes, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        id, model.manufacturer, model.model, model.segment,
        model.battery_gross_kwh, model.battery_usable_kwh, model.nominal_consumption_kwh_100km,
        model.max_ac_kw, model.max_dc_kw || null, model.payload_kg || null,
        model.cargo_volume_m3 || null, model.purchase_price || null,
        model.lease_monthly || null, model.notes || null, model.is_active ?? true,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error creating EV model:', error);
    res.status(500).json({ error: 'Failed to create EV model' });
  }
});

// PUT /api/ev-models/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const m = req.body;

    const result = await query<EVModel>(
      `UPDATE ev_models SET
        manufacturer = COALESCE($1, manufacturer),
        model = COALESCE($2, model),
        segment = COALESCE($3, segment),
        battery_gross_kwh = COALESCE($4, battery_gross_kwh),
        battery_usable_kwh = COALESCE($5, battery_usable_kwh),
        nominal_consumption_kwh_100km = COALESCE($6, nominal_consumption_kwh_100km),
        max_ac_kw = COALESCE($7, max_ac_kw),
        max_dc_kw = COALESCE($8, max_dc_kw),
        payload_kg = COALESCE($9, payload_kg),
        purchase_price = COALESCE($10, purchase_price),
        notes = COALESCE($11, notes),
        is_active = COALESCE($12, is_active)
       WHERE id = $13 RETURNING *`,
      [
        m.manufacturer, m.model, m.segment, m.battery_gross_kwh, m.battery_usable_kwh,
        m.nominal_consumption_kwh_100km, m.max_ac_kw, m.max_dc_kw, m.payload_kg,
        m.purchase_price, m.notes, m.is_active, id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'EV model not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating EV model:', error);
    res.status(500).json({ error: 'Failed to update EV model' });
  }
});

// GET /api/ev-models/match/:segment - Get models matching a segment
router.get('/match/:segment', async (req: Request, res: Response) => {
  try {
    const { segment } = req.params;
    const { min_payload, min_range } = req.query;

    let sql = `SELECT * FROM ev_models WHERE is_active = TRUE AND segment = $1`;
    const params: unknown[] = [segment];
    let idx = 2;

    if (min_payload) {
      sql += ` AND payload_kg >= $${idx++}`;
      params.push(parseFloat(min_payload as string));
    }

    sql += ' ORDER BY battery_usable_kwh DESC, purchase_price ASC';

    const result = await query<EVModel>(sql, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error matching EV models:', error);
    res.status(500).json({ error: 'Failed to match EV models' });
  }
});

export default router;
