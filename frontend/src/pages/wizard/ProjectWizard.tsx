import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import { useRunReichweitenSimulation, useRoutes, useProject, useFleet } from '@/lib/api';
import Step1ProjectContext from './steps/Step1ProjectContext';
import Step3Mobility from './steps/Step3Mobility';
import Step3Depot from './steps/Step3Depot';
import Step4Ladeinfrastruktur from './steps/Step4Ladeinfrastruktur';
import Step5EVSelection from './steps/Step5EVSelection';
import Step6Scenarios from './steps/Step6Scenarios';
import Step3ReichweitenEVSelection from './steps/Step3ReichweitenEVSelection';
import Step4ReichweitenParams from './steps/Step4ReichweitenParams';
import Step3LadeprozessEV from './steps/Step3LadeprozessEV';
import Step7ChargingStrategy from './steps/Step7ChargingStrategy';
import Step4ArbitrageStrategy from './steps/Step4ArbitrageStrategy';
import ModuleSelector from './ModuleSelector';

// Steps for each module
const STEPS_OPTIMIERUNG = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilitätsprofil' },
  { number: 3, label: 'Depot' },
  { number: 4, label: 'Ladeinfrastruktur' },
  { number: 5, label: 'EV-Auswahl' },
  { number: 6, label: 'Ladestrategie' },
  // Szenarien (Step6Scenarios) intentionally omitted — reserved for future use
];

const STEPS_LADEPROZESS = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilitätsprofil' },
  { number: 3, label: 'EV-Auswahl' },
  { number: 4, label: 'Depot' },
  { number: 5, label: 'Ladeinfrastruktur' },
  { number: 6, label: 'Szenarien' },
];

const STEPS_REICHWEITEN = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilitätsprofil' },
  { number: 3, label: 'EV-Auswahl' },
];

const STEPS_BIDIREKTIONAL = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilitätsprofil' },
  { number: 3, label: 'Depot & Netzanschluss' },
  { number: 4, label: 'Ladeinfrastruktur' },
  { number: 5, label: 'EV-Auswahl' },
  { number: 6, label: 'Arbitrage-Strategie' },
];

// ── Read-only mobility summary shown when reusing a Reichweiten project ──────
function ReuseMobilityReadOnly({ onNext }: {
  onNext: () => void;
}) {
  const { wizard } = useProjectStore();
  const { data: routesData, isLoading } = useRoutes(wizard.projectId ?? undefined);
  const routes = routesData?.data ?? [];

  // Always derive count from routes — this is the source of truth
  const totalFromRoutes = routes.reduce((s, r) => s + (r.vehicle_count ?? 1), 0);
  const displayCount = isLoading ? '…' : (totalFromRoutes || wizard.step3TotalVehicles || '–');

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Mobilitätsprofil</h2>
        <p className="text-sm text-slate-500 mt-1">
          Aus dem Reichweiten-Projekt übernommen — keine Änderungen nötig.
        </p>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3 p-4 bg-[#e6f3fc] rounded border border-[#0079C0]/30">
          <RefreshCw className="h-5 w-5 text-[#0079C0] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#001141]">Mobilitätsdaten aus Reichweiten-Analyse importiert</p>
            <p className="text-xs text-slate-600 mt-1">
              {isLoading
                ? 'Lade Mobilitätsdaten…'
                : <><strong>{displayCount} Fahrzeuge</strong> · {routes.length} Touren übernommen. Die Daten werden für die Ladeinfrastruktur-Simulation verwendet.</>
              }
            </p>
          </div>
        </div>
        {routes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-3 py-2 font-normal text-slate-500">Tour-ID</th>
                  <th className="text-right px-3 py-2 font-normal text-slate-500">Distanz</th>
                  <th className="text-right px-3 py-2 font-normal text-slate-500">Fahrzeuge</th>
                </tr>
              </thead>
              <tbody>
                {routes.slice(0, 8).map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 text-slate-700">{r.route_id ?? `Tour ${i + 1}`}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{Number(r.distance_km).toFixed(0)} km</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.vehicle_count ?? 1}</td>
                  </tr>
                ))}
                {routes.length > 8 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-center text-slate-400">+ {routes.length - 8} weitere Touren</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="p-6 border-t border-slate-100 flex justify-end">
        <button
          onClick={onNext}
          className="px-5 py-2 text-sm font-medium rounded bg-[#0079C0] text-white hover:bg-[#005fa3] transition-colors"
        >
          Weiter →
        </button>
      </div>
    </div>
  );
}

