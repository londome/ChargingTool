import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Project, Fleet, FleetVehicle, EVModel, Scenario, SimulationRun,
  ResultSummary, RouteResult, InfrastructureEstimate, Route,
} from '@shared/types';
import { EV_MODELS_MOCK } from './evModelsMock';
import {
  DEMO_RUN_ID,
  DEMO_SIMULATION_RUN,
  DEMO_RESULT_SUMMARY,
  DEMO_ROUTE_RESULTS,
  DEMO_INFRASTRUCTURE,
} from './simulationMock';

const BASE_URL = '/api';
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Generic fetch helper
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

// ============================================================
// PROJECTS
// ============================================================

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/projects'),
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiFetch<{
      project_count: number;
      vehicle_count: number;
      simulation_count: number;
      last_activity: string | null;
    }>('/projects/dashboard-stats'),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => apiFetch<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useProjectSummary(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id, 'summary'],
    queryFn: () => apiFetch<{
      project: Project;
      fleet_count: number;
      route_count: number;
      scenario_count: number;
      latest_run: SimulationRun | null;
    }>(`/projects/${id}/summary`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Project>) =>
      apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Project> & { id: string }) =>
      apiFetch<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['projects', id] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

// ============================================================
// FLEETS
// ============================================================

export function useFleet(projectId: string | undefined) {
  return useQuery({
    queryKey: ['fleets', projectId],
    queryFn: () => apiFetch<Fleet[]>(`/fleets?project_id=${projectId}`),
    enabled: !!projectId,
  });
}

export function useCreateFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { project_id: string; vehicle_count: number; notes?: string; vehicles: Partial<FleetVehicle>[] }) =>
      apiFetch<Fleet>('/fleets', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, { project_id }) => qc.invalidateQueries({ queryKey: ['fleets', project_id] }),
  });
}

