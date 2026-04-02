import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import Step1ProjectContext from './steps/Step1ProjectContext';
import Step3Mobility from './steps/Step3Mobility';
import Step3Depot from './steps/Step3Depot';
import Step4Ladeinfrastruktur from './steps/Step4Ladeinfrastruktur';
import Step5EVSelection from './steps/Step5EVSelection';
import Step6Scenarios from './steps/Step6Scenarios';

// Steps 1–6: sequential, clean numbering
const STEPS = [
  { number: 1, label: 'Projektkontext' },
  { number: 2, label: 'Mobilität & Fahrzeuge' },
  { number: 3, label: 'Depot' },
  { number: 4, label: 'Ladeinfrastruktur' },
  { number: 5, label: 'EV-Auswahl' },
  { number: 6, label: 'Szenarien' },
];

export default function ProjectWizard() {
  const { projectId } = useParams();
  const { wizard, setWizardStep, setWizardProjectId, resetWizard } = useProjectStore();

  useEffect(() => {
    if (!projectId) {
      resetWizard();
    } else if (wizard.projectId !== projectId) {
      setWizardProjectId(projectId);
    }
  }, [projectId]);

  const currentStep = wizard.currentStep;
  const currentLabel = STEPS.find(s => s.number === currentStep)?.label ?? '';
  const displayCurrent = currentStep; // steps are now 1-6 sequentially

  const handleStepClick = (internalNumber: number) => {
    if (internalNumber <= currentStep) {
      setWizardStep(internalNumber);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {projectId ? 'Projekt bearbeiten' : 'Neues Projekt erstellen'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Schritt {displayCurrent} von {STEPS.length} – {currentLabel}
        </p>
      </div>

      <div className="flex items-center">
        {STEPS.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <button
              onClick={() => handleStepClick(step.number)}
              disabled={step.number > currentStep}
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-colors shrink-0',
                step.number < currentStep
                  ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700'
                  : step.number === currentStep
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
              title={step.label}
            >
              {step.number < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                String(step.number)
              )}
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {currentStep === 1 && <Step1ProjectContext />}
        {currentStep === 2 && <Step3Mobility />}
        {currentStep === 3 && <Step3Depot />}
        {currentStep === 4 && <Step4Ladeinfrastruktur />}
        {currentStep === 5 && <Step5EVSelection />}
        {currentStep === 6 && <Step6Scenarios />}
      </div>
    </div>
  );
}
