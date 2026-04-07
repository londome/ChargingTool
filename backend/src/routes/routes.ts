import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { uploadSingle } from '../middleware/upload';
import { query } from '../database/db';
import { Route, ColumnMapping } from '../../../shared/types';

const router = Router();

// GET /api/routes?project_id=xxx
router.get('/', async (req: Request, res: Response) => {
  try {
    const { project_id, limit = '1000', offset = '0' } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const result = await query<Route>(
      'SELECT * FROM routes WHERE project_id = $1 ORDER BY date, route_id LIMIT $2 OFFSET $3',
      [project_id, parseInt(limit as string), parseInt(offset as string)]
    );

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM routes WHERE project_id = $1',
      [project_id]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// DELETE /api/routes/:project_id - Clear all routes for project
router.delete('/project/:project_id', async (req: Request, res: Response) => {
  try {
    const { project_id } = req.params;
    await query('DELETE FROM routes WHERE project_id = $1', [project_id]);
    res.json({ message: 'Routes cleared' });
  } catch (error) {
    console.error('Error clearing routes:', error);
    res.status(500).json({ error: 'Failed to clear routes' });
  }
});

// POST /api/routes/preview - Preview uploaded file
router.post('/preview', uploadSingle, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname.toLowerCase();
    let headers: string[] = [];
    let rows: Record<string, string>[] = [];

    if (fileName.endsWith('.csv')) {
      const csvText = fileBuffer.toString('utf-8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      headers = parsed.meta.fields || [];
      rows = (parsed.data as Record<string, string>[]).slice(0, 10);
    } else {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0]);
        rows = jsonData.slice(0, 10);
      }
    }

    res.json({
      data: {
        headers,
        rows,
        total_rows: rows.length,
        errors: [],
      },
    });
  } catch (error) {
    console.error('Error previewing file:', error);
    res.status(500).json({ error: 'Failed to parse file' });
  }
});

