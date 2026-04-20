import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, Trash2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useCreateScenario, useRunSimulation } from '@/lib/api';
import { DEMO_RUN_ID } from '@/lib/simulationMock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScenarioType, InstallationType } from '@shared/types';

// ── Tooltip helper ─────────────────────────────────────────────────────────────
function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center cursor-help">
      <Info className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0079C0] transition-colors" />
      <span className="absolute left-5 top-0 z-30 hidden group-hover:block w-60 bg-[#001141] text-white text-xs rounded p-3 shadow-lg leading-relaxed pointer-events-none">
        {text}
      </span>
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface ScenarioDraft {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  electricity_price: number;
  diesel_price: number;
  grid_emission_factor: number;
  charging_power_kw: number;
  charging_efficiency: number;
  electrification_pct: number;
  expanded: boolean;
  selected: boolean;
}

const TYPE_META: Record<ScenarioType, { label: string; color: string; bg: string }> = {
  [ScenarioType.BASELINE]:    { label: 'Basis',        color: 'text-[#0079C0]',  bg: 'bg-[#e6f3fc]'  },
  [ScenarioType.OPTIMISTIC]:  { label: 'Optimistisch', color: 'text-[#043F2E]',  bg: 'bg-[#e8f5e9]'  },
  [ScenarioType.CONSERVATIVE]:{ label: 'Konservativ',  color: 'text-[#C45600]',  bg: 'bg-[#fff3e0]'  },
  [ScenarioType.CUSTOM]:      { label: 'Benutzerdefiniert', color: 'text-slate-600', bg: 'bg-slate-100' },
};

const FIELDS: { key: keyof ScenarioDraft; label: string; unit: string; step: number; tooltip: string }[] = [
  { key: 'electricity_price',    label: 'Strompreis',         unit: '€/kWh',      step: 0.01, tooltip: 'Gewerblicher Strompreis inkl. Netzentgelte und Abgaben. Ø DE 2024: ~0,25 €/kWh' },
  { key: 'diesel_price',         label: 'Dieselpreis',        unit: '€/L',        step: 0.01, tooltip: 'Brutto-Dieselpreis inkl. Steuern. Ø DE 2024: ~1,65 €/L' },
  { key: 'grid_emission_factor', label: 'CO₂-Faktor Strom',  unit: 'kg/kWh',     step: 0.01, tooltip: 'Spezifische CO₂-Emissionen des Strommixes. DE 2023: 0,380 kg/kWh (UBA)' },
  { key: 'charging_power_kw',    label: 'Ladeleistung',       unit: 'kW',         step: 1,    tooltip: 'Maximale Ladeleistung je Ladepunkt im Depot' },
  { key: 'charging_efficiency',  label: 'Ladeeffizienz',      unit: '(0–1)',       step: 0.01, tooltip: 'Wirkungsgrad Netz→Batterie. Typisch 0,88–0,95 für AC-Laden' },
  { key: 'electrification_pct',  label: 'Elektrifizierungsgrad', unit: '%',       step: 5,    tooltip: 'Anteil der Flotte, der auf EV umgestellt wird. 100 % = vollständige Umstellung' },
];

function buildDefaults(chargingPowerKw: number, wallboxPrice: number, installationType: InstallationType): ScenarioDraft[] {
  return [
    {
      id: 'basis', name: 'Basis-Szenario', type: ScenarioType.BASELINE,
      description: 'Standardannahmen für eine erste Bewertung',
      electricity_price: 0.28, diesel_price: 1.75, grid_emission_factor: 0.380,
      charging_power_kw: chargingPowerKw, charging_efficiency: 0.92, electrification_pct: 100,
      expanded: false, selected: true,
    },
    {
      id: 'optimistisch', name: 'Optimistisch', type: ScenarioType.OPTIMISTIC,
      description: 'Günstige Bedingungen: niedriger Strom, sauberer Mix',
      electricity_price: 0.22, diesel_price: 1.65, grid_emission_factor: 0.300,
      charging_power_kw: chargingPowerKw, charging_efficiency: 0.94, electrification_pct: 100,
      expanded: false, selected: true,
    },
    {
      id: 'konservativ', name: 'Konservativ', type: ScenarioType.CONSERVATIVE,
      description: 'Worst-Case: hoher Strom, ungünstige Bedingungen',
      electricity_price: 0.35, diesel_price: 1.95, grid_emission_factor: 0.420,
      charging_power_kw: chargingPowerKw, charging_efficiency: 0.88, electrification_pct: 80,
      expanded: false, selected: false,
    },
  ];
}

