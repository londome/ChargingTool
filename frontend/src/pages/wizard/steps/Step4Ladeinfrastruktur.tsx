import { useForm, Controller } from 'react-hook-form';
import { Info } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { ChargingOption, InstallationType } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const INSTALLATION_OPTIONS = [
  { value: InstallationType.SIMPLE,    label: 'Einfach',    description: 'Nur Wallbox-Montage, keine Bauarbeiten',                          badge: '~€1.000/LP' },
  { value: InstallationType.STANDARD,  label: 'Standard',   description: 'Elektroinstallation, Kabelführung, Unterverteilung',              badge: '~€3.500/LP' },
  { value: InstallationType.AUFWENDIG, label: 'Aufwendig',  description: 'Bauliche Maßnahmen, Tiefbau, ggf. Transformator-Upgrade',         badge: '~€8.000/LP' },
];

const CHARGING_OPTIONS = [
  { value: ChargingOption.DEPOT_AC, label: 'Depot-Laden (AC, Wandlader)' },
  { value: ChargingOption.DEPOT_DC, label: 'Depot-Laden (DC, Schnellladung)' },
  { value: ChargingOption.PUBLIC_AC, label: 'Öffentliches Laden (AC)' },
  { value: ChargingOption.PUBLIC_DC, label: 'Öffentliches Laden (DC)' },
  { value: ChargingOption.ENROUTE_DC, label: 'Unterwegs laden (DC)' },
];

interface AssumptionField {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
}

const FIELDS: AssumptionField[] = [
  { key: 'charging_power_kw', label: 'Maximale Ladeleistung (Depot)', unit: 'kW', min: 0, max: 150, step: 0.1, tooltip: 'Übliche AC-Werte: 3,7 kW (1-phasig), 11 kW oder 22 kW. DC: 50–150 kW' },
  { key: 'soc_target', label: 'Ziel-SOC (Abfahrt)', unit: '%', min: 50, max: 100, step: 5, tooltip: 'SOC bei Depotladung und Tourstart. Empfohlen: 80–90% für Akkulanglebigkeit' },
  { key: 'soc_min', label: 'Min-SOC (Machbarkeitsschwelle)', unit: '%', min: 5, max: 30, step: 5, tooltip: 'Mindestschwelle für die Elektrifizierbarkeitsberechnung: Eine Tour gilt nur dann als elektrifizierbar, wenn der SOC nach der Tour ≥ diesem Wert bleibt. Beeinflusst NICHT den Ladeprozess.' },
  { key: 'charging_efficiency', label: 'Ladeeffizienz', unit: '(0–1)', min: 0.8, max: 1.0, step: 0.01, tooltip: 'Wirkungsgrad Netz→Batterie. Typisch 0,88–0,95 für AC-Laden' },
  { key: 'electricity_price', label: 'Strompreis', unit: '€/kWh', min: 0.05, max: 0.60, step: 0.01, tooltip: 'Gewerblicher Strompreis inkl. Steuern und Abgaben. Ø Deutschland 2024: ~0,25 €/kWh' },
  { key: 'grid_emission_factor', label: 'Netz-Emissionsfaktor', unit: 'kg CO₂e/kWh', min: 0.0, max: 1.0, step: 0.01, tooltip: 'Spezifische CO₂-Emissionen des Strommixes. Deutschland 2023: 0,380 kg/kWh (UBA)' },
  { key: 'winter_surcharge', label: 'Winterzuschlag Verbrauch', unit: '(0–0,5)', min: 0.0, max: 0.5, step: 0.05, tooltip: 'Zusätzlicher Energiebedarf im Winter durch Heizung. 0,15 = +15% Verbrauch' },
];