// POST /api/routes/upload - Upload and import routes
router.post('/upload', uploadSingle, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { project_id, mapping: mappingStr } = req.body;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const mapping: ColumnMapping = mappingStr ? JSON.parse(mappingStr) : {};
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname.toLowerCase();
    let rawRows: Record<string, string>[] = [];

    if (fileName.endsWith('.csv')) {
      const csvText = fileBuffer.toString('utf-8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, dynamicTyping: false });
      rawRows = parsed.data as Record<string, string>[];
    } else {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
    }

    const getVal = (row: Record<string, string>, mappedKey: keyof ColumnMapping, fallbackKeys: string[]): string => {
      const mapped = mapping[mappedKey];
      if (mapped && row[mapped] !== undefined) return String(row[mapped]);
      for (const k of fallbackKeys) {
        if (row[k] !== undefined) return String(row[k]);
      }
      return '';
    };

    const importedRoutes: Route[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const distanceStr = getVal(row, 'distance_km', ['distance_km', 'distance', 'km', 'Distanz_km', 'Strecke_km']);
      const distance = parseFloat(distanceStr);

      if (isNaN(distance) || distance <= 0) {
        errors.push(`Zeile ${i + 2}: Ungültige Distanz '${distanceStr}'`);
        continue;
      }

      const routeId = getVal(row, 'route_id', ['route_id', 'Tour_ID', 'TourID', 'RouteID', 'id']) || `ROUTE_${i + 1}`;
      const dateStr = getVal(row, 'date', ['date', 'Datum', 'Date']);
      const departureStr = getVal(row, 'start_time', ['departure_time', 'Abfahrtszeit', 'start_time', 'Startzeit']);
      const arrivalStr = getVal(row, 'end_time', ['arrival_time', 'Ankunftszeit', 'end_time', 'Endzeit']);

      // Required: date, departure_time, arrival_time
      if (!dateStr) {
        errors.push(`Zeile ${i + 2}: Pflichtfeld 'date' fehlt`);
        continue;
      }
      if (!departureStr) {
        errors.push(`Zeile ${i + 2}: Pflichtfeld 'departure_time' fehlt`);
        continue;
      }
      if (!arrivalStr) {
        errors.push(`Zeile ${i + 2}: Pflichtfeld 'arrival_time' fehlt`);
        continue;
      }

      const dwellStr = getVal(row, 'dwell_time_min', ['dwell_time_min', 'Standzeit_min', 'Stopzeit', 'dwell']);
      const stopsStr = getVal(row, 'stops', ['stops', 'Stopps', 'Haltestellen']);
      const consumptionStr = getVal(row, 'consumption_l_100km' as keyof ColumnMapping, ['consumption_l_100km', 'Verbrauch_l_100km', 'Verbrauch', 'consumption']);
      const vehicleCountStr = getVal(row, 'vehicle_count' as keyof ColumnMapping, ['vehicle_count', 'Anzahl_Fahrzeuge', 'Fahrzeuge', 'count']);

      const id = uuidv4();
      const result = await query<Route>(
        `INSERT INTO routes (id, project_id, vehicle_id, route_id, date, start_time, end_time,
          distance_km, stops, dwell_time_min, avg_speed_kmh, payload_kg, depot_id,
          start_location, end_location, elevation_gain_m, outside_temperature_c, source_type,
          consumption_l_100km, vehicle_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'upload',$18,$19)
         RETURNING *`,
        [
          id, project_id,
          getVal(row, 'vehicle_id', ['vehicle_id', 'Fahrzeug_ID', 'FahrzeugID']) || null,
          routeId,
          dateStr,
          departureStr,
          arrivalStr,
          distance,
          parseInt(stopsStr) || 0,
          parseFloat(dwellStr) || 0,
          parseFloat(getVal(row, 'avg_speed_kmh', ['avg_speed_kmh', 'Durchschnittsgeschwindigkeit', 'Speed_kmh'])) || null,
          parseFloat(getVal(row, 'payload_kg', ['payload_kg', 'Nutzlast_kg', 'Zuladung_kg'])) || null,
          getVal(row, 'depot_id', ['depot_id', 'Depot_ID', 'DepotID']) || null,
          getVal(row, 'start_location', ['start_location', 'Startort', 'Von']) || null,
          getVal(row, 'end_location', ['end_location', 'Zielort', 'Nach']) || null,
          parseFloat(getVal(row, 'elevation_gain_m', ['elevation_gain_m', 'Hoehenmeter', 'Steigung_m'])) || null,
          parseFloat(getVal(row, 'outside_temperature_c', ['outside_temperature_c', 'Aussentemperatur', 'Temp_C'])) || null,
          consumptionStr ? parseFloat(consumptionStr) || null : null,
          vehicleCountStr ? parseInt(vehicleCountStr) || 1 : 1,
        ]
      );
      importedRoutes.push(result.rows[0]);
    }

    res.json({
      data: {
        imported: importedRoutes.length,
        errors,
        sample: importedRoutes.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Error uploading routes:', error);
    res.status(500).json({ error: 'Failed to import routes' });
  }
});

// POST /api/routes/manual - Add manual route entries
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { project_id, routes } = req.body;
    if (!project_id || !Array.isArray(routes)) {
      return res.status(400).json({ error: 'project_id and routes array are required' });
    }

    const inserted: Route[] = [];
    for (const r of routes) {
      const id = uuidv4();
      const result = await query<Route>(
        `INSERT INTO routes (id, project_id, vehicle_id, route_id, distance_km, stops, dwell_time_min,
          avg_speed_kmh, payload_kg, source_type, start_time, end_time, vehicle_count, trips_per_year,
          sim_temperature_c, sim_hvac_on, sim_city_share, sim_rural_share, sim_hwy_share)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual',$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [
          id, project_id,
          r.vehicle_id || null,
          r.route_id || `MANUAL_${id.substring(0, 8)}`,
          r.distance_km,
          r.stops || 0,
          r.dwell_time_min || 0,
          r.avg_speed_kmh || null,
          r.payload_kg || null,
          r.start_time || null,
          r.end_time || null,
          r.vehicle_count || 1,
          r.trips_per_year || 250,
          r.sim_temperature_c ?? 15,
          r.sim_hvac_on ?? false,
          r.sim_city_share ?? 0.5,
          r.sim_rural_share ?? 0.3,
          r.sim_hwy_share ?? 0.2,
        ]
      );
      inserted.push(result.rows[0]);
    }

    res.status(201).json({ data: inserted });
  } catch (error) {
    console.error('Error adding manual routes:', error);
    res.status(500).json({ error: 'Failed to add routes' });
  }
});

export default router;