export default function Step6Scenarios() {
  const navigate = useNavigate();
  const { wizard, setWizardStep, setActiveScenarioId, setActiveRunId } = useProjectStore();
  const createScenario = useCreateScenario();
  const runSimulation = useRunSimulation();
  const [isRunning, setIsRunning] = useState(false);

  const depot = wizard.step3Depot ?? { wallbox_price_eur: 1200, installation_type: InstallationType.STANDARD };
  const chargingPowerKw = wizard.step4?.charging_power_kw ?? 22;

  const [scenarios, setScenarios] = useState<ScenarioDraft[]>(() =>
    buildDefaults(chargingPowerKw, depot.wallbox_price_eur, depot.installation_type as InstallationType)
  );

  const update = (id: string, patch: Partial<ScenarioDraft>) =>
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const toggleExpand = (id: string) =>
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));

  const toggleSelect = (id: string) =>
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));

  const addCustom = () => {
    const base = scenarios.find(s => s.type === ScenarioType.BASELINE) ?? scenarios[0];
    const newId = `custom_${Date.now()}`;
    setScenarios(prev => [...prev, {
      ...base,
      id: newId,
      name: 'Mein Szenario',
      type: ScenarioType.CUSTOM,
      description: 'Benutzerdefiniertes Szenario',
      expanded: true,
      selected: true,
    }]);
  };

  const remove = (id: string) =>
    setScenarios(prev => prev.filter(s => s.id !== id));

  const selectedScenarios = scenarios.filter(s => s.selected);

  const handleRun = async () => {
    setIsRunning(true);

    if (!wizard.projectId || wizard.projectId.startsWith('local_')) {
      setActiveRunId(DEMO_RUN_ID);
      setTimeout(() => { setIsRunning(false); navigate('/ergebnisse'); }, 1200);
      return;
    }

    try {
      await fetch(`/api/scenarios/project/${wizard.projectId}`, { method: 'DELETE' });

      const soc = {
        soc_start: wizard.step4?.soc_start ?? 90,
        soc_min:   wizard.step4?.soc_min   ?? 20,
        soc_target: wizard.step4?.soc_target ?? 80,
      };

      const created = await Promise.all(
        selectedScenarios.map(s => createScenario.mutateAsync({
          project_id: wizard.projectId!,
          name: s.name,
          type: s.type,
          notes: s.description,
          electricity_price: s.electricity_price,
          diesel_price: s.diesel_price,
          grid_emission_factor: s.grid_emission_factor,
          charging_power_kw: s.charging_power_kw,
          charging_efficiency: s.charging_efficiency,
          electrification_pct: s.electrification_pct,
          allow_public_charging: false,
          wallbox_price_eur: depot.wallbox_price_eur,
          installation_type: depot.installation_type as InstallationType,
          winter_surcharge: 0,
          temperature_factor: 1.0,
          ...soc,
        }))
      );

      const runs = await Promise.all(
        created.map(scenario => runSimulation.mutateAsync({
          project_id: wizard.projectId!,
          scenario_id: scenario.id,
        }))
      );

      const lastRun = runs[runs.length - 1];
      if (lastRun) {
        setActiveScenarioId(created[created.length - 1].id);
        setActiveRunId(lastRun.run_id);
      }
    } catch (e) {
      console.warn('Offline-Modus:', e);
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
        <h2 className="text-lg font-normal text-[#001141]">Szenarien</h2>
        <p className="text-sm text-slate-500 mt-1">
          Wählen und konfigurieren Sie die Szenarien für die Simulation. Standardwerte können angepasst werden.
        </p>
      </div>

      <div className="p-6 space-y-3">

        {scenarios.map(s => {
          const meta = TYPE_META[s.type];
          return (
            <div
              key={s.id}
              className={`rounded border transition-all ${s.selected ? 'border-[#0079C0]' : 'border-slate-200'}`}
            >
              {/* ── Header row ── */}
              <div className="flex items-center gap-3 p-3">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelect(s.id)}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    s.selected ? 'bg-[#0079C0] border-[#0079C0]' : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {s.selected && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </button>

                {/* Name (editable) */}
                <input
                  className="text-sm font-medium text-[#001141] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#0079C0] focus:outline-none flex-1 min-w-0"
                  value={s.name}
                  onChange={e => update(s.id, { name: e.target.value })}
                />

                {/* Type badge */}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} shrink-0`}>
                  {meta.label}
                </span>

                {/* Key values summary */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 shrink-0">
                  <span>{s.electricity_price.toFixed(2)} €/kWh</span>
                  <span>{s.diesel_price.toFixed(2)} €/L</span>
                  <span>{s.electrification_pct} %</span>
                </div>

                {/* Expand / delete */}
                <button type="button" onClick={() => toggleExpand(s.id)}
                  className="text-slate-400 hover:text-[#0079C0] transition-colors shrink-0">
                  {s.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {s.type === ScenarioType.CUSTOM && (
                  <button type="button" onClick={() => remove(s.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* ── Expanded edit panel ── */}
              {s.expanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-3">
                  {/* Description */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Beschreibung</Label>
                    <input
                      className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#0079C0]"
                      value={s.description}
                      onChange={e => update(s.id, { description: e.target.value })}
                    />
                  </div>
                  {/* Parameter grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {FIELDS.map(f => (
                      <div key={f.key} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-slate-600">{f.label}</Label>
                          <InfoTip text={f.tooltip} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step={f.step}
                            className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 text-right focus:outline-none focus:border-[#0079C0]"
                            value={s[f.key] as number}
                            onChange={e => update(s.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                          />
                          <span className="text-[10px] text-slate-400 shrink-0 w-10">{f.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add custom scenario */}
        <button
          type="button"
          onClick={addCustom}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded border border-dashed border-slate-300 text-xs text-slate-500 hover:border-[#0079C0] hover:text-[#0079C0] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Szenario hinzufügen
        </button>

        {selectedScenarios.length === 0 && (
          <p className="text-xs text-red-500 text-center">Mindestens ein Szenario muss ausgewählt sein.</p>
        )}
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" type="button"
          onClick={() => setWizardStep(wizard.wizardModule === 'ladeprozess' ? 5 : 4)}>
          ← Zurück
        </Button>
        <Button
          onClick={handleRun}
          disabled={selectedScenarios.length === 0 || isRunning}
          className="flex items-center gap-2 bg-[#0079C0] hover:bg-[#005f99]"
        >
          <Play className="h-4 w-4" />
          {isRunning
            ? `Simulation läuft… (${selectedScenarios.length} Szenario${selectedScenarios.length > 1 ? 's' : ''})`
            : `Simulation starten (${selectedScenarios.length} Szenario${selectedScenarios.length > 1 ? 's' : ''})`}
        </Button>
      </div>
    </div>
  );
}
