import { useForm, Controller } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Zap, Settings, Euro, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useRoutes, useSaveWizardConfig } from '@/lib/api';
import { InstallationType } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
// ── Tooltip helper ─────────────────────────────────────────────────────────────
function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center cursor-help">
      <Info className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0079C0] transition-colors" />
      <span className="absolute left-5 top-0 z-30 hidden group-hover:block w-64 bg-[#001141] text-white text-xs rounded p-3 shadow-lg leading-relaxed pointer-events-none">
        {text}
      </span>
    </span>
  );
}

const INSTALLATION_OPTIONS = [
  { value: InstallationType.SIMPLE,    label: 'Einfach',    description: 'Nur Wallbox-Montage, keine Bauarbeiten',                     badge: '~€1.000/LP' },
  { value: InstallationType.STANDARD,  label: 'Standard',   description: 'Elektroinstallation, Kabelführung, Unterverteilung',         badge: '~€3.500/LP' },
  { value: InstallationType.AUFWENDIG, label: 'Aufwendig',  description: 'Bauliche Maßnahmen, Tiefbau, ggf. Transformator-Upgrade',    badge: '~€8.000/LP' },
];

const FIELDS = [
  { key: 'charging_power_kw',    label: 'Maximale Ladeleistung (Depot)', unit: 'kW',         min: 0,    max: 150,  step: 0.1,  tooltip: 'Übliche AC-Werte: 3,7 kW (1-phasig), 11 kW oder 22 kW. DC: 50–150 kW' },
  { key: 'soc_target',           label: 'Ziel-SOC (Abfahrt)',            unit: '%',           min: 50,   max: 100,  step: 5,    tooltip: 'SOC bei Depotladung und Tourstart. Empfohlen: 80–90 % für Akkulanglebigkeit' },
  { key: 'charging_efficiency',  label: 'Ladeeffizienz',                 unit: '(0–1)',       min: 0.8,  max: 1.0,  step: 0.01, tooltip: 'Wirkungsgrad Netz→Batterie. Typisch 0,88–0,95 für AC-Laden' },
  { key: 'electricity_price',    label: 'Strompreis',                    unit: '€/kWh',      min: 0.05, max: 0.60, step: 0.01, tooltip: 'Gewerblicher Strompreis inkl. Steuern und Abgaben. Ø Deutschland 2024: ~0,25 €/kWh' },
  { key: 'grid_emission_factor', label: 'Netz-Emissionsfaktor',          unit: 'kg CO₂e/kWh',min: 0.0,  max: 1.0,  step: 0.01, tooltip: 'Spezifische CO₂-Emissionen des Strommixes. Deutschland 2023: 0,380 kg/kWh (UBA)' },
];