export function useUpdateFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Fleet> & { id: string; project_id: string }) =>
      apiFetch<Fleet>(`/fleets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleets'] }),
  });
}

// ============================================================
// ROUTES
// ============================================================

export function useRoutes(projectId: string | undefined) {
  return useQuery({
    queryKey: ['routes', projectId],
    queryFn: () => apiFetch<{ data: Route[]; total: number }>(`/routes?project_id=${projectId}`),
    enabled: !!projectId,
  });
}

export function useAddManualRoutes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { project_id: string; routes: Partial<Route>[] }) =>
      apiFetch('/routes/manual', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

/** Clears ALL routes for a project before re-importing (replace semantics). */
export function useClearRoutes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/routes/project/${projectId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

// ============================================================
// EV MODELS
// ============================================================

export function useEVModels(filters?: { segment?: string; manufacturer?: string }) {
  const params = new URLSearchParams();
  if (filters?.segment) params.set('segment', filters.segment);
  if (filters?.manufacturer) params.set('manufacturer', filters.manufacturer);
  const qs = params.toString();
  return useQuery({
    queryKey: ['ev-models', filters],
    queryFn: async (): Promise<EVModel[]> => {
      if (DEMO_MODE) return EV_MODELS_MOCK;
      try {
        return await apiFetch<EVModel[]>(`/ev-models${qs ? `?${qs}` : ''}`);
      } catch {
        return EV_MODELS_MOCK;
      }
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useEVModel(id: string | undefined) {
  return useQuery({
    queryKey: ['ev-models', id],
    queryFn: async () => {
      if (DEMO_MODE) return EV_MODELS_MOCK.find(m => m.id === id) ?? null;
      try {
        return await apiFetch<EVModel>(`/ev-models/${id}`);
      } catch {
        return EV_MODELS_MOCK.find(m => m.id === id) ?? null;
      }
    },
    enabled: !!id,
    retry: false,
  });
}

// ============================================================
// SCENARIOS
// ============================================================

export function useScenarios(projectId: string | undefined) {
  return useQuery({
    queryKey: ['scenarios', projectId],
    queryFn: () => apiFetch<Scenario[]>(`/scenarios?project_id=${projectId}`),
    enabled: !!projectId,
  });
}

export function useScenario(id: string | undefined) {
  return useQuery({
    queryKey: ['scenarios', id],
    queryFn: () => apiFetch<Scenario>(`/scenarios/${id}`),
    enabled: !!id,
  });
}

export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Scenario>) =>
      apiFetch<Scenario>('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useUpdateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Scenario> & { id: string }) =>
      apiFetch<Scenario>(`/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/scenarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

export function useDuplicateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Scenario>(`/scenarios/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
}

// ============================================================
// SIMULATIONS
// ============================================================

export function useRunSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { project_id: string; scenario_id: string }) =>
      apiFetch<{ run_id: string; status: string }>('/simulations/run', {
        method: 'POST', body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['simulations'] }),
  });
}

export function useSimulationStatus(runId: string | undefined) {
  return useQuery({
    queryKey: ['simulations', 'status', runId],
    queryFn: async () => {
      if (DEMO_MODE || runId === DEMO_RUN_ID) return DEMO_SIMULATION_RUN;
      return apiFetch<SimulationRun>(`/simulations/${runId}/status`);
    },
    enabled: !!runId,
    retry: false,
    refetchInterval: (data) => {
      if (DEMO_MODE) return false;
      const run = data.state.data as SimulationRun | undefined;
      if (run?.status === 'completed' || run?.status === 'failed') return false;
      return 500;
    },
  });
}

export function useSimulationRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: ['simulations', 'project', projectId],
    queryFn: () => apiFetch<SimulationRun[]>(`/simulations/project/${projectId}`),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const runs = (query.state.data ?? []) as SimulationRun[];
      const hasActive = runs.some(r => r.status === 'pending' || r.status === 'running');
      return hasActive ? 1000 : false;
    },
  });
}

export function useSimulationResults(runId: string | undefined) {
  return useQuery({
    queryKey: ['simulations', 'results', runId],
    queryFn: async () => {
      if (DEMO_MODE || runId === DEMO_RUN_ID) {
        return {
          run: DEMO_SIMULATION_RUN,
          summary: DEMO_RESULT_SUMMARY,
          route_results: DEMO_ROUTE_RESULTS,
          infrastructure: DEMO_INFRASTRUCTURE,
        };
      }
      return apiFetch<{
        run: SimulationRun;
        summary: ResultSummary;
        route_results: RouteResult[];
        infrastructure: InfrastructureEstimate;
      }>(`/simulations/${runId}/results`);
    },
    enabled: !!runId,
    retry: false,
  });
}

export function useSimulationSummary(runId: string | undefined) {
  return useQuery({
    queryKey: ['simulations', 'summary', runId],
    queryFn: async () => {
      if (DEMO_MODE || runId === DEMO_RUN_ID) return DEMO_RESULT_SUMMARY;
      return apiFetch<ResultSummary>(`/simulations/${runId}/summary`);
    },
    enabled: !!runId,
    retry: false,
  });
}

// ============================================================
// EXPORT HELPERS
// ============================================================

export async function downloadExport(runId: string, format: 'csv' | 'xlsx') {
  const url = `/api/exports/results/${runId}/${format}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `simulation_${runId.substring(0, 8)}_ergebnisse.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    alert('Export nicht verfügbar. Bitte führen Sie zuerst eine neue Simulation durch.');
  }
}

// ============================================================
// FILE UPLOAD
// ============================================================

export async function previewFile(file: File): Promise<{
  headers: string[];
  rows: Record<string, string>[];
  total_rows: number;
}> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/routes/preview`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Preview failed');
  const json = await res.json();
  return json.data;
}

export async function uploadRoutes(
  file: File,
  projectId: string,
  mapping: Record<string, string>
): Promise<{ imported: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);
  formData.append('mapping', JSON.stringify(mapping));
  const res = await fetch(`${BASE_URL}/routes/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  const json = await res.json();
  return json.data;
}
