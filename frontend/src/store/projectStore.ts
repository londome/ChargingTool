import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, Scenario, FleetVehicle, ChargingOption, VehicleSegment, FuelType, AcquisitionType } from '@shared/types';

// Lastgang (load profile) stored separately and persisted
export interface LastgangProfile {
  intervals: { time: string; power_kw: number }[];
  peak_kw: number;
  avg_kw: number;
  resolution_min: number;
  rows_total: number;
  max_grid_connection_kw: number;
}

// Wizard state types
export interface WizardStep1Data {
  name: string;
  country: string;
  currency: string;
  fleet_type: string;
  industry: string;
  depot_location: string;
  charging_options: ChargingOption[];
}

export interface WizardStep3DepotData {
  max_grid_connection_kw: number;
  voltage_level: 'NS' | 'MS' | 'HS';
  pv_capacity_kw: number;
  num_charging_points: number;
  wallbox_price_eur: number;
  installation_type: string;
}

export interface WizardVehicleRow {
  segment: VehicleSegment;
  fuel_type: FuelType;
  count: number;
  consumption_l_100km: number;
  annual_km: number;
  payload_kg: number;
  maintenance_cost_annual: number;
  acquisition_type: AcquisitionType;
  capex: number | null;
  lease_monthly: number | null;
}

export type WizardModule = 'reichweiten' | 'ladeprozess' | 'ladeprozess_optimierung' | 'ladeprozess_bidirektional' | null;

export interface ReichweitenSimParams {
  temperature_c: number;
  hvac_on: boolean;
  city_share: number;
  rural_share: number;
  hwy_share: number;
}

export interface WizardState {
  currentStep: number;
  wizardModule: WizardModule;
  step1: WizardStep1Data;
  step2Vehicles: WizardVehicleRow[];
  step3MobilityMode: 'upload' | 'manual' | 'fleet_level';
  step3TotalVehicles: number; // total EV count derived from mobility profile (used for LP default)
  step3Depot: WizardStep3DepotData;
  step4: {
    soc_start: number;
    soc_min: number;
    soc_target: number;
    charging_power_kw: number;
    charging_efficiency: number;
    electricity_price: number;
    grid_emission_factor: number;
    allow_public_charging: boolean;
    winter_surcharge: number;
  };
  step5SelectedEVIds: string[];
  step6Scenarios: Partial<Scenario>[];
  reichweitenSimParams: ReichweitenSimParams;
  projectId: string | null;
  fleetId: string | null;
  // Ladeprozess: optional reuse of a previous Reichweiten analysis
  reuseReichweitenProjectId: string | null;
  // Ladeprozess Step 3: run ID from the Zwischenergebnisse simulation
  ladeprozessReichweitenRunId: string | null;
}

interface ProjectStore {
  // Active project
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;

  // Projects list
  projects: Project[];
  setProjects: (projects: Project[]) => void;

  // Active scenario
  activeScenarioId: string | null;
  setActiveScenarioId: (id: string | null) => void;

  // Active simulation run
  activeRunId: string | null;
  setActiveRunId: (id: string | null) => void;

  // Wizard state
  wizard: WizardState;
  setWizardStep: (step: number) => void;
  setWizardModule: (module: WizardModule) => void;
  updateWizardStep1: (data: Partial<WizardStep1Data>) => void;
  updateWizardStep2: (vehicles: WizardVehicleRow[]) => void;
  setWizardMobilityMode: (mode: 'upload' | 'manual' | 'fleet_level') => void;
  setStep3TotalVehicles: (count: number) => void;
  updateWizardStep3Depot: (data: Partial<WizardStep3DepotData>) => void;
  updateWizardStep4: (data: Partial<WizardState['step4']>) => void;
  setWizardSelectedEVs: (ids: string[]) => void;
  updateReichweitenSimParams: (params: Partial<ReichweitenSimParams>) => void;
  updateWizardStep6: (scenarios: Partial<Scenario>[]) => void;
  setWizardProjectId: (id: string) => void;
  setWizardFleetId: (id: string) => void;
  setReuseReichweitenProjectId: (id: string | null) => void;
  setLadeprozessReichweitenRunId: (id: string | null) => void;
  resetWizard: () => void;

  // Depot Lastgang (load profile)
  lastgangProfile: LastgangProfile | null;
  lastgangProjectId: string | null;
  setLastgangProfile: (profile: LastgangProfile | null, projectId?: string | null) => void;

