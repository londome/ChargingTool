import { useRef, useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Zap, Sun, Info, Upload, X, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { WizardStep3DepotData, LastgangProfile } from '@/store/projectStore';

// ── Tooltip helper ────────────────────────────────────────────────────────────

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

// ── CSV parsing helpers ────────────────────────────────────────────────────────

// Extracts HH:MM from any datetime string — handles full timestamps like
// "2024-01-15 07:30", "2024-01-15T07:30:00", "15.01.2024 07:30", or plain "07:30"
function extractTime(raw: string): string {
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : raw.trim();
}

function parseCsvLastgang(text: string): { timestamp: string; time: string; power_kw: number }[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const powerKw = ['leistung', 'power', 'kw', 'watt', 'p_kw', 'power_kw', 'last', 'load'];
  const timeKw  = ['timestamp', 'zeit', 'time', 'datum', 'uhrzeit', 'date', 'datetime'];
  let powerIdx = headers.findIndex(h => powerKw.some(k => h.includes(k)));
  if (powerIdx === -1) powerIdx = 1;
  let timeIdx = headers.findIndex(h => timeKw.some(k => h.includes(k)));
  if (timeIdx === -1) timeIdx = 0;
  const rows: { timestamp: string; time: string; power_kw: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    if (cols.length <= Math.max(timeIdx, powerIdx)) continue;
    const rawTs   = cols[timeIdx].trim().replace(/["']/g, '');
    const rawPower = cols[powerIdx].trim().replace(/["']/g, '').replace(',', '.');
    const power    = parseFloat(rawPower);
    if (isNaN(power)) continue;
    rows.push({ timestamp: rawTs, time: extractTime(rawTs), power_kw: power });
  }
  return rows;
}

function buildDailyAverage(rows: { timestamp: string; time: string; power_kw: number }[], max_grid_connection_kw: number): LastgangProfile {
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

// ── SliderField ───────────────────────────────────────────────────────────────

function SliderField({
  label, unit, min, max, step, tooltip, control, name,
}: {
  label: string; unit: string; min: number; max: number; step: number; tooltip: string;
  control: ReturnType<typeof useForm<WizardStep3DepotData>>['control'];
  name: keyof WizardStep3DepotData;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm">{label}</Label>
        <InfoTip text={tooltip} />
      </div>
      <Controller
        name={name}
        control={control}
        render={({ field: f }) => (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Slider
                min={min} max={max} step={step}
                value={[Number(f.value)]}
                onValueChange={([v]) => f.onChange(v)}
                className="[&_[role=slider]]:bg-[#0079C0] [&_[role=slider]]:border-[#0079C0] [&_.range]:bg-[#0079C0]"
              />
            </div>
            <Input
              type="number" step={step} min={min} max={max}
              className="h-8 text-sm text-right w-20 shrink-0"
              value={Number(f.value)}
              onChange={e => f.onChange(parseFloat(e.target.value) || 0)}
            />
            <span className="text-xs text-slate-400 w-12 shrink-0">{unit}</span>
          </div>
        )}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

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

  // Total EVs from fleet definition (for "1 LP pro EV" option)
  const totalEVs = wizard.step2Vehicles.reduce((sum, v) => sum + (v.count || 1), 0) || 10;
  const [lpMode, setLpMode] = useState<'fixed' | 'per_ev'>('fixed');

  const { handleSubmit, control, watch, setValue } = useForm<WizardStep3DepotData>({
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
    setWizardStep(5);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Depot</h2>
        <p className="text-sm text-slate-500 mt-1">
          Netzanschluss, Photovoltaik und optionales Lastprofil des Depots.
        </p>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Netzanschluss ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#0079C0]" />
            <span className="text-sm font-medium text-[#001141]">Netzanschluss</span>
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <SliderField
              label="Max. Anschlussleistung" unit="kW" min={10} max={2000} step={10}
              tooltip="Maximale Leistung des Netzanschlusses am Depot. Begrenzt die gleichzeitige Ladeleistung."
              control={control} name="max_grid_connection_kw"
            />

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm">Spannungsebene</Label>
                <InfoTip text="NS: bis 1 kV (kleine Depots). MS: 1–60 kV (mittlere Depots, günstigere Netzentgelte). HS: über 60 kV (Großanlagen)." />
              </div>
              <Controller
                name="voltage_level"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NS">Niederspannung (NS, &lt;1 kV)</SelectItem>
                      <SelectItem value="MS">Mittelspannung (MS, 1–60 kV)</SelectItem>
                      <SelectItem value="HS">Hochspannung (HS, &gt;60 kV)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Anzahl Ladepunkte */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm">Anzahl Ladepunkte</Label>
                <InfoTip text="Geplante Anzahl Ladepunkte im Depot. Weniger Ladepunkte als EVs erzeugen Warteschlangen — wird in zukünftigen Versionen in der Optimierung berücksichtigt." />
              </div>
              {/* Mode toggle */}
              <div className="flex gap-2 mb-2">
                {[
                  { id: 'fixed', label: 'Feste Anzahl' },
                  { id: 'per_ev', label: '1 LP pro EV' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setLpMode(opt.id as 'fixed' | 'per_ev');
                      if (opt.id === 'per_ev') setValue('num_charging_points', totalEVs);
                    }}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      lpMode === opt.id
                        ? 'bg-[#0079C0] text-white border-[#0079C0]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                    {opt.id === 'per_ev' && <span className="ml-1 opacity-70">({totalEVs} LP)</span>}
                  </button>
                ))}
              </div>
              {lpMode === 'fixed' ? (
                <Controller
                  name="num_charging_points"
                  control={control}
                  render={({ field: f }) => (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Slider
                          min={1} max={200} step={1}
                          value={[Number(f.value)]}
                          onValueChange={([v]) => f.onChange(v)}
                          className="[&_[role=slider]]:bg-[#0079C0] [&_[role=slider]]:border-[#0079C0]"
                        />
                      </div>
                      <Input
                        type="number" min={1} max={200}
                        className="h-8 text-sm text-right w-20 shrink-0"
                        value={Number(f.value)}
                        onChange={e => f.onChange(parseInt(e.target.value) || 1)}
                      />
                      <span className="text-xs text-slate-400 w-12 shrink-0">LP</span>
                    </div>
                  )}
                />
              ) : (
                <div className="flex items-center gap-2 p-2.5 bg-[#e6f3fc] rounded border border-[#0079C0]/20 text-xs text-[#001141]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#0079C0] shrink-0" />
                  <span><strong>{totalEVs} Ladepunkte</strong> — ein LP pro EV aus dem Mobilitätsprofil.</span>
                  <span className="ml-auto text-slate-400 italic">Optimierung folgt in V1.1</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Photovoltaik ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-[#C45600]" />
            <span className="text-sm font-medium text-[#001141]">Photovoltaikanlage</span>
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>
          <SliderField
            label="PV-Leistung" unit="kWp" min={0} max={1000} step={5}
            tooltip="Installierte PV-Leistung am Depot. 0 = keine PV-Anlage. Kann Strombezugskosten senken."
            control={control} name="pv_capacity_kw"
          />
        </div>

        {/* ── Depot-Lastprofil ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-[#001141]">Depot-Lastprofil</span>
            <span className="text-xs text-slate-400">(optional)</span>
            <InfoTip text="Bestehendes Lastprofil des Depots (CSV). Wird in den Ergebnissen mit der EV-Ladelast überlagert dargestellt." />
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>

          {/* Format info — same style as Step3Mobility CSV tab */}
          <div className="rounded border border-slate-200 bg-slate-50 divide-y divide-slate-100">

            {/* Pflichtfelder */}
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-[#001141] mb-2">Pflichtfelder</p>
              <div className="space-y-1.5">
                {[
                  { field: 'Timestamp', desc: 'Datum und Uhrzeit des Messintervalls', ex: '2024-01-15 07:30' },
                  { field: 'Leistung_kW', desc: 'Gemessene Leistung am Netzanschluss', ex: '48.5' },
                ].map(({ field, desc, ex }) => (
                  <div key={field} className="flex items-center gap-3">
                    <code className="text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5 text-[#0079C0] font-mono w-40 shrink-0">{field}</code>
                    <span className="text-xs text-slate-600 flex-1">{desc}</span>
                    <span className="text-xs text-slate-400 font-mono shrink-0">z.B. {ex}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Download */}
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Vorlage herunterladen und befüllen</span>
              <button
                type="button"
                onClick={() => {
                  const rows = ['Timestamp;Leistung_kW'];
                  const base = new Date('2024-01-15');
                  for (let i = 0; i < 96; i++) {
                    const h = Math.floor(i / 4);
                    const m = (i % 4) * 15;
                    const ts = `${base.toISOString().slice(0,10)} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                    const kw = h >= 7 && h < 20 ? 40 + Math.round(Math.sin(i / 8) * 15 + 15) : 12 + Math.round(Math.random() * 8);
                    rows.push(`${ts};${kw}`);
                  }
                  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'lastprofil_vorlage.csv';
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#0079C0] text-[#0079C0] rounded hover:bg-[#e6f3fc] transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Vorlage (CSV)
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" />
            Empfohlene Auflösung: 15 min · Trennzeichen , oder ; · Zeitraum beliebig — Tagesdurchschnitt wird berechnet · Einbindung in Ladeoptimierung folgt in V1.1.
          </p>

          {!lastgangProfile ? (
            <div
              className="border-2 border-dashed border-slate-200 rounded p-5 text-center cursor-pointer hover:border-[#0079C0]/40 hover:bg-[#f0f8ff] transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleLastgangFile(file);
              }}
            >
              <Upload className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
              <p className="text-sm text-slate-500">CSV hier ablegen oder klicken</p>
              <p className="text-xs text-slate-400 mt-1">Spalten: Zeit + Leistung (kW) · Trennzeichen: , oder ;</p>
              <input
                ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLastgangFile(f); }}
              />
            </div>
          ) : (
            <div className={`p-3 rounded border ${lastgangProfile.peak_kw > lastgangProfile.max_grid_connection_kw ? 'border-amber-200 bg-amber-50' : 'border-[#c8e6c9] bg-[#f4fbf8]'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {lastgangProfile.peak_kw > lastgangProfile.max_grid_connection_kw
                    ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    : <CheckCircle2 className="h-4 w-4 text-[#043F2E] shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-[#001141]">Lastprofil geladen</p>
                    <p className="text-xs text-slate-500">
                      {lastgangProfile.intervals.length} Intervalle · {lastgangProfile.resolution_min} min · {lastgangProfile.rows_total.toLocaleString('de-DE')} Zeilen
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setLastgangProfile(null)} className="text-slate-400 hover:text-slate-600 ml-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                {[
                  [lastgangProfile.peak_kw.toFixed(1) + ' kW', 'Spitzenlast'],
                  [lastgangProfile.avg_kw.toFixed(1) + ' kW', 'Mittlere Last'],
                  [lastgangProfile.resolution_min + ' min', 'Auflösung'],
                ].map(([val, label]) => (
                  <div key={label} className="text-center p-1.5 bg-white rounded border border-slate-200">
                    <p className="font-semibold text-[#001141]">{val}</p>
                    <p className="text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              {lastgangProfile.peak_kw > lastgangProfile.max_grid_connection_kw && (
                <p className="text-xs text-amber-700 mt-2">
                  Bestehende Spitzenlast ({lastgangProfile.peak_kw.toFixed(0)} kW) überschreitet den Netzanschluss ({lastgangProfile.max_grid_connection_kw} kW). EV-Laden erfordert Lastmanagement.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Vorschau ── */}
        <div className="p-3 bg-[#e6f3fc] rounded border border-[#0079C0]/20 text-xs">
          <p className="font-medium text-[#001141] mb-2">Zusammenfassung</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Anschlussleistung', watch('max_grid_connection_kw') + ' kW'],
              ['Spannungsebene', watch('voltage_level')],
              ['Ladepunkte', watch('num_charging_points') + ' LP'],
              ['PV-Anlage', watch('pv_capacity_kw') + ' kWp'],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-slate-500">{label}:</span>{' '}
                <span className="font-medium text-[#001141]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" type="button" onClick={() => setWizardStep(wizard.wizardModule === 'ladeprozess' ? 3 : 2)}>
          ← Zurück
        </Button>
        <Button type="submit">Weiter zu Ladeinfrastruktur →</Button>
      </div>
    </form>
  );
}