export default function Step4Ladeinfrastruktur() {
  const { wizard, updateWizardStep4, updateWizardStep1, updateWizardStep3Depot, setWizardStep } = useProjectStore();

  const { handleSubmit, control, watch } = useForm({
    defaultValues: wizard.step4,
  });

  const selectedOptions = wizard.step1.charging_options ?? [ChargingOption.DEPOT_AC];

  const toggleChargingOption = (option: ChargingOption) => {
    const updated = selectedOptions.includes(option)
      ? selectedOptions.filter(o => o !== option)
      : [...selectedOptions, option];
    updateWizardStep1({ charging_options: updated });
  };

  const onSubmit = (data: typeof wizard.step4) => {
    updateWizardStep4(data);
    setWizardStep(5);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Ladeinfrastruktur</h2>
        <p className="text-sm text-slate-500 mt-1">
          Ladeoptionen, SOC-Vorgaben, Ladeleistung und Energiekosten.
        </p>
      </div>

      <div className="p-6 space-y-6">

        {/* Verfügbare Ladeoptionen */}
        <div className="space-y-2">
          <Label className="text-sm font-normal">Verfügbare Ladeoptionen</Label>
          <p className="text-xs text-slate-500">Wählen Sie alle Ladeoptionen, die für Ihre Flotte in Frage kommen.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CHARGING_OPTIONS.map(opt => {
              const isSelected = selectedOptions.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleChargingOption(opt.value)}
                  className={`text-left px-3 py-2.5 rounded-md border text-sm transition-colors ${
                    isSelected
                      ? 'border-[#0079C0] bg-[#e6f3fc] text-[#001141] font-medium'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ladeparameter */}
        <div className="space-y-4">
          <h3 className="text-sm font-normal text-[#001141]">Ladeparameter & Kosten</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map(field => (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <Label className="text-sm">{field.label}</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{field.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Controller
                  name={field.key as keyof typeof wizard.step4}
                  control={control}
                  render={({ field: f }) => (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Slider min={field.min} max={field.max} step={field.step}
                          value={[Number(f.value)]} onValueChange={([v]) => f.onChange(v)} />
                      </div>
                      <div className="w-24 shrink-0">
                        <Input type="number" step={field.step} min={field.min} max={field.max}
                          className="h-8 text-sm text-right" value={Number(f.value)}
                          onChange={e => f.onChange(parseFloat(e.target.value) || 0)} />
                      </div>
                      <span className="text-xs text-slate-500 w-20 shrink-0">{field.unit}</span>
                    </div>
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Öffentliches Laden */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div>
            <Label className="font-medium">Öffentliches Zwischenladen erlauben</Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Touren können auch mit öffentlichen Ladesäulen unterwegs aufgeladen werden
            </p>
          </div>
          <Controller
            name="allow_public_charging"
            control={control}
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        {/* Investitionskosten */}
        <div className="space-y-4">
          <h3 className="text-sm font-normal text-[#001141]">Investitionskosten Ladeinfrastruktur</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-sm">Wallbox-Preis (je Ladepunkt)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Hardwarekosten je Ladepunkt inkl. Kabel und Zubehör. AC 22 kW: ~€800–2.500, DC 50 kW: ~€15.000–30.000</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Slider min={500} max={30000} step={100}
                  value={[wizard.step3Depot?.wallbox_price_eur ?? 1200]}
                  onValueChange={([v]) => updateWizardStep3Depot({ wallbox_price_eur: v })} />
              </div>
              <div className="w-24 shrink-0">
                <Input type="number" step={100} min={500} max={30000}
                  className="h-8 text-sm text-right"
                  value={wizard.step3Depot?.wallbox_price_eur ?? 1200}
                  onChange={e => updateWizardStep3Depot({ wallbox_price_eur: parseInt(e.target.value) || 1200 })} />
              </div>
              <span className="text-xs text-slate-500 w-20 shrink-0">€/LP</span>
            </div>
          </div>

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
                    className={`text-left p-3 rounded border transition-all ${isSelected ? 'border-[#0079C0] bg-[#e6f3fc]' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-normal text-sm text-[#001141]">{opt.label}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isSelected ? 'bg-[#cce6f8] text-[#0079C0]' : 'bg-slate-100 text-slate-500'}`}>{opt.badge}</span>
                    </div>
                    <p className="text-xs text-slate-500">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 bg-[#e6f3fc] rounded border border-[#0079C0]/20">
          <h4 className="text-xs font-normal text-[#001141] mb-2">Vorschau Ladeinfrastruktur</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div><span className="text-slate-500">Ladeleistung:</span> <span className="font-medium">{watch('charging_power_kw')} kW</span></div>
            <div><span className="text-slate-500">Ziel-SOC / Min-SOC:</span> <span className="font-medium">{watch('soc_target')}% / {watch('soc_min')}%</span></div>
            <div><span className="text-slate-500">Strompreis:</span> <span className="font-medium">{Number(watch('electricity_price')).toFixed(2)} €/kWh</span></div>
            <div><span className="text-slate-500">CO₂-Faktor:</span> <span className="font-medium">{Number(watch('grid_emission_factor')).toFixed(3)} kg/kWh</span></div>
            <div><span className="text-slate-500">Wallbox:</span> <span className="font-medium">{(wizard.step3Depot?.wallbox_price_eur ?? 1200).toLocaleString('de-DE')} €/LP</span></div>
            <div><span className="text-slate-500">Ladeoptionen:</span> <span className="font-medium">{selectedOptions.length} gewählt</span></div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" type="button" onClick={() => setWizardStep(3)}>← Zurück</Button>
        <Button type="submit">Weiter zu EV-Auswahl →</Button>
      </div>
    </form>
  );
}