export default function Step4Ladeinfrastruktur() {
  const { wizard, updateWizardStep4, updateWizardStep3Depot, setWizardStep } = useProjectStore();
  const saveWizardConfig = useSaveWizardConfig();

  // ── LP count ───────────────────────────────────────────────────────────────
  const { data: routesData, isLoading: routesLoading } = useRoutes(wizard.projectId ?? undefined);
  const totalEVs = (() => {
    const mode = wizard.step3MobilityMode;
    const stored = wizard.step3TotalVehicles;
    // Always derive from routes when reusing a Reichweiten project — wizard state may be stale
    if (!wizard.reuseReichweitenProjectId) {
      if (mode === 'upload') {
        const routes = routesData?.data ?? [];
        if (routes.length) {
          return new Set(routes.map((r: { vehicle_id?: string | null }) => r.vehicle_id).filter(Boolean)).size || routes.length;
        }
        return routesLoading ? 0 : (stored || 1);
      }
      if (stored > 0) return stored;
    }
    // Reuse path OR stored=0: sum vehicle_count from DB routes
    if (routesLoading) return 0;  // wait for data — don't fallback to 1 prematurely
    const routes = routesData?.data ?? [];
    const fromRoutes = routes.reduce((sum: number, r: { vehicle_count?: number | null }) => sum + (r.vehicle_count ?? 1), 0);
    // Fallback chain: DB routes → wizard.step3TotalVehicles (set from copy result) → 1
    return fromRoutes || stored || 1;
  })();

  const [lpMode, setLpMode] = useState<'per_ev' | 'fixed'>('per_ev');

  const { handleSubmit, control, watch, setValue } = useForm({
    defaultValues: wizard.step4,
  });

  // Sync LP count when totalEVs resolves — only after data is loaded (totalEVs > 0)
  useEffect(() => {
    if (lpMode === 'per_ev' && totalEVs > 0) {
      updateWizardStep3Depot({ num_charging_points: totalEVs });
    }
  }, [totalEVs, lpMode]); // eslint-disable-line

  // numLP: always use totalEVs when in per_ev mode and data has loaded
  const numLP = (lpMode === 'per_ev' && totalEVs > 0)
    ? totalEVs
    : (wizard.step3Depot?.num_charging_points ?? totalEVs);

  const onSubmit = (data: typeof wizard.step4) => {
    updateWizardStep4(data);
    if (wizard.projectId && !wizard.projectId.startsWith('local_')) {
      saveWizardConfig.mutate({
        projectId: wizard.projectId,
        config: { ...((wizard as any).wizard_config ?? {}), step4: data },
      });
    }
    setWizardStep(wizard.wizardModule === 'ladeprozess' ? 6 : 5);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Ladeinfrastruktur</h2>
        <p className="text-sm text-slate-500 mt-1">Ladeoptionen, Anzahl Ladepunkte, SOC-Vorgaben und Energiekosten.</p>
      </div>

      <div className="p-6 space-y-8">

        {/* ── Ladeoptionen ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#0079C0]" />
            <span className="text-sm font-medium text-[#001141]">Ladeoptionen</span>
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Depot-Laden — always active */}
            <div className="p-3 rounded border border-[#0079C0] bg-[#e6f3fc] flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-[#0079C0] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#001141]">Depot-Laden (AC/DC)</p>
                <p className="text-xs text-slate-500 mt-0.5">Laden über Nacht oder zwischen Touren im Depot.</p>
              </div>
            </div>
            {/* Öffentliches Laden — disabled / coming soon */}
            <div className="p-3 rounded border border-slate-200 bg-slate-50 flex items-start gap-3 opacity-60 cursor-not-allowed">
              <div className="h-4 w-4 mt-0.5 shrink-0 rounded-full border-2 border-slate-300" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-500">Öffentliches Laden (AC/DC)</p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 uppercase tracking-wide">V1.1</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Zwischenladen an öffentlichen Ladesäulen.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Anzahl Ladepunkte ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#0079C0]" />
            <span className="text-sm font-medium text-[#001141]">Anzahl Ladepunkte</span>
            <InfoTip text="Geplante Anzahl Ladepunkte im Depot. Weniger Ladepunkte als EVs erzeugen Warteschlangen — Optimierung folgt in V1.1." />
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>
          <div className="flex gap-2">
            {[
              { id: 'per_ev', label: '1 LP pro EV', badge: `${totalEVs} LP` },
              { id: 'fixed',  label: 'Feste Anzahl', badge: 'V1.1' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setLpMode(opt.id as 'per_ev' | 'fixed');
                  if (opt.id === 'per_ev') updateWizardStep3Depot({ num_charging_points: totalEVs });
                }}
                className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                  lpMode === opt.id
                    ? 'bg-[#0079C0] text-white border-[#0079C0]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {opt.label}
                <span className="text-[10px] opacity-70">{opt.badge}</span>
              </button>
            ))}
          </div>
          {lpMode === 'per_ev' ? (
            <div className="flex items-center gap-2 p-2.5 bg-[#e6f3fc] rounded border border-[#0079C0]/20 text-xs text-[#001141]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#0079C0] shrink-0" />
              <span>
                <strong>{totalEVs} Ladepunkte</strong> —{' '}
                {wizard.reuseReichweitenProjectId
                  ? `${totalEVs} Fahrzeuge aus dem Reichweiten-Projekt übernommen.`
                  : wizard.step3MobilityMode === 'upload'
                  ? `${totalEVs} eindeutige Fahrzeug-IDs im Upload erkannt.`
                  : wizard.step3MobilityMode === 'fleet_level'
                  ? `${totalEVs} Fahrzeuge aus dem Flottenprofil.`
                  : `${totalEVs} Fahrzeuge aus der manuellen Eingabe.`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Warteschlangenoptimierung bei weniger LP als EVs folgt in V1.1.</span>
            </div>
          )}
        </div>

        {/* ── Ladeparameter ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#0079C0]" />
            <span className="text-sm font-medium text-[#001141]">Ladeparameter & SOC</span>
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map(field => (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">{field.label}</Label>
                  <InfoTip text={field.tooltip} />
                </div>
                <Controller
                  name={field.key as keyof typeof wizard.step4}
                  control={control}
                  render={({ field: f }) => (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Slider
                          min={field.min} max={field.max} step={field.step}
                          value={[Number(f.value)]}
                          onValueChange={([v]) => f.onChange(v)}
                          className="[&_[role=slider]]:bg-[#0079C0] [&_[role=slider]]:border-[#0079C0]"
                        />
                      </div>
                      <Input
                        type="number" step={field.step} min={field.min} max={field.max}
                        className="h-8 text-sm text-right w-20 shrink-0"
                        value={Number(f.value)}
                        onChange={e => f.onChange(parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-xs text-slate-400 w-16 shrink-0">{field.unit}</span>
                    </div>
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Investitionskosten ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-[#0079C0]" />
            <span className="text-sm font-medium text-[#001141]">Investitionskosten</span>
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>

          {/* Wallbox-Preis */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm">Wallbox-Preis (je Ladepunkt)</Label>
              <InfoTip text="Hardwarekosten je Ladepunkt inkl. Kabel und Zubehör. AC 22 kW: ~€800–2.500, DC 50 kW: ~€15.000–30.000" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Slider
                  min={500} max={30000} step={100}
                  value={[wizard.step3Depot?.wallbox_price_eur ?? 1200]}
                  onValueChange={([v]) => updateWizardStep3Depot({ wallbox_price_eur: v })}
                  className="[&_[role=slider]]:bg-[#0079C0] [&_[role=slider]]:border-[#0079C0]"
                />
              </div>
              <Input
                type="number" step={100} min={500} max={30000}
                className="h-8 text-sm text-right w-24 shrink-0"
                value={wizard.step3Depot?.wallbox_price_eur ?? 1200}
                onChange={e => updateWizardStep3Depot({ wallbox_price_eur: parseInt(e.target.value) || 1200 })}
              />
              <span className="text-xs text-slate-400 w-16 shrink-0">€/LP</span>
            </div>
          </div>

          {/* Installationstyp */}
          <div className="space-y-1.5">
            <Label className="text-sm">Bauliche Maßnahmen (Installation)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {INSTALLATION_OPTIONS.map(opt => {
                const isSelected = (wizard.step3Depot?.installation_type ?? InstallationType.STANDARD) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateWizardStep3Depot({ installation_type: opt.value })}
                    className={`text-left p-3 rounded border transition-all ${isSelected ? 'border-[#0079C0] bg-[#e6f3fc]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#001141]">{opt.label}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isSelected ? 'bg-[#cce6f8] text-[#0079C0]' : 'bg-slate-100 text-slate-500'}`}>{opt.badge}</span>
                    </div>
                    <p className="text-xs text-slate-500">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Summary ── */}
        <div className="p-3 bg-[#e6f3fc] rounded border border-[#0079C0]/20">
          <p className="text-xs font-medium text-[#001141] mb-2">Vorschau Ladeinfrastruktur</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ['Ladepunkte',   `${numLP} LP`],
              ['Ladeleistung', `${watch('charging_power_kw')} kW`],
              ['Ziel-SOC',     `${watch('soc_target')} %`],
              ['Strompreis',   `${Number(watch('electricity_price')).toFixed(2)} €/kWh`],
              ['CO₂-Faktor',   `${Number(watch('grid_emission_factor')).toFixed(3)} kg/kWh`],
              ['Wallbox',      `${(wizard.step3Depot?.wallbox_price_eur ?? 1200).toLocaleString('de-DE')} €/LP`],
            ].map(([label, value]) => (
              <div key={label}><span className="text-slate-500">{label}:</span> <span className="font-medium">{value}</span></div>
            ))}
          </div>
        </div>

      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" type="button"
          onClick={() => setWizardStep(wizard.wizardModule === 'ladeprozess' ? 4 : 3)}>
          ← Zurück
        </Button>
        <Button type="submit">
          {wizard.wizardModule === 'ladeprozess' ? 'Weiter zu Szenarien →' : 'Weiter zu EV-Auswahl →'}
        </Button>
      </div>
    </form>
  );
}
