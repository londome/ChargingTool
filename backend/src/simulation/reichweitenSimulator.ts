/**
 * Reichweiten Simulator
 * ----------------------
 * Physikalisch motivierte Machbarkeitsanalyse für Elektrofahrzeuge.
 * Verwendet physicsEngine.ts für realitätsnahe Verbrauchsberechnung.
 *
 * Kernfunktionen:
 *   - Kalibriertes Verbrauchsmodell je EV-Modell und Fahrsegment
 *   - Routenspezifische SOC-Simulation (basierend auf Avg-Speed + Zuladung)
 *   - Gesamtreichweite basierend auf Nutzungsmix des Betreibers
 *   - Empfehlung der besten Alternativen aus der EV-Bibliothek
 */

import { query } from '../database/db';
import { Route, EVModel, FeasibilityStatus } from '../../../shared/types';
import {
  buildVehiclePhysics,
  buildRouteProfile,
  calculateProfileEnergy,
  simulateRange,
  DEFAULT_SOC_START,
  DEFAULT_SOC_MIN,
  UsageMix,
  RangeSimResult,
} from './physicsEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SimParams {
  temperature_c: number;
  hvac_on: boolean;
  city_share: number;
  rural_share: number;
  hwy_share: number;
}

// Route extended with per-route sim conditions from DB
interface RouteWithConditions extends Route {
  sim_temperature_c?: number | null;
  sim_hvac_on?: boolean | null;
  sim_city_share?: number | null;
  sim_rural_share?: number | null;
  sim_hwy_share?: number | null;
}

const DEFAULT_SIM_PARAMS: SimParams = {
  temperature_c: 15,
  hvac_on: false,
  city_share: 0.5,
  rural_share: 0.3,
  hwy_share: 0.2,
};

export interface RouteReichweitenResult {
  route_id: string;
  route_name: string | null;
  distance_km: number;
  feasibility: FeasibilityStatus;
  soc_arrival_pct: number;       // SOC bei Ankunft [%]
  energy_needed_kwh: number;     // Verbrauchte Energie auf dieser Route [kWh]
  range_margin_km: number;       // Verbleibende Reichweite nach der Route [km]
}

export interface EVReichweitenResult {
  ev_model_id: string;
  ev_model_name: string;
  manufacturer: string;
  segment: string;
  battery_kwh: number;
  consumption_kwh_100km: number;  // Physikalisch berechneter Verbrauch bei den Nutzungsbedingungen
  max_range_km: number;           // Reichweite bei diesem Nutzungsmix
  calibration_factor: number;     // Kalibrierfaktor (Transparenz)
  route_results: RouteReichweitenResult[];
  summary: {
    total_routes: number;
    feasible: number;
    feasible_pct: number;
    not_feasible: number;
  };
}

