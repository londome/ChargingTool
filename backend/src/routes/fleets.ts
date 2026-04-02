import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { Fleet, FleetVehicle } from '../../../shared/types';

const router = Router();

// GET /api/fleets?project_id=xxx - Get fleets for project
router.get('/', async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    const result = await query<Fleet>(
      'SELECT * FROM fleets WHERE project_id = $1',
      [project_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching fleets:', error);
    res.status(500).json({ error: 'Failed to fetch fleets' });
  }
});

// GET /api/fleets/:id - Get fleet with vehicles
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [fleetResult, vehiclesResult] = await Promise.all([
      query<Fleet>('SELECT * FROM fleets WHERE id = $1', [id]),
      query<FleetVehicle>('SELECT * FROM fleet_vehicles WHERE fleet_id = $1', [id]),
    ]);

    if (!fleetResult.rows.length) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    res.json({
      data: {
        ...fleetResult.rows[0],
        vehicles: vehiclesResult.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching fleet:', error);
    res.status(500).json({ error: 'Failed to fetch fleet' });
  }
});

// POST /api/fleets - Create fleet with vehicles
router.post('/', async (req: Request, res: Response) => {
  try {
    const { project_id, vehicle_count, notes, vehicles = [] } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const fleetId = uuidv4();

    // Calculate total vehicle count from vehicles array if not provided
    const totalCount = vehicle_count ?? vehicles.reduce((sum: number, v: FleetVehicle) => sum + (v.count || 0), 0);

    const fleetResult = await query<Fleet>(
      'INSERT INTO fleets (id, project_id, vehicle_count, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [fleetId, project_id, totalCount, notes || null]
    );

    // Insert fleet vehicles
    const insertedVehicles: FleetVehicle[] = [];
    for (const vehicle of vehicles) {
      const vehicleId = uuidv4();
      const vResult = await query<FleetVehicle>(
        `INSERT INTO fleet_vehicles
          (id, fleet_id, segment, fuel_type, count, consumption_l_100km, annual_km, payload_kg,
           maintenance_cost_annual, acquisition_type, capex, lease_monthly)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          vehicleId, fleetId, vehicle.segment, vehicle.fuel_type, vehicle.count,
          vehicle.consumption_l_100km, vehicle.annual_km, vehicle.payload_kg,
          vehicle.maintenance_cost_annual, vehicle.acquisition_type || 'purchase',
          vehicle.capex || null, vehicle.lease_monthly || null,
        ]
      );
      insertedVehicles.push(vResult.rows[0]);
    }

    res.status(201).json({
      data: { ...fleetResult.rows[0], vehicles: insertedVehicles },
    });
  } catch (error) {
    console.error('Error creating fleet:', error);
    res.status(500).json({ error: 'Failed to create fleet' });
  }
});

// PUT /api/fleets/:id - Update fleet
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vehicle_count, notes } = req.body;

    const result = await query<Fleet>(
      `UPDATE fleets SET vehicle_count = COALESCE($1, vehicle_count), notes = COALESCE($2, notes) WHERE id = $3 RETURNING *`,
      [vehicle_count, notes, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating fleet:', error);
    res.status(500).json({ error: 'Failed to update fleet' });
  }
});

// DELETE /api/fleets/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM fleets WHERE id = $1', [id]);
    res.json({ message: 'Fleet deleted' });
  } catch (error) {
    console.error('Error deleting fleet:', error);
    res.status(500).json({ error: 'Failed to delete fleet' });
  }
});

// POST /api/fleets/:id/vehicles - Add vehicle to fleet
router.post('/:id/vehicles', async (req: Request, res: Response) => {
  try {
    const { id: fleetId } = req.params;
    const vehicle = req.body;
    const vehicleId = uuidv4();

    const result = await query<FleetVehicle>(
      `INSERT INTO fleet_vehicles
        (id, fleet_id, segment, fuel_type, count, consumption_l_100km, annual_km, payload_kg,
         maintenance_cost_annual, acquisition_type, capex, lease_monthly)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        vehicleId, fleetId, vehicle.segment, vehicle.fuel_type, vehicle.count,
        vehicle.consumption_l_100km, vehicle.annual_km, vehicle.payload_kg,
        vehicle.maintenance_cost_annual, vehicle.acquisition_type || 'purchase',
        vehicle.capex || null, vehicle.lease_monthly || null,
      ]
    );

    // Update fleet vehicle count
    await query(
      `UPDATE fleets SET vehicle_count = (SELECT COALESCE(SUM(count), 0) FROM fleet_vehicles WHERE fleet_id = $1) WHERE id = $1`,
      [fleetId]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error adding fleet vehicle:', error);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// PUT /api/fleets/vehicles/:vehicleId - Update vehicle
router.put('/vehicles/:vehicleId', async (req: Request, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const v = req.body;

    const result = await query<FleetVehicle>(
      `UPDATE fleet_vehicles SET
        segment = COALESCE($1, segment),
        fuel_type = COALESCE($2, fuel_type),
        count = COALESCE($3, count),
        consumption_l_100km = COALESCE($4, consumption_l_100km),
        annual_km = COALESCE($5, annual_km),
        payload_kg = COALESCE($6, payload_kg),
        maintenance_cost_annual = COALESCE($7, maintenance_cost_annual),
        acquisition_type = COALESCE($8, acquisition_type),
        capex = COALESCE($9, capex),
        lease_monthly = COALESCE($10, lease_monthly)
       WHERE id = $11 RETURNING *`,
      [
        v.segment, v.fuel_type, v.count, v.consumption_l_100km, v.annual_km,
        v.payload_kg, v.maintenance_cost_annual, v.acquisition_type,
        v.capex, v.lease_monthly, vehicleId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// DELETE /api/fleets/vehicles/:vehicleId
router.delete('/vehicles/:vehicleId', async (req: Request, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const vehicleResult = await query<FleetVehicle>(
      'DELETE FROM fleet_vehicles WHERE id = $1 RETURNING fleet_id',
      [vehicleId]
    );

    if (vehicleResult.rows.length) {
      const fleetId = (vehicleResult.rows[0] as unknown as { fleet_id: string }).fleet_id;
      await query(
        `UPDATE fleets SET vehicle_count = (SELECT COALESCE(SUM(count), 0) FROM fleet_vehicles WHERE fleet_id = $1) WHERE id = $1`,
        [fleetId]
      );
    }

    res.json({ message: 'Vehicle deleted' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

export default router;
