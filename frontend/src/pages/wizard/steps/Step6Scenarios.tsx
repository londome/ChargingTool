import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, Check } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useCreateScenario, useRunSimulation } from '@/lib/api';
import { DEMO_RUN_ID } from '@/lib/simulationMock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScenarioType, InstallationType } from '@shared/types';
import { getScenarioTypeLabel } from '@/lib/utils';

function buildPresets(wallbox_price_eur: number, installation_type: InstallationType, charging_power_kw: number) {
  return [
    {
      name: 'Basis-Szenario',
      type: ScenarioType.BASELINE,
      description: 'Standardannahmen für erste Bewertung',
      electricity_price: 0.28,
      diesel_price: 1.75,
      grid_emission_factor: 0.380,
      charging_power_kw,
      charging_efficiency: 0.92, allow_public_charging: false,
      winter_surcharge: 0.15, temperature_factor: 1.0, electrification_pct: 100,
      wallbox_price_eur, installation_type,
    },
    {
      name: 'Optimistisch',
      type: ScenarioType.OPTIMISTIC,
      description: 'Günstige Bedingungen: niedriger Strom, sauberer Mix',
      electricity_price: 0.22,
      diesel_price: 1.65,
      grid_emission_factor: 0.300,
      charging_power_kw,
      charging_efficiency: 0.94, allow_public_charging: true,
      winter_surcharge: 0.10, temperature_factor: 0.95, electrification_pct: 100,
      wallbox_price_eur, installation_type,
    },
    {
      name: 'Konservativ',
      type: ScenarioType.CONSERVATIVE,
      description: 'Worst-Case: hoher Strom, Winterbedingungen',
      electricity_price: 0.35,
      diesel_price: 1.95,
      grid_emission_factor: 0.420,
      charging_power_kw,
      charging_efficiency: 0.88, allow_public_charging: false,
      winter_surcharge: 0.20, temperature_factor: 1.1, electrification_pct: 80,
      wallbox_price_eur, installation_type,
    },
  ];
}

export default function Step6Scenarios() {
  const navigate = useNavigate();
  const { wizard, setWizardStep, setActiveScenarioId, setActiveRunId, updateWizardStep6 } = useProjectStore();
  const createScenario = useCreateScenario();
  const runSimulation = useRunSimulation();
  const [selectedPresets, setSelectedPresets] = useState<number[]>([0, 1]);
  const [customName, setCustomName] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const depot = wizard.step3Depot ?? { wallbox_price_eur: 1200, installation_type: InstallationType.STANDARD };
  const chargingPowerKw = wizard.step4?.charging_power_kw ?? 22;
  const PRESET_SCENARIOS = buildPresets(depot.wallbox_price_eur, depot.installation_type as InstallationType, chargingPowerKw);

  const togglePreset = (index: number) => {
    setSelectedPresets(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleFinish = async () => {
    setIsRunning(true);

    // In offline mode, use demo run and navigate directly to results
    if (!wizard.projectId || wizard.projectId.startsWith('local_')) {
      setActiveRunId(DEMO_RUN_ID);
      setTimeout(() => {
        setIsRunning(false);
        navigate('/ergebnisse');
      }, 1200);
      return;
    }

    try {
      // Delete existing scenarios for this project to avoid duplicates
      await fetch(`/api/scenarios/project/${wizard.projectId}`, { method: 'DELETE' });

      const presetsToCreate = selectedPresets.map(i => PRESET_SCENARIOS[i]);

      // Create all scenarios in parallel
      const socFromMobility = {
        soc_start: wizard.step4?.soc_start ?? 90,
        soc_min: wizard.step4?.soc_min ?? 20,
        soc_target: wizard.step4?.soc_target ?? 80,
      };

      const scenarios = await Promise.all(
        presetsToCreate.map(preset => createScenario.mutateAsync({
          project_id: wizard.projectId!,
          ...preset,
          ...socFromMobility,
          notes: preset.description,
        }))
      );

      // Run simulation for ALL selected scenarios in parallel
      const runs = await Promise.all(
        scenarios.map(scenario => runSimulation.mutateAsync({
          project_id: wizard.projectId!,
          scenario_id: scenario.id,
        }))
      );

      // Set last run as active (all will be visible in results tabs)
      const lastRun = runs[runs.length - 1];
      if (lastRun) {
        setActiveScenarioId(scenarios[scenarios.length - 1].id);
        setActiveRunId(lastRun.run_id);
      }
    } catch (e) {
      console.warn('Offline-Modus: Simulation mit Demo-Daten', e);
    } finally {
      setIsRunning(false);
      if (wizard.wizardModule === 'ladeprozess_optimierung') {
        setWizardStep(7);
      } else {
        navigate(`/projekte/${wizard.projectId}/ergebnisse`);
      }
    }
  };

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Szenarien definieren</h2>
        <p className="text-sm text-slate-500 mt-1">
          Wählen Sie Szenarien für die Simulation. Sie können mehrere Szenarien gleichzeitig berechnen.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <h3 className="text-sm font-normal text-[#001141]">Vordefinierte Szenarien</h3>
        <div className="space-y-3">
          {PRESET_SCENARIOS.map((preset, index) => {
            const isSelected = selectedPresets.includes(index);
            return (
              <div
                key={index}
                onClick={() => togglePreset(index)}
                className={`cursor-pointer rounded border p-4 transition-all ${
                  isSelected ? 'border-[#0079C0] bg-[#e6f3fc]' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-[#0079C0] border-[#0079C0]' : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-normal text-[#001141] text-sm">{preset.name}</p>
                        <Badge variant={
                          preset.type === ScenarioType.OPTIMISTIC ? 'success' :
                          preset.type === ScenarioType.CONSERVATIVE ? 'warning' : 'secondary'
                        }>
                          {getScenarioTypeLabel(preset.type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                      <div className="flex gap-3 mt-2 text-xs text-slate-600">
                        <span>⚡ {preset.electricity_price} €/kWh</span>
                        <span>🔋 {preset.charging_power_kw} kW</span>
                        <span>🌱 {preset.grid_emission_factor} kg/kWh</span>
                        <span>📊 {preset.electrification_pct}% Elektrifizierung</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-100">
          <p className="text-xs text-[#C45600]">
            <strong>Hinweis:</strong> Die Simulation wird direkt im Anschluss gestartet.
            Ergebnisse sind in der Regel innerhalb weniger Sekunden verfügbar.
            Sie können Szenarien jederzeit im Szenariomanager anpassen.
          </p>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" onClick={() => setWizardStep(5)}>← Zurück</Button>
        <Button
          onClick={handleFinish}
          disabled={selectedPresets.length === 0 || isRunning}
          className="flex items-center gap-2"
        >
          <Play className="h-4 w-4" />
          {isRunning ? 'Simulation läuft...' : 'Simulation starten'}
        </Button>
      </div>
    </div>
  );
}