export interface ReichweitenSimulationResult {
  project_id: string;
  soc_start: number;
  soc_min: number;
  selected_ev_results: EVReichweitenResult[];
  recommended_ev_results: EVReichweitenResult[];
  has_selection: boolean;
  routes_count: number;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_RECOMMENDATIONS = 5;

// ── Core evaluator ────────────────────────────────────────────────────────────

function getRouteConditions(route: RouteWithConditions): SimParams {
  return {
    temperature_c: route.sim_temperature_c ?? DEFAULT_SIM_PARAMS.temperature_c,
    hvac_on:       route.sim_hvac_on      ?? DEFAULT_SIM_PARAMS.hvac_on,
    city_share:    route.sim_city_share   ?? DEFAULT_SIM_PARAMS.city_share,
    rural_share:   route.sim_rural_share  ?? DEFAULT_SIM_PARAMS.rural_share,
    hwy_share:     route.sim_hwy_share    ?? DEFAULT_SIM_PARAMS.hwy_share,
  };
}

function evaluateEV(
  ev: EVModel,
  routes: RouteWithConditions[],
): EVReichweitenResult {
  // Kalibriertes Basisfahrzeug ohne Zuladung
  // parseFloat: PostgreSQL DECIMAL-Felder kommen als Strings aus dem pg-Treiber
  const battery_kwh_num = parseFloat(String(ev.battery_usable_kwh));
  const nominal_kwh_num = parseFloat(String(ev.nominal_consumption_kwh_100km));
  const baseVehicle = buildVehiclePhysics(
    battery_kwh_num,
    nominal_kwh_num,
    ev.segment,
    0
  );

  // Für Gesamtreichweite: Durchschnittsbedingungen über alle Routen
  const avgTemp = routes.reduce((s, r) => s + (r.sim_temperature_c ?? 15), 0) / routes.length;
  const avgCity = routes.reduce((s, r) => s + (r.sim_city_share ?? 0.5), 0) / routes.length;
  const avgRural = routes.reduce((s, r) => s + (r.sim_rural_share ?? 0.3), 0) / routes.length;
  const avgHwy = routes.reduce((s, r) => s + (r.sim_hwy_share ?? 0.2), 0) / routes.length;
  const anyHvac = routes.some(r => r.sim_hvac_on);
  const avgMix: UsageMix = { city_share: avgCity, rural_share: avgRural, hwy_share: avgHwy };

  const rangeResult: RangeSimResult = simulateRange(baseVehicle, avgMix, avgTemp, anyHvac);
  const max_range_km = Math.round(rangeResult.range_km);
  const consumption_kwh_100km = Math.round(rangeResult.consumption_kwh_per_100km * 10) / 10;

  let feasible = 0;
  let not_feasible = 0;

  const route_results: RouteReichweitenResult[] = routes.map((route) => {
    // Per-route Fahrbedingungen
    const cond = getRouteConditions(route);
    const mix: UsageMix = { city_share: cond.city_share, rural_share: cond.rural_share, hwy_share: cond.hwy_share };

    // Fahrzeug mit tatsächlicher Routenzuladung (parseFloat für PostgreSQL DECIMAL → string)
    const routeVehicle = {
      ...baseVehicle,
      mass_kg: baseVehicle.mass_kg + (parseFloat(String(route.payload_kg ?? 0)) || 0),
    };

    // Routenspezifisches Fahrprofil basierend auf Durchschnittsgeschwindigkeit
    const routeProfile = buildRouteProfile(
      route.avg_speed_kmh != null ? parseFloat(String(route.avg_speed_kmh)) : null
    );

    // Physikalischer Verbrauch für diese Route mit ihren eigenen Bedingungen [kWh/km]
    const breakdown = calculateProfileEnergy(routeVehicle, routeProfile, cond.temperature_c, cond.hvac_on);

    // Distanz pro Tour (nicht Jahres-Distanz!)
    // PostgreSQL DECIMAL kommt als String → explizit parsen
    const tour_distance_km = parseFloat(String(route.distance_km));
    const battery_kwh = parseFloat(String(ev.battery_usable_kwh));

    // Energie für eine Fahrt [kWh]
    const energy_kwh = breakdown.e_total * tour_distance_km;

    // SOC-Simulation: Abfahrt bei DEFAULT_SOC_START
    const delta_soc_pct = (energy_kwh / battery_kwh) * 100;
    const soc_arrival = DEFAULT_SOC_START - delta_soc_pct;

    // Verbleibende nutzbare Reichweite nach Ankunft [km]
    const remaining_kwh = Math.max(0, ((soc_arrival - DEFAULT_SOC_MIN) / 100) * battery_kwh);
    const range_margin_km = breakdown.e_total > 0
      ? Math.round(remaining_kwh / breakdown.e_total)
      : 0;

    const is_feasible = soc_arrival >= DEFAULT_SOC_MIN;
    if (is_feasible) feasible++; else not_feasible++;

    // route_id y route_name desde la BD
    const routeId = (route as unknown as { route_id?: string; id: string }).route_id
      ?? (route as unknown as { id: string }).id;

    return {
      route_id: routeId,
      route_name: routeId,   // Anzeigename = route_id (z.B. "TOUR_001")
      distance_km: tour_distance_km,
      feasibility: is_feasible ? FeasibilityStatus.FEASIBLE : FeasibilityStatus.NOT_FEASIBLE,
      soc_arrival_pct: Math.round(soc_arrival * 10) / 10,
      energy_needed_kwh: Math.round(energy_kwh * 10) / 10,
      range_margin_km: Math.max(0, range_margin_km),
    };
  });

  const total = routes.length;

  return {
    ev_model_id: ev.id,
    ev_model_name: `${ev.manufacturer} ${ev.model}`,
    manufacturer: ev.manufacturer,
    segment: ev.segment,
    battery_kwh: ev.battery_usable_kwh,
    consumption_kwh_100km,
    max_range_km,
    calibration_factor: Math.round(baseVehicle.calibration_factor * 100) / 100,
    route_results,
    summary: {
      total_routes: total,
      feasible,
      feasible_pct: total > 0 ? Math.round((feasible / total) * 100) : 0,
      not_feasible,
    },
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runReichweitenSimulation(
  projectId: string,
  selectedEVIds: string[] = [],
): Promise<ReichweitenSimulationResult> {

  // Routen mit per-Route Fahrbedingungen laden
  const routeResult = await query<RouteWithConditions>(
    `SELECT * FROM routes WHERE project_id = $1 ORDER BY distance_km DESC`,
    [projectId]
  );
  const routes = routeResult.rows;

  if (routes.length === 0) {
    throw new Error('Keine Routen für dieses Projekt gefunden.');
  }

  // Alle EV-Modelle laden
  const evResult = await query<EVModel>(
    `SELECT * FROM ev_models ORDER BY segment, manufacturer, model`
  );
  const allEVModels = evResult.rows;

  if (allEVModels.length === 0) {
    throw new Error('Keine EV-Modelle in der Datenbank gefunden.');
  }

  const hasSelection = selectedEVIds.length > 0;

  // Ausgewählte EV-Modelle evaluieren
  const selectedModels = hasSelection
    ? allEVModels.filter(ev => selectedEVIds.includes(ev.id))
    : [];

  const selected_ev_results: EVReichweitenResult[] = selectedModels.map(ev =>
    evaluateEV(ev, routes)
  );

  // Restliche Modelle für Empfehlungen evaluieren
  const selectedIdSet = new Set(selectedEVIds);
  const otherModels = allEVModels.filter(ev => !selectedIdSet.has(ev.id));

  const recommended_ev_results = otherModels
    .map(ev => evaluateEV(ev, routes))
    .sort((a, b) =>
      b.summary.feasible_pct - a.summary.feasible_pct ||
      b.max_range_km - a.max_range_km
    )
    .slice(0, MAX_RECOMMENDATIONS);

  return {
    project_id: projectId,
    soc_start: DEFAULT_SOC_START,
    soc_min: DEFAULT_SOC_MIN,
    selected_ev_results,
    recommended_ev_results,
    has_selection: hasSelection,
    routes_count: routes.length,
    created_at: new Date().toISOString(),
  };
}
