import { useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Zap, Sun, Info, Upload, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { InstallationType } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { WizardStep3DepotData, LastgangProfile } from '@/store/projectStore';

// ── CSV parsing helpers ──────────────────────────────────────────────────────

function parseCsvLastgang(text: string): { time: string; power_kw: number }[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  const powerKw = ['leistung', 'power', 'kw', 'watt', 'p_kw', 'power_kw', 'last', 'load'];
  const timeKw = ['zeit', 'time', 'timestamp', 'datum', 'uhrzeit', 'date', 'datetime'];

  let powerIdx = headers.findIndex(h => powerKw.some(k => h.includes(k)));
  if (powerIdx === -1) powerIdx = 1;
  let timeIdx = headers.findIndex(h => timeKw.some(k => h.includes(k)));
  if (timeIdx === -1) timeIdx = 0;

  const rows: { time: string; power_kw: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    if (cols.length <= Math.max(timeIdx, powerIdx)) continue;

    const rawTime = cols[timeIdx].trim().replace(/["']/g, '');
    const rawPower = cols[powerIdx].trim().replace(/["']/g, '').replace(',', '.');
    const power = parseFloat(rawPower);
    if (isNaN(power)) continue;

    // Normalize to HH:MM
    const m = rawTime.match(/(\d{1,2}):(\d{2})/);
    const time = m ? `${m[1].padStart(2, '0')}:${m[2]}` : rawTime;
    rows.push({ time, power_kw: power });
  }
  return rows;
}

function buildDailyAverage(rows: { time: string; power_kw: number }[], max_grid_connection_kw: number): LastgangProfile {
  const groups: Record<string, number[]> = {};
  for (const r of rows) {
    if (!groups[r.time]) groups[r.time] = [];
    groups[r.time].push(r.power_kw);
  }

  const intervals = Object.entries(groups)
    .map(([time, vals]) => ({ time, power_kw: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => a.time.localeCompare(b.time));

  let resolution_min = 15;
  if (intervals.length >= 2) {
    const [h1, m1] = intervals[0].time.split(':').map(Number);
    const [h2, m2] = intervals[1].time.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff > 0) resolution_min = diff;
  }

  const powers = intervals.map(i => i.power_kw);
  return {
    intervals,
    peak_kw: Math.max(...powers),
    avg_kw: powers.reduce((a, b) => a + b, 0) / powers.length,
    resolution_min,
    rows_total: rows.length,
    max_grid_connection_kw,
  };
}

const INSTALLATION_OPTIONS = [
  {
    value: InstallationType.SIMPLE,
    label: 'Einfach',
    description: 'Nur Wallbox-Montage, keine Bauarbeiten',
    badge: '~€1.000/LP',
  },
  {
    value: InstallationType.STANDARD,
    label: 'Standard',
    description: 'Elektroinstallation, Kabelführung, Unterverteilung',
    badge: '~€3.500/LP',
  },
  {
    value: InstallationType.AUFWENDIG,
    label: 'Aufwendig',
    description: 'Bauliche Maßnahmen, Tiefbau, ggf. Transformator-Upgrade',
    badge: '~€8.000/LP',
  },
];

function SliderField({
  label, unit, min, max, step, tooltip, control, name,
}: {
  label: string; unit: string; min: number; max: number; step: number; tooltip: string;
  control: ReturnType<typeof useForm<WizardStep3DepotData>>['control'];
  name: keyof WizardStep3DepotData;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-sm">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p className="text-xs">{tooltip}</p></TooltipContent>
        </Tooltip>
      </div>
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Slider min={min} max={max} step={step} value={[Number(f.value)]}
                onValueChange={([v]) => f.onChange(v)} />
            </div>
            <div className="w-24 shrink-0">
              <Input type="number" step={step} min={min} max={max}
                className="h-8 text-sm text-right" value={Number(f.value)}
                onChange={e => f.onChange(parseFloat(e.target.value) || 0)} />
            </div>
            <span className="text-xs text-slate-500 w-16 shrink-0">{unit}</span>
          </div>
        )}
      />
    </div>
  );
}

export default function Step3Depot() {
  const { wizard, updateWizardStep3Depot, setWizardStep, lastgangProfile, setLastgangProfile } = useProjectStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLastgangFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsvLastgang(text);
      if (rows.length === 0) return;
      const profile = buildDailyAverage(rows, wizard.step3Depot?.max_grid_connection_kw ?? 100);
      setLastgangProfile(profile);
    };
    reader.readAsText(file, 'UTF-8');
  }, [wizard.step3Depot?.max_grid_connection_kw, setLastgangProfile]);

  const { handleSubmit, control, watch } = useForm<WizardStep3DepotData>({
    defaultValues: wizard.step3Depot ?? {
      max_grid_connection_kw: 100,
      voltage_level: 'NS',
      pv_capacity_kw: 0,
      num_charging_points: 10,
      wallbox_price_eur: 1200,
      installation_type: 'standard',
    },
  });

  const onSubmit = (data: WizardStep3DepotData) => {
    updateWizardStep3Depot(data);
    setWizardStep(4);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Depot</h2>
        <p className="text-sm text-slate-500 mt-1">
          Netzanschluss, Photovoltaik und Investitionskosten der Ladeinfrastruktur.
        </p>
      </div>

      <div className="p-6 space-y-6">

        {/* Netzanschluss */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" /> Netzanschluss
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SliderField
              label="Max. Anschlussleistung" unit="kW" min={10} max={2000} step={10}
              tooltip="Maximale Leistung des Netzanschlusses am Depot. Begrenzt die gleichzeitige Ladeleistung."
              control={control} name="max_grid_connection_kw"
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-sm">Spannungsebene</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">NS: bis 1kV (typisch für kleine Depots). MS: 1–60kV (mittlere Depots, günstigere Netzentgelte). HS: über 60kV (Großanlagen).</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Controller
                name="voltage_level"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NS">Niederspannung (NS, &lt;1 kV)</SelectItem>
                      <SelectItem value="MS">Mittelspannung (MS, 1–60 kV)</SelectItem>
                      <SelectItem value="HS">Hochspannung (HS, &gt;60 kV)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <SliderField
              label="Anzahl Ladepunkte" unit="LP" min={1} max={200} step={1}
              tooltip="Geplante Anzahl Ladepunkte im Depot. Beeinflusst Gleichzeitigkeitsgrad und Netzlast."
              control={control} name="num_charging_points"
            />
          </div>
        </div>

        {/* Photovoltaik */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Sun className="h-4 w-4 text-orange-400" /> Photovoltaikanlage
          </h3>
          <SliderField
            label="PV-Leistung" unit="kWp" min={0} max={1000} step={5}
            tooltip="Installierte PV-Leistung am Depot. 0 = keine PV-Anlage. Kann Strombezugskosten senken."
            control={control} name="pv_capacity_kw"
          />
        </div>

        {/* Depot Lastgang / Load Profile */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" /> Depot-Lastprofil (Lastgang)
          </h3>
          <p className="text-xs text-slate-500">
            Optional: Laden Sie das bestehende Lastprofil Ihres Depots hoch (CSV). Es wird in den Ergebnissen mit der EV-Ladelast überlagert dargestellt.
          </p>

          {/* Upload zone */}
          {!lastgangProfile ? (
            <div
              className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleLastgangFile(file);
              }}
            >
              <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">CSV-Datei hier ablegen oder klicken</p>
              <p className="text-xs text-slate-400 mt-1">Erwartet: Spalten Zeit + Leistung (kW) · Trennzeichen: , oder ;</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLastgangFile(f); }}
              />
            </div>
          ) : (
            <div className={`p-3 rounded-lg border ${lastgangProfile.peak_kw > lastgangProfile.max_grid_connection_kw ? 'border-amber-300 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {lastgangProfile.peak_kw > lastgangProfile.max_grid_connection_kw
                    ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-sm font-medium text-slate-800">Lastprofil geladen</p>
                    <p className="text-xs text-slate-500">
                      {lastgangProfile.intervals.length} Intervalle · {lastgangProfile.resolution_min} min · {lastgangProfile.rows_total.toLocaleString('de-DE')} Zeilen gesamt
                    </p>
                  </div>
                </div>
                <button onClick={() => setLastgangProfile(null)} className="text-slate-400 hover:text-slate-600 ml-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div className="text-center p-1.5 bg-white rounded border border-slate-200">
                  <p className="font-semibold text-slate-900">{lastgangProfile.peak_kw.toFixed(1)} kW</p>
                  <p className="text-slate-500">Spitzenlast</p>
                </div>
                <div className="text-center p-1.5 bg-white rounded border border-slate-200">
                  <p className="font-semibold text-slate-900">{lastgangProfile.avg_kw.toFixed(1)} kW</p>
                  <p className="text-slate-500">Mittlere Last</p>
                </div>
                <div className="text-center p-1.5 bg-white rounded border border-slate-200">
                  <p className="font-semibold text-slate-900">{lastgangProfile.resolution_min} min</p>
                  <p className="text-slate-500">Auflösung</p>
                </div>
              </div>
              {lastgangProfile.peak_kw > lastgangProfile.max_grid_connection_kw && (
                <p className="text-xs text-amber-700 mt-2">
                  ⚠ Bestehende Spitzenlast ({lastgangProfile.peak_kw.toFixed(0)} kW) überschreitet bereits den Netzanschluss ({lastgangProfile.max_grid_connection_kw} kW). EV-Laden erfordert Lastmanagement.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-xs font-semibold text-blue-800 mb-2">Vorschau Depot</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div><span className="text-slate-500">Anschlussleistung:</span> <span className="font-medium">{watch('max_grid_connection_kw')} kW</span></div>
            <div><span className="text-slate-500">Spannungsebene:</span> <span className="font-medium">{watch('voltage_level')}</span></div>
            <div><span className="text-slate-500">Ladepunkte:</span> <span className="font-medium">{watch('num_charging_points')} LP</span></div>
            <div><span className="text-slate-500">PV-Anlage:</span> <span className="font-medium">{watch('pv_capacity_kw')} kWp</span></div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" type="button" onClick={() => setWizardStep(2)}>← Zurück</Button>
        <Button type="submit">Weiter zu Ladeinfrastruktur →</Button>
      </div>
    </form>
  );
}