export default function ProjectWizard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {
    wizard, setWizardStep, setWizardModule, setWizardProjectId,
    resetWizard, updateWizardStep1, updateWizardStep2, setWizardFleetId,
    updateWizardStep3Depot, updateWizardStep4, setWizardSelectedEVs,
  } = useProjectStore();

  const runReichweitenSimulation = useRunReichweitenSimulation();
  const [isFinishing, setIsFinishing] = useState(false);
  const [hydrated, setHydrated] = useState(!projectId); // new project = already ready

  // Fetch existing project + fleet data when opening an existing project
  const isExisting = !!projectId && wizard.projectId !== projectId;
  const { data: projectData } = useProject(isExisting ? projectId : undefined);
  const { data: fleetData } = useFleet(isExisting ? projectId : undefined);

  useEffect(() => {
    if (!projectId) {
      resetWizard();
      setHydrated(true);
    } else if (wizard.projectId === projectId) {
      // Already loaded
      setHydrated(true);
    } else if (projectData) {
      // Populate wizard from DB data
      setWizardProjectId(projectId);
      const mod = (projectData.wizard_module as any) ?? 'ladeprozess';
      setWizardModule(mod);
      // Open at last step so all steps are freely navigable
      const totalSteps = mod === 'reichweiten' ? 3
        : mod === 'ladeprozess_optimierung' ? 6
        : mod === 'ladeprozess_bidirektional' ? 6
        : 6; // ladeprozess
      setWizardStep(totalSteps);
      updateWizardStep1({
        name: projectData.name ?? '',
        country: projectData.country ?? 'DE',
        currency: (projectData as any).currency ?? 'EUR',
        fleet_type: projectData.fleet_type ?? '',
        industry: projectData.industry ?? '',
        depot_location: projectData.depot_location ?? '',
      });

      if (fleetData && fleetData.length > 0) {
        const fleet = fleetData[0];
        setWizardFleetId(fleet.id);
        if (fleet.vehicles && fleet.vehicles.length > 0) {
          updateWizardStep2(fleet.vehicles.map((v: any) => ({
            id: v.id,
            label: v.label ?? '',
            count: v.count ?? 1,
            consumption_l_100km: v.consumption_l_100km ?? 8,
            maintenance_cost_annual: v.maintenance_cost_annual ?? 2000,
            capex: v.capex ?? 0,
            lease_monthly: v.lease_monthly ?? 0,
            payload_kg: v.payload_kg ?? 0,
            vehicle_type: v.vehicle_type ?? 'van',
          })));
        }
      }

      // Restore persisted wizard config from DB
      const wc = (projectData as any).wizard_config;
      if (wc) {
        if (wc.step3Depot) updateWizardStep3Depot(wc.step3Depot);
        if (wc.step4) updateWizardStep4(wc.step4);
        if (wc.step5SelectedEVIds) setWizardSelectedEVs(wc.step5SelectedEVIds);
      }

      setHydrated(true);
    }
  }, [projectId, projectData, fleetData]);

  const STEPS = wizard.wizardModule === 'reichweiten' ? STEPS_REICHWEITEN
    : wizard.wizardModule === 'ladeprozess_optimierung' ? STEPS_OPTIMIERUNG
    : wizard.wizardModule === 'ladeprozess_bidirektional' ? STEPS_BIDIREKTIONAL
    : STEPS_LADEPROZESS;
  const currentStep = wizard.currentStep;
  const currentLabel = STEPS.find(s => s.number === currentStep)?.label ?? '';

  const handleStepClick = (n: number) => {
    // For existing projects all steps are always navigable; for new projects only up to currentStep
    if (projectId || n <= currentStep) setWizardStep(n);
  };

  // Step 2 → Step 3 (Reichweiten: just advance)
  const handleMobilityNextReichweitenModule = () => setWizardStep(3);

  // Step 3 → Launch Reichweiten simulation (conditions are stored per-route in DB)
  const handleFinishReichweitenModule = async (selectedEVIds: string[]) => {
    setIsFinishing(true);
    const pid = wizard.projectId;

    if (!pid || pid.startsWith('local_')) {
      setIsFinishing(false);
      navigate('/dashboard');
      return;
    }

    try {
      await runReichweitenSimulation.mutateAsync({
        project_id: pid,
        selected_ev_ids: selectedEVIds,
      });
    } catch (e) {
      console.warn('Reichweiten-Simulation konnte nicht gestartet werden', e);
    } finally {
      setIsFinishing(false);
      navigate(`/projekte/${pid}/ergebnisse/reichweiten`);
    }
  };

  // Show module selector on new project creation
  if (!projectId && wizard.wizardModule === null) {
    return (
      <ModuleSelector
        onSelect={(module) => { if (module !== null) setWizardModule(module); }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-light text-[#001141]">
          {projectId ? 'Projekt bearbeiten' : 'Neues Projekt erstellen'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Schritt {currentStep} von {STEPS.length} – {currentLabel}
          {wizard.wizardModule === 'reichweiten' && (
            <span className="ml-2 text-xs bg-[#e6f3fc] text-[#0079C0] px-2 py-0.5 rounded-full font-medium">
              Reichweiten Simulator
            </span>
          )}
          {wizard.wizardModule === 'ladeprozess' && (
            <span className="ml-2 text-xs bg-[#e6f3fc] text-[#0079C0] px-2 py-0.5 rounded-full font-medium">
              Ladeprozess Simulator
            </span>
          )}
          {wizard.wizardModule === 'ladeprozess_optimierung' && (
            <span className="ml-2 text-xs bg-[#e8f5f0] text-[#043F2E] px-2 py-0.5 rounded-full font-medium">
              Ladeprozess Optimierung
            </span>
          )}
          {wizard.wizardModule === 'ladeprozess_bidirektional' && (
            <span className="ml-2 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Bidirektional & Arbitrage
            </span>
          )}
        </p>
      </div>

      {/* Step navigator */}
      <div className="flex items-center">
        {STEPS.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <button
              onClick={() => handleStepClick(step.number)}
              disabled={!projectId && step.number > currentStep}
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-colors shrink-0',
                step.number === currentStep ? 'bg-[#0079C0] text-white ring-4 ring-[#cce6f8]'
                : (projectId || step.number < currentStep) ? 'bg-[#0079C0] text-white cursor-pointer hover:bg-[#005fa3]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
              title={step.label}
            >
              {(step.number < currentStep || (!!projectId && step.number !== currentStep)) ? <Check className="h-4 w-4" /> : String(step.number)}
            </button>
            <div className="flex flex-col ml-2 mr-2 flex-1 min-w-0">
              <span className={cn(
                'text-xs font-medium truncate hidden sm:block',
                step.number === currentStep ? 'text-[#0079C0]' : 'text-slate-400'
              )}>
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  'h-0.5 mt-1 rounded-full hidden sm:block',
                  step.number < currentStep ? 'bg-[#0079C0]' : 'bg-slate-200'
                )} />
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 rounded-full sm:hidden mx-1',
                step.number < currentStep ? 'bg-blue-600' : 'bg-slate-200'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {!hydrated ? (
        <div className="bg-white rounded border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-400">
          Lade Projektdaten…
        </div>
      ) : null}
      <div className={cn('bg-white rounded border border-slate-200 shadow-sm', !hydrated && 'hidden')} key={hydrated ? projectId ?? 'new' : 'loading'}>
        {currentStep === 1 && <Step1ProjectContext />}

        {currentStep === 2 && wizard.reuseReichweitenProjectId ? (
          <ReuseMobilityReadOnly onNext={() => setWizardStep(wizard.wizardModule === 'ladeprozess' ? 4 : 3)} />
        ) : currentStep === 2 ? (
          <Step3Mobility
            onFinish={wizard.wizardModule === 'reichweiten' ? handleMobilityNextReichweitenModule : undefined}
            isFinishing={false}
          />
        ) : null}

        {/* Reichweiten module steps */}
        {wizard.wizardModule === 'reichweiten' && currentStep === 3 && (
          <Step3ReichweitenEVSelection
            onFinish={handleFinishReichweitenModule}
            isFinishing={isFinishing}
          />
        )}

        {/* Ladeprozess module steps */}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 3 && (
          <Step3LadeprozessEV onFinish={() => setWizardStep(4)} />
        )}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 4 && <Step3Depot />}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 5 && <Step4Ladeinfrastruktur />}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 6 && <Step6Scenarios />}

        {/* Ladeprozess Optimierung module steps (6-step flow, Szenarien skipped) */}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 3 && <Step3Depot />}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 4 && <Step4Ladeinfrastruktur />}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 5 && <Step5EVSelection />}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 6 && <Step7ChargingStrategy />}

        {/* Ladeprozess Bidirektional module steps (4-step flow) */}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 3 && <Step3Depot />}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 4 && <Step4Ladeinfrastruktur />}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 5 && <Step5EVSelection />}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 6 && <Step4ArbitrageStrategy />}
      </div>
    </div>
  );
}
