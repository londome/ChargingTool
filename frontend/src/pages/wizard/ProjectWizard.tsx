import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import { useRunReichweitenSimulation } from '@/lib/api';
import Step1ProjectContext from './steps/Step1ProjectContext';
import Step3Mobility from './steps/Step3Mobility';
import Step3Depot from './steps/Step3Depot';
import Step4Ladeinfrastruktur from './steps/Step4Ladeinfrastruktur';
import Step5EVSelection from './steps/Step5EVSelection';
import Step6Scenarios from './steps/Step6Scenarios';
import Step3ReichweitenEVSelection from './steps/Step3ReichweitenEVSelection';
import Step4ReichweitenParams from './steps/Step4ReichweitenParams';
import Step7ChargingStrategy from './steps/Step7ChargingStrategy';
import Step4ArbitrageStrategy from './steps/Step4ArbitrageStrategy';
import ModuleSelector from './ModuleSelector';

// Steps for each module
const STEPS_OPTIMIERUNG = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilität & Fahrzeuge' },
  { number: 3, label: 'Depot' },
  { number: 4, label: 'Ladeinfrastruktur' },
  { number: 5, label: 'EV-Auswahl' },
  { number: 6, label: 'Szenarien' },
  { number: 7, label: 'Ladestrategie' },
];

const STEPS_LADEPROZESS = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilität & Fahrzeuge' },
  { number: 3, label: 'Depot' },
  { number: 4, label: 'Ladeinfrastruktur' },
  { number: 5, label: 'EV-Auswahl' },
  { number: 6, label: 'Szenarien' },
];

const STEPS_REICHWEITEN = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilität & Touren' },
  { number: 3, label: 'EV-Auswahl & Analyse' },
];

const STEPS_BIDIREKTIONAL = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilität & Touren' },
  { number: 3, label: 'Depot & Netzanschluss' },
  { number: 4, label: 'Ladeinfrastruktur' },
  { number: 5, label: 'EV-Auswahl' },
  { number: 6, label: 'Arbitrage-Strategie' },
];

export default function ProjectWizard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { wizard, setWizardStep, setWizardModule, setWizardProjectId, resetWizard } = useProjectStore();

  const runReichweitenSimulation = useRunReichweitenSimulation();
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    if (!projectId) {
      resetWizard();
    } else if (wizard.projectId !== projectId) {
      setWizardProjectId(projectId);
    }
  }, [projectId]);

  const STEPS = wizard.wizardModule === 'reichweiten' ? STEPS_REICHWEITEN
    : wizard.wizardModule === 'ladeprozess_optimierung' ? STEPS_OPTIMIERUNG
    : wizard.wizardModule === 'ladeprozess_bidirektional' ? STEPS_BIDIREKTIONAL
    : STEPS_LADEPROZESS;
  const currentStep = wizard.currentStep;
  const currentLabel = STEPS.find(s => s.number === currentStep)?.label ?? '';

  const handleStepClick = (n: number) => {
    if (n <= currentStep) setWizardStep(n);
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
        <h1 className="text-2xl font-bold text-slate-900">
          {projectId ? 'Projekt bearbeiten' : 'Neues Projekt erstellen'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Schritt {currentStep} von {STEPS.length} – {currentLabel}
          {wizard.wizardModule === 'reichweiten' && (
            <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              Reichweiten Simulator
            </span>
          )}
          {wizard.wizardModule === 'ladeprozess' && (
            <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              Ladeprozess Simulator
            </span>
          )}
          {wizard.wizardModule === 'ladeprozess_optimierung' && (
            <span className="ml-2 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
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
              disabled={step.number > currentStep}
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-colors shrink-0',
                step.number < currentStep  ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700'
                : step.number === currentStep ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
              title={step.label}
            >
              {step.number < currentStep ? <Check className="h-4 w-4" /> : String(step.number)}
            </button>
            <div className="flex flex-col ml-2 mr-2 flex-1 min-w-0">
              <span className={cn(
                'text-xs font-medium truncate hidden sm:block',
                step.number === currentStep ? 'text-blue-600' : 'text-slate-400'
              )}>
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  'h-0.5 mt-1 rounded-full hidden sm:block',
                  step.number < currentStep ? 'bg-blue-600' : 'bg-slate-200'
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {currentStep === 1 && <Step1ProjectContext />}

        {currentStep === 2 && (
          <Step3Mobility
            onFinish={wizard.wizardModule === 'reichweiten' ? handleMobilityNextReichweitenModule : undefined}
            isFinishing={false}
          />
        )}

        {/* Reichweiten module steps */}
        {wizard.wizardModule === 'reichweiten' && currentStep === 3 && (
          <Step3ReichweitenEVSelection
            onFinish={handleFinishReichweitenModule}
            isFinishing={isFinishing}
          />
        )}

        {/* Ladeprozess module steps */}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 3 && <Step3Depot />}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 4 && <Step4Ladeinfrastruktur />}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 5 && <Step5EVSelection />}
        {wizard.wizardModule === 'ladeprozess' && currentStep === 6 && <Step6Scenarios />}

        {/* Ladeprozess Optimierung module steps (7-step flow) */}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 3 && <Step3Depot />}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 4 && <Step4Ladeinfrastruktur />}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 5 && <Step5EVSelection />}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 6 && <Step6Scenarios />}
        {wizard.wizardModule === 'ladeprozess_optimierung' && currentStep === 7 && <Step7ChargingStrategy />}

        {/* Ladeprozess Bidirektional module steps (4-step flow) */}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 3 && <Step3Depot />}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 4 && <Step4Ladeinfrastruktur />}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 5 && <Step5EVSelection />}
        {wizard.wizardModule === 'ladeprozess_bidirektional' && currentStep === 6 && <Step4ArbitrageStrategy />}
      </div>
    </div>
  );
}
