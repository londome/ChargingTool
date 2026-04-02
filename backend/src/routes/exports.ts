import { Router, Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { query } from '../database/db';

const router = Router();

// GET /api/exports/results/:runId/csv
router.get('/results/:runId/csv', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const [summaryResult, routeResults] = await Promise.all([
      query('SELECT * FROM result_summaries WHERE simulation_run_id = $1', [runId]),
      query('SELECT * FROM route_results WHERE simulation_run_id = $1 ORDER BY distance_km DESC', [runId]),
    ]);

    if (!summaryResult.rows.length) {
      return res.status(404).json({ error: 'Results not found' });
    }

    const summary = summaryResult.rows[0] as Record<string, unknown>;
    const routes = routeResults.rows as Record<string, unknown>[];

    // Build CSV content
    const summaryLines = [
      'Zusammenfassung',
      `Simulationslauf ID,${runId}`,
      `Gesamtfahrzeuge,${summary.total_vehicles}`,
      `Elektrifizierbar,${summary.electrifiable_count}`,
      `Elektrifizierbar %,${summary.electrifiable_pct}`,
      `Jährl. Kraftstoffkosten ICE,${summary.annual_fuel_cost_ice}`,
      `Jährl. Stromkosten EV,${summary.annual_electricity_cost_ev}`,
      `TCO ICE,${summary.tco_ice}`,
      `TCO EV,${summary.tco_ev}`,
      `CO2e ICE (t),${summary.co2e_ice_t}`,
      `CO2e EV (t),${summary.co2e_ev_t}`,
      `CO2e-Einsparung (t),${summary.co2e_savings_t}`,
      `CO2e-Einsparung %,${summary.co2e_savings_pct}`,
      `Amortisationszeit (Jahre),${summary.payback_years}`,
      `Empf. Ladeinfrastruktur,${summary.recommended_charger_count}`,
      '',
      'Tourendaten',
    ];

    if (routes.length > 0) {
      const headers = Object.keys(routes[0]).join(',');
      summaryLines.push(headers);
      routes.forEach(r => {
        summaryLines.push(Object.values(r).join(','));
      });
    }

    const csvContent = summaryLines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="simulation_${runId.substring(0, 8)}_ergebnisse.csv"`);
    res.send('\uFEFF' + csvContent); // BOM for UTF-8 Excel compatibility
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// GET /api/exports/results/:runId/xlsx
router.get('/results/:runId/xlsx', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const [summaryResult, routeResults, infraResult, runResult] = await Promise.all([
      query('SELECT * FROM result_summaries WHERE simulation_run_id = $1', [runId]),
      query('SELECT * FROM route_results WHERE simulation_run_id = $1 ORDER BY distance_km DESC', [runId]),
      query('SELECT * FROM infrastructure_estimates WHERE simulation_run_id = $1', [runId]),
      query('SELECT sr.*, s.name as scenario_name FROM simulation_runs sr JOIN scenarios s ON s.id = sr.scenario_id WHERE sr.id = $1', [runId]),
    ]);

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summary = summaryResult.rows[0] as Record<string, unknown>;
    const summaryData = [
      ['Flottenelektrifizierung – Simulationsergebnisse'],
      ['Szenario', (runResult.rows[0] as Record<string, unknown>)?.scenario_name || ''],
      ['Erstellt am', new Date().toLocaleDateString('de-DE')],
      [],
      ['Kennzahl', 'Wert', 'Einheit'],
      ['Gesamtfahrzeuge', summary?.total_vehicles, 'Fahrzeuge'],
      ['Elektrifizierbar', summary?.electrifiable_count, 'Fahrzeuge'],
      ['Elektrifizierbar', summary?.electrifiable_pct, '%'],
      ['Jährl. Kraftstoffkosten (ICE)', summary?.annual_fuel_cost_ice, '€/Jahr'],
      ['Jährl. Stromkosten (EV)', summary?.annual_electricity_cost_ev, '€/Jahr'],
      ['OpEx ICE', summary?.opex_ice, '€/Jahr'],
      ['OpEx EV', summary?.opex_ev, '€/Jahr'],
      ['TCO ICE (Lebenszeit)', summary?.tco_ice, '€'],
      ['TCO EV (Lebenszeit)', summary?.tco_ev, '€'],
      ['CO2e ICE', summary?.co2e_ice_t, 't CO2e/Jahr'],
      ['CO2e EV', summary?.co2e_ev_t, 't CO2e/Jahr'],
      ['CO2e-Einsparung', summary?.co2e_savings_t, 't CO2e/Jahr'],
      ['CO2e-Einsparung', summary?.co2e_savings_pct, '%'],
      ['Amortisationszeit', summary?.payback_years, 'Jahre'],
      ['Empf. Ladeinfrastruktur', summary?.recommended_charger_count, 'Ladepunkte'],
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, ws1, 'Zusammenfassung');

    // Sheet 2: Route Results
    if (routeResults.rows.length > 0) {
      const routeHeaders = [
        'Tour-ID', 'Fahrzeug-ID', 'Distanz (km)', 'Kraftstoff (L)', 'Kraftstoffkosten (€)',
        'CO2e ICE (kg)', 'Energie EV (kWh)', 'Machbar ohne Laden', 'Machbar mit Laden',
        'Benötigte Ladeenergie (kWh)', 'Jährl. Kostendelta (€)', 'Jährl. CO2e-Delta (kg)',
      ];
      const routeRows = routeResults.rows.map((r: Record<string, unknown>) => [
        r.route_id, r.vehicle_id, r.distance_km, r.fuel_use_l, r.fuel_cost,
        r.ice_co2e_kg, r.ev_energy_kwh,
        r.feasible_without_charging ? 'Ja' : 'Nein',
        r.feasible_with_charging ? 'Ja' : 'Nein',
        r.required_charge_energy_kwh, r.annual_cost_delta, r.annual_co2e_delta_kg,
      ]);

      const ws2 = XLSX.utils.aoa_to_sheet([routeHeaders, ...routeRows]);
      ws2['!cols'] = routeHeaders.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(workbook, ws2, 'Tourenanalyse');
    }

    // Sheet 3: Infrastructure
    if (infraResult.rows.length > 0) {
      const infra = infraResult.rows[0] as Record<string, unknown>;
      const infraData = [
        ['Infrastrukturplanung'],
        [],
        ['Kennzahl', 'Wert'],
        ['Anzahl EV-Fahrzeuge', infra.total_ev_count],
        ['Täglicher Energiebedarf (kWh)', infra.daily_energy_demand_kwh],
        ['Benötigte Ladepunkte', infra.required_charger_count],
        ['Depot-Ladepunkte', infra.depot_chargers],
        ['Öffentliche Ladepunkte', infra.public_chargers],
        ['Durchschn. Ladeleistung (kW)', infra.avg_charging_power_kw],
        ['Ladefenster (Stunden)', infra.charging_window_hours],
      ];

      const ws3 = XLSX.utils.aoa_to_sheet(infraData);
      ws3['!cols'] = [{ wch: 35 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, ws3, 'Infrastruktur');
    }

    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="simulation_${runId.substring(0, 8)}_ergebnisse.xlsx"`);
    res.send(xlsxBuffer);
  } catch (error) {
    console.error('Error exporting XLSX:', error);
    res.status(500).json({ error: 'Failed to export XLSX' });
  }
});

// GET /api/exports/fleet/:projectId/csv - Export fleet data
router.get('/fleet/:projectId/csv', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const result = await query(
      `SELECT fv.* FROM fleet_vehicles fv
       JOIN fleets f ON f.id = fv.fleet_id
       WHERE f.project_id = $1`,
      [projectId]
    );

    const vehicles = result.rows as Record<string, unknown>[];
    const headers = [
      'ID', 'Segment', 'Kraftstofftyp', 'Anzahl', 'Verbrauch (L/100km)',
      'Jahreskilometer', 'Nutzlast (kg)', 'Wartungskosten/Jahr', 'Beschaffungsart',
    ];
    const rows = vehicles.map(v => [
      v.id, v.segment, v.fuel_type, v.count, v.consumption_l_100km,
      v.annual_km, v.payload_kg, v.maintenance_cost_annual, v.acquisition_type,
    ]);

    const csvLines = [headers.join(','), ...rows.map(r => r.join(','))];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="flotte_${projectId.substring(0, 8)}.csv"`);
    res.send('\uFEFF' + csvLines.join('\n'));
  } catch (error) {
    console.error('Error exporting fleet CSV:', error);
    res.status(500).json({ error: 'Failed to export fleet CSV' });
  }
});

export default router;
