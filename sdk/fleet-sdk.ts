/**
 * Fleet Electrification SDK
 * -------------------------
 * Cliente TypeScript para la API del backend de Fleet Electrification.
 *
 * Uso básico:
 *   import { FleetClient } from './fleet-sdk';
 *   const client = new FleetClient('http://localhost:3001');
 *   const projects = await client.projects.list();
 */

// ─── Tipos base ───────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  country?: string;
  currency?: string;
  fleet_type?: string;
  industry?: string;
  depot_location?: string;
  wizard_module?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProjectInput {
  name: string;
  country?: string;
  currency?: string;
  fleet_type?: string;
  industry?: string;
  depot_location?: string;
  wizard_module?: string;
}

export interface Fleet {
  id: string;
  project_id: string;
  vehicle_count: number;
  notes?: string;
}

export interface FleetVehicle {
  id: string;
  fleet_id: string;
  segment: string;
  fuel_type: string;
  count: number;
  daily_distance_km?: number;
  payload_kg?: number;
  annual_mileage_km?: number;
}

export interface Route {
  id: string;
  project_id: string;
  name: string;
  distance_km: number;
  trips_per_year?: number;
}

export interface Scenario {
  id: string;
  project_id: string;
  name: string;
  type?: string;
  electricity_price_eur_kwh?: number;
  diesel_price_eur_l?: number;
  ev_acquisition_type?: string;
  annual_km_growth_rate?: number;
}

export interface CreateScenarioInput {
  project_id: string;
  name: string;
  type?: string;
  electricity_price_eur_kwh?: number;
  diesel_price_eur_l?: number;
  ev_acquisition_type?: string;
  annual_km_growth_rate?: number;
}

export interface SimulationRun {
  run_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface SimulationResults {
  run_id: string;
  route_results: RouteResult[];
  summary: ResultSummary;
}

export interface RouteResult {
  route_id: string;
  route_name: string;
  distance_km: number;
  feasibility_status: string;
  energy_kwh?: number;
  co2_kg?: number;
}

export interface ResultSummary {
  total_routes: number;
  feasible_routes: number;
  total_energy_kwh?: number;
  total_co2_kg?: number;
  tco_savings_eur?: number;
}

export interface EVModel {
  id: string;
  brand: string;
  model: string;
  segment: string;
  battery_kwh: number;
  range_km: number;
  max_ac_kw?: number;
  max_dc_kw?: number;
  purchase_price_eur?: number;
}

export interface OptimizationRunResult {
  run_id: string;
  status: string;
  total_cost_eur?: number;
  total_energy_kwh?: number;
  naive_total_cost_eur?: number;
  fleet_power_kw?: number[];
}

export interface ArbitrageRunResult {
  run_id: string;
  status: string;
  total_cost_eur?: number;
  total_revenue_eur?: number;
  charge_only_cost_eur?: number;
  cycles?: number;
}

// ─── Error personalizado ──────────────────────────────────────────────────────

export class FleetAPIError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`[${status}] ${endpoint} — ${message}`);
    this.name = 'FleetAPIError';
  }
}

// ─── Cliente base ─────────────────────────────────────────────────────────────

class BaseClient {
  constructor(protected baseUrl: string) {}

  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new FleetAPIError(res.status, path, json.error ?? res.statusText);
    }

    return (json.data ?? json) as T;
  }

  protected get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>('GET', path, undefined, params);
  }

  protected post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  protected put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }

  protected del<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

// ─── Módulos del SDK ──────────────────────────────────────────────────────────

class ProjectsModule extends BaseClient {
  /** Lista todos los proyectos */
  list() {
    return this.get<Project[]>('/api/projects');
  }

  /** Obtiene un proyecto por ID */
  get(id: string) {
    return this.get<Project>(`/api/projects/${id}`);
  }

  /** Crea un proyecto nuevo */
  create(input: CreateProjectInput) {
    return this.post<Project>('/api/projects', input);
  }

  /** Actualiza un proyecto */
  update(id: string, input: Partial<CreateProjectInput>) {
    return this.put<Project>(`/api/projects/${id}`, input);
  }

  /** Elimina un proyecto */
  delete(id: string) {
    return this.del<void>(`/api/projects/${id}`);
  }

