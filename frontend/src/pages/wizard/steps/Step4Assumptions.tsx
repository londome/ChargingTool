import { useForm, Controller } from 'react-hook-form';
import { Info } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  { key: 'soc_target', label: 'SOC Ladezielvorgabe (Abfahrt)', unit: '%', min: 50, max: 100, step: 5, tooltip: 'SOC bei Depotladung und Tourstart. Empfohlen: 80–90% für Akkulanglebigkeit' },
  { key: 'soc_min', label: 'SOC Mindestladung (Reserve)', unit: '%', min: 5, max: 30, step: 5, tooltip: 'Mindest-SOC bei Rückkehr ins Depot als Sicherheitsreserve. Empfohlen: 15–20%' },
  { key: 'charging_power_kw', label: 'Ladeleistung Depot', unit: 'kW', min: 3.7, max: 150, step: 1, tooltip: 'AC: 7,4kW (einphasig), 11kW oder 22kW. DC: 50-150kW' },
  { key: 'charging_efficiency', label: 'Ladeeffizienz', unit: '(0-1)', min: 0.8, max: 1.0, step: 0.01, tooltip: 'Wirkungsgrad Netz→Batterie. Typisch 0,88-0,95 für AC-Laden' },
  { key: 'electricity_price', label: 'Strompreis', unit: '€/kWh', min: 0.05, max: 0.60, step: 0.01, tooltip: 'Gewerblicher Strompreis inkl. Steuern und Abgaben. Ø Deutschland 2024: ~0,25 €/kWh' },
  { key: 'grid_emission_factor', label: 'Netz-Emissionsfaktor', unit: 'kg CO₂e/kWh', min: 0.0, max: 1.0, step: 0.01, tooltip: 'Spezifische CO₂-Emissionen des Strommixes. Deutschland 2023: 0,380 kg/kWh (UBA)' },
  { key: 'winter_surcharge', label: 'Winterzuschlag Verbrauch', unit: '(0-0,5)', min: 0.0, max: 0.5, step: 0.05, tooltip: 'Zusätzlicher Energiebedarf im Winter durch Heizung. 0,15 = +15% Verbrauch' },
];
// NOTE: wallbox_price_eur, installation_type moved to Step3Depot. This file is no longer used in the wizard.

export default function Step4Assumptions() {
  const { wizard, updateWizardStep4, setWizardStep } = useProjectStore();
  const { handleSubmit, control, watch } = useForm({
    defaultValues: wizard.step4,
  });

  const onSubmit = (data: typeof wizard.step4) => {
    updateWizardStep4(data);
    setWizardStep(5);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Laderahmenbedingungen</h2>
        <p className="text-sm text-slate-500 mt-1">
          Definieren Sie Annahmen für Laden, Strompreise und Emissionsfaktoren.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(field => {
            return (
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
                        <Slider
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={[Number(f.value)]}
                          onValueChange={([v]) => f.onChange(v)}
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <Input
                          type="number"
                          step={field.step}
                          min={field.min}
                          max={field.max}
                          className="h-8 text-sm text-right"
                          value={Number(f.value)}
                          onChange={e => f.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-20 shrink-0">{field.unit}</span>
                    </div>
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Public charging toggle */}
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
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-xs font-semibold text-blue-800 mb-2">Vorschau Annahmen</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div><span className="text-slate-500">SOC Abfahrt / Reserve:</span> <span className="font-medium">{watch('soc_target')}% / {watch('soc_min')}%</span></div>
            <div><span className="text-slate-500">Ladeleistung:</span> <span className="font-medium">{watch('charging_power_kw')} kW</span></div>
            <div><span className="text-slate-500">Strompreis:</span> <span className="font-medium">{Number(watch('electricity_price')).toFixed(2)} €/kWh</span></div>
            <div><span className="text-slate-500">CO₂-Faktor:</span> <span className="font-medium">{Number(watch('grid_emission_factor')).toFixed(3)} kg/kWh</span></div>
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