  // UI state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const defaultWizardStep3Depot: WizardStep3DepotData = {
  max_grid_connection_kw: 100,
  voltage_level: 'NS',
  pv_capacity_kw: 0,
  num_charging_points: 10,
  wallbox_price_eur: 1200,
  installation_type: 'standard',
};

const defaultWizardStep4 = {
  soc_start: 90,
  soc_min: 20,
  soc_target: 80,
  charging_power_kw: 22,
  charging_efficiency: 0.92,
  electricity_price: 0.28,
  grid_emission_factor: 0.380,
  allow_public_charging: false,
  winter_surcharge: 0.15,
};

const initialWizardState: WizardState = {
  currentStep: 1,
  wizardModule: null,
  step1: {
    name: '',
    country: 'DE',
    currency: 'EUR',
    fleet_type: '',
    industry: '',
    depot_location: '',
    charging_options: [ChargingOption.DEPOT_AC],
  },
  step2Vehicles: [],
  step3MobilityMode: 'manual',
  step3TotalVehicles: 0,
  step3Depot: defaultWizardStep3Depot,
  step4: defaultWizardStep4,
  step5SelectedEVIds: [],
  step6Scenarios: [],
  reichweitenSimParams: {
    temperature_c: 15,
    hvac_on: false,
    city_share: 0.5,
    rural_share: 0.3,
    hwy_share: 0.2,
  },
  projectId: null,
  fleetId: null,
  reuseReichweitenProjectId: null,
  ladeprozessReichweitenRunId: null,
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      activeProject: null,
      setActiveProject: (project) => set({ activeProject: project }),

      projects: [],
      setProjects: (projects) => set({ projects }),

      activeScenarioId: null,
      setActiveScenarioId: (id) => set({ activeScenarioId: id }),

      activeRunId: null,
      setActiveRunId: (id) => set({ activeRunId: id }),

      wizard: initialWizardState,
      setWizardStep: (step) => set((state) => ({
        wizard: { ...state.wizard, currentStep: step },
      })),
      setWizardModule: (module) => set((state) => ({
        wizard: { ...state.wizard, wizardModule: module },
      })),
      updateWizardStep1: (data) => set((state) => ({
        wizard: { ...state.wizard, step1: { ...state.wizard.step1, ...data } },
      })),
      updateWizardStep2: (vehicles) => set((state) => ({
        wizard: { ...state.wizard, step2Vehicles: vehicles },
      })),
      setWizardMobilityMode: (mode) => set((state) => ({
        wizard: { ...state.wizard, step3MobilityMode: mode },
      })),
      setStep3TotalVehicles: (count) => set((state) => ({
        wizard: { ...state.wizard, step3TotalVehicles: count },
      })),
      updateWizardStep3Depot: (data) => set((state) => ({
        wizard: { ...state.wizard, step3Depot: { ...state.wizard.step3Depot, ...data } },
      })),
      updateWizardStep4: (data) => set((state) => ({
        wizard: { ...state.wizard, step4: { ...state.wizard.step4, ...data } },
      })),
      setWizardSelectedEVs: (ids) => set((state) => ({
        wizard: { ...state.wizard, step5SelectedEVIds: ids },
      })),
      updateReichweitenSimParams: (params) => set((state) => ({
        wizard: { ...state.wizard, reichweitenSimParams: { ...state.wizard.reichweitenSimParams, ...params } },
      })),
      updateWizardStep6: (scenarios) => set((state) => ({
        wizard: { ...state.wizard, step6Scenarios: scenarios },
      })),
      setWizardProjectId: (id) => set((state) => ({
        wizard: { ...state.wizard, projectId: id },
      })),
      setWizardFleetId: (id) => set((state) => ({
        wizard: { ...state.wizard, fleetId: id },
      })),
      setReuseReichweitenProjectId: (id) => set((state) => ({
        wizard: { ...state.wizard, reuseReichweitenProjectId: id },
      })),
      setLadeprozessReichweitenRunId: (id) => set((state) => ({
        wizard: { ...state.wizard, ladeprozessReichweitenRunId: id },
      })),
      resetWizard: () => set({ wizard: initialWizardState }),

      lastgangProfile: null,
      lastgangProjectId: null,
      setLastgangProfile: (profile, projectId) => set({ lastgangProfile: profile, lastgangProjectId: projectId ?? null }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'fleet-electrification-store',
      partialize: (state) => ({
        activeProject: state.activeProject,
        activeScenarioId: state.activeScenarioId,
        sidebarCollapsed: state.sidebarCollapsed,
        lastgangProfile: state.lastgangProfile,
        lastgangProjectId: state.lastgangProjectId,
      }),
    }
  )
);