  /** Resumen ejecutivo del proyecto */
  summary(id: string) {
    return this.get<Record<string, unknown>>(`/api/projects/${id}/summary`);
  }

  /** Stats del dashboard */
  dashboardStats() {
    return this.get<Record<string, unknown>>('/api/projects/dashboard-stats');
  }
}

class FleetsModule extends BaseClient {
  /** Lista flotas de un proyecto */
  list(projectId: string) {
    return this.get<Fleet[]>('/api/fleets', { project_id: projectId });
  }

  /** Obtiene una flota con sus vehículos */
  get(fleetId: string) {
    return this.get<Fleet & { vehicles: FleetVehicle[] }>(`/api/fleets/${fleetId}`);
  }

  /** Crea una flota */
  create(input: { project_id: string; vehicle_count?: number; notes?: string }) {
    return this.post<Fleet>('/api/fleets', input);
  }

  /** Agrega un vehículo a la flota */
  addVehicle(fleetId: string, vehicle: Omit<FleetVehicle, 'id' | 'fleet_id'>) {
    return this.post<FleetVehicle>(`/api/fleets/${fleetId}/vehicles`, vehicle);
  }

  /** Actualiza un vehículo */
  updateVehicle(vehicleId: string, data: Partial<FleetVehicle>) {
    return this.put<FleetVehicle>(`/api/fleets/vehicles/${vehicleId}`, data);
  }

  /** Elimina un vehículo */
  deleteVehicle(vehicleId: string) {
    return this.del<void>(`/api/fleets/vehicles/${vehicleId}`);
  }
}

class RoutesModule extends BaseClient {
  /** Lista rutas de un proyecto */
  list(projectId: string) {
    return this.get<Route[]>('/api/routes', { project_id: projectId });
  }

  /** Crea una ruta manual */
  createManual(input: { project_id: string; name: string; distance_km: number; trips_per_year?: number }) {
    return this.post<Route>('/api/routes/manual', input);
  }
}

class ScenariosModule extends BaseClient {
  /** Lista escenarios de un proyecto */
  list(projectId: string) {
    return this.get<Scenario[]>('/api/scenarios', { project_id: projectId });
  }

  /** Obtiene un escenario */
  get(id: string) {
    return this.get<Scenario>(`/api/scenarios/${id}`);
  }

  /** Crea un escenario */
  create(input: CreateScenarioInput) {
    return this.post<Scenario>('/api/scenarios', input);
  }

  /** Actualiza un escenario */
  update(id: string, input: Partial<CreateScenarioInput>) {
    return this.put<Scenario>(`/api/scenarios/${id}`, input);
  }

  /** Duplica un escenario */
  duplicate(id: string) {
    return this.post<Scenario>(`/api/scenarios/${id}/duplicate`);
  }
}

class SimulationsModule extends BaseClient {
  /** Lanza una simulación. Devuelve run_id. */
  run(projectId: string, scenarioId: string) {
    return this.post<SimulationRun>('/api/simulations/run', {
      project_id: projectId,
      scenario_id: scenarioId,
    });
  }

  /** Consulta el estado de una simulación */
  status(runId: string) {
    return this.get<SimulationRun>(`/api/simulations/${runId}/status`);
  }

  /** Obtiene los resultados de una simulación completada */
  results(runId: string) {
    return this.get<SimulationResults>(`/api/simulations/${runId}/results`);
  }

  /** Resumen de una simulación */
  summary(runId: string) {
    return this.get<ResultSummary>(`/api/simulations/${runId}/summary`);
  }

  /** Historial de simulaciones de un proyecto */
  listByProject(projectId: string) {
    return this.get<SimulationRun[]>(`/api/simulations/project/${projectId}`);
  }

  /** Última simulación de un escenario */
  latestByScenario(scenarioId: string) {
    return this.get<SimulationRun>(`/api/simulations/scenario/${scenarioId}/latest`);
  }

  /**
   * Lanza y espera hasta que la simulación termine.
   * Útil para scripts o backends que no quieren hacer polling manual.
   * @param pollIntervalMs  Intervalo de consulta en ms (default 2000)
   * @param timeoutMs       Tiempo máximo de espera en ms (default 120000)
   */
  async runAndWait(
    projectId: string,
    scenarioId: string,
    pollIntervalMs = 2000,
    timeoutMs = 120_000,
  ): Promise<SimulationResults> {
    const { run_id } = await this.run(projectId, scenarioId);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await sleep(pollIntervalMs);
      const s = await this.status(run_id);
      if (s.status === 'completed') return this.results(run_id);
      if (s.status === 'failed') throw new Error(`Simulation ${run_id} failed: ${s.error_message}`);
    }

    throw new Error(`Simulation ${run_id} timed out after ${timeoutMs}ms`);
  }
}

class EVModelsModule extends BaseClient {
  /** Lista todos los modelos EV */
  list() {
    return this.get<EVModel[]>('/api/ev-models');
  }

  /** Obtiene un modelo por ID */
  get(id: string) {
    return this.get<EVModel>(`/api/ev-models/${id}`);
  }

  /** Modelos compatibles con un segmento */
  bySegment(segment: string) {
    return this.get<EVModel[]>(`/api/ev-models/match/${segment}`);
  }
}

class OptimizationModule extends BaseClient {
  /** Lanza optimización de carga */
  run(projectId: string, params?: Record<string, unknown>) {
    return this.post<{ run_id: string }>('/api/optimization/run', {
      project_id: projectId,
      ...params,
    });
  }

  /** Resultados de una optimización */
  results(runId: string) {
    return this.get<OptimizationRunResult>(`/api/optimization/${runId}/results`);
  }

  /** Último resultado de un proyecto */
  latest(projectId: string) {
    return this.get<OptimizationRunResult>(`/api/optimization/project/${projectId}/latest`);
  }
}

class ArbitrageModule extends BaseClient {
  /** Lanza optimización V2G/bidireccional */
  run(projectId: string, params?: Record<string, unknown>) {
    return this.post<{ run_id: string }>('/api/arbitrage/run', {
      project_id: projectId,
      ...params,
    });
  }

  /** Resultados V2G */
  results(runId: string) {
    return this.get<ArbitrageRunResult>(`/api/arbitrage/${runId}/results`);
  }

  /** Último resultado de un proyecto */
  latest(projectId: string) {
    return this.get<ArbitrageRunResult>(`/api/arbitrage/project/${projectId}/latest`);
  }
}

class ExportsModule extends BaseClient {
  /** URL para descargar resultados en CSV */
  csvUrl(runId: string) {
    return `${this.baseUrl}/api/exports/results/${runId}/csv`;
  }

  /** URL para descargar resultados en XLSX */
  xlsxUrl(runId: string) {
    return `${this.baseUrl}/api/exports/results/${runId}/xlsx`;
  }

  /** URL para descargar la flota en CSV */
  fleetCsvUrl(projectId: string) {
    return `${this.baseUrl}/api/exports/fleet/${projectId}/csv`;
  }

  /** Descarga CSV de resultados como Blob (para uso en browser) */
  async downloadCsv(runId: string): Promise<Blob> {
    const res = await fetch(this.csvUrl(runId));
    if (!res.ok) throw new FleetAPIError(res.status, `/exports/results/${runId}/csv`, res.statusText);
    return res.blob();
  }
}

// ─── Cliente principal ────────────────────────────────────────────────────────

export class FleetClient {
  public readonly projects: ProjectsModule;
  public readonly fleets: FleetsModule;
  public readonly routes: RoutesModule;
  public readonly scenarios: ScenariosModule;
  public readonly simulations: SimulationsModule;
  public readonly evModels: EVModelsModule;
  public readonly optimization: OptimizationModule;
  public readonly arbitrage: ArbitrageModule;
  public readonly exports: ExportsModule;

  /**
   * @param baseUrl  URL base del backend, ej: 'http://localhost:3001'
   */
  constructor(baseUrl: string) {
    const url = baseUrl.replace(/\/$/, ''); // quitar trailing slash
    this.projects    = new ProjectsModule(url);
    this.fleets      = new FleetsModule(url);
    this.routes      = new RoutesModule(url);
    this.scenarios   = new ScenariosModule(url);
    this.simulations = new SimulationsModule(url);
    this.evModels    = new EVModelsModule(url);
    this.optimization = new OptimizationModule(url);
    this.arbitrage   = new ArbitrageModule(url);
    this.exports     = new ExportsModule(url);
  }

  /** Verifica que el servidor esté online */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.projects['baseUrl']}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ─── Utilidades internas ──────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
