import { useRef, useCallback, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Zap, Sun, Info, Upload, X, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useRoutes, useSaveWizardConfig } from '@/lib/api';
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

// Returns null if resolution is not 15 min
function buildDailyAverage(
  rows: { timestamp: string; time: string; power_kw: number }[],
  max_grid_connection_kw: number
): LastgangProfile | null {
  const groups: Record<string, number[]> = {};
  for (const r of rows) {
    if (!groups[r.time]) groups[r.time] = [];
    groups[r.time].push(r.power_kw);
  }
  const intervals = Object.entries(groups)
    .map(([time, vals]) => ({ time, power_kw: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => a.time.localeCompare(b.time));

  // Detect resolution from first two intervals
  let resolution_min = 15;
  if (intervals.length >= 2) {
    const [h1, m1] = intervals[0].time.split(':').map(Number);
    const [h2, m2] = intervals[1].time.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff > 0) resolution_min = diff;
  }

  // Reject non-15min files
  if (resolution_min !== 15) return null;

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

// ── BDEW standard load profiles ──────────────────────────────────────────────
// Exact normalized shapes (0–1), 96 × 15-min slots, annual workday average.
// Source: "Repräsentative Profile VDEW.xls" from official BDEW ZIP download
// (bdew.de/energie/standardlastprofile-strom), processed as:
//   avg_wt[i] = (Winter_Werktag[i] + Sommer_Werktag[i] + Übergangszeit_Werktag[i]) / 3
//   shape[i]  = avg_wt[i] / max(avg_wt)

const BDEW_PROFILES: {
  id: string;
  label: string;
  description: string;
  shape: number[]; // 96 normalized values (0–1), index 0 = 00:00–00:15
}[] = [
  {
    id: 'G0',
    label: 'G0 – Gewerbe allgemein',
    description: 'Allgemeines Gewerbeprofil: Verbrauch tagsüber, gering nachts.',
    shape: [0.3125,0.3001,0.2872,0.2753,0.2649,0.2564,0.2493,0.2433,0.2385,0.2348,0.2321,0.231,0.2308,0.2329,0.2382,0.2475,0.261,0.2766,0.2923,0.3045,0.3119,0.3159,0.3185,0.3225,0.3299,0.3415,0.3582,0.3811,0.4109,0.4506,0.5031,0.5714,0.656,0.747,0.832,0.8984,0.9371,0.9536,0.9565,0.9554,0.9565,0.9616,0.969,0.979,0.9894,0.9975,1.0,0.9929,0.9738,0.9448,0.9098,0.8719,0.8342,0.7999,0.7711,0.7507,0.7409,0.7408,0.7488,0.7634,0.7829,0.8037,0.8222,0.8344,0.8375,0.835,0.8305,0.8287,0.8314,0.8332,0.8269,0.8051,0.7628,0.7057,0.6418,0.5798,0.526,0.4821,0.4491,0.4268,0.4152,0.4106,0.4089,0.406,0.3987,0.3882,0.3771,0.3671,0.3603,0.3561,0.3534,0.3503,0.3463,0.3408,0.3335,0.324],
  },
  {
    id: 'G1',
    label: 'G1 – Gewerbe werktags 8–18 Uhr',
    description: 'Büro-/Gewerbezeiten: starker Peak 8–18 Uhr, sehr gering außerhalb.',
    shape: [0.0573,0.056,0.0548,0.0541,0.0537,0.0537,0.0539,0.0541,0.0543,0.0543,0.0543,0.0541,0.0537,0.0533,0.053,0.0525,0.0523,0.0525,0.054,0.0572,0.0594,0.0615,0.0631,0.0634,0.0746,0.0858,0.1037,0.1238,0.2253,0.3597,0.5075,0.6494,0.7692,0.8638,0.9331,0.9771,0.9971,1.0,0.9937,0.9864,0.9845,0.9864,0.9897,0.9911,0.9879,0.9794,0.9652,0.9447,0.9175,0.8832,0.8413,0.7916,0.7354,0.6818,0.6417,0.6261,0.6414,0.6765,0.7158,0.7437,0.7483,0.7322,0.7018,0.6633,0.6216,0.5768,0.5278,0.473,0.4128,0.3508,0.2924,0.2427,0.2055,0.1788,0.1595,0.1438,0.1293,0.1162,0.1048,0.0959,0.0898,0.0858,0.083,0.0805,0.0774,0.0739,0.0707,0.068,0.0661,0.0649,0.0641,0.0634,0.0625,0.0613,0.0601,0.0587],
  },
  {
    id: 'G3',
    label: 'G3 – Gewerbe durchlaufend',
    description: 'Kontinuierlicher Betrieb 24/7, z.B. Kühllogistik, Produktion.',
    shape: [0.6418,0.6394,0.6385,0.6389,0.6396,0.64,0.6403,0.6387,0.6355,0.6308,0.6247,0.6184,0.6111,0.6042,0.5969,0.5897,0.5827,0.5775,0.5755,0.5773,0.5845,0.5965,0.6121,0.6306,0.6511,0.6707,0.6872,0.6976,0.7007,0.7028,0.7114,0.7344,0.7761,0.8283,0.8799,0.9199,0.9402,0.9454,0.9431,0.9418,0.947,0.9576,0.9702,0.9813,0.9887,0.9926,0.9948,0.9964,0.9984,1.0,0.9984,0.9923,0.9804,0.9641,0.9461,0.9282,0.9127,0.9009,0.8939,0.8926,0.8978,0.907,0.9172,0.9255,0.9294,0.9307,0.9312,0.9336,0.9393,0.9474,0.9564,0.965,0.9716,0.9745,0.9722,0.9637,0.9472,0.9251,0.9,0.8747,0.8517,0.8307,0.8113,0.793,0.7754,0.759,0.7439,0.7303,0.7183,0.7073,0.6971,0.6865,0.6755,0.6646,0.6547,0.647],
  },
  {
    id: 'G4',
    label: 'G4 – Laden / Friseur',
    description: 'Einzelhandel & Dienstleistung: Peak mittags und nachmittags.',
    shape: [0.33,0.3247,0.3194,0.3148,0.3109,0.3077,0.3051,0.3032,0.3017,0.3006,0.2996,0.2988,0.298,0.2972,0.2965,0.2959,0.2952,0.2949,0.2957,0.2973,0.3004,0.3041,0.3077,0.3104,0.3121,0.3164,0.3279,0.3513,0.3895,0.4426,0.509,0.5874,0.6745,0.7629,0.8434,0.9066,0.9456,0.9657,0.9739,0.978,0.9832,0.9896,0.9958,0.9998,1.0,0.9972,0.9916,0.9838,0.9733,0.9577,0.9331,0.8964,0.8457,0.7893,0.7381,0.7025,0.69,0.7002,0.7281,0.771,0.8233,0.8782,0.9271,0.9619,0.9765,0.9777,0.9731,0.9721,0.9798,0.9909,0.9964,0.9882,0.959,0.9122,0.8528,0.7856,0.7155,0.6483,0.5895,0.5451,0.5181,0.5043,0.4965,0.4883,0.4742,0.4554,0.4343,0.4139,0.3958,0.3807,0.3683,0.3585,0.3509,0.3451,0.3401,0.3352],
  },
  {
    id: 'L0',
    label: 'L0 – Landwirtschaft allgemein',
    description: 'Früher Morgen-Peak (Stallzeiten), zweiter Peak abends.',
    shape: [0.3335,0.3188,0.3062,0.296,0.2879,0.2818,0.2772,0.2736,0.2711,0.2688,0.2669,0.265,0.2626,0.2602,0.258,0.2559,0.2548,0.2546,0.2558,0.2589,0.2645,0.2732,0.2858,0.3034,0.3267,0.3578,0.3995,0.4542,0.5228,0.6018,0.6858,0.7695,0.8471,0.9117,0.9546,0.9677,0.9466,0.8997,0.8395,0.7781,0.7264,0.6879,0.6642,0.6585,0.67,0.6891,0.7051,0.7058,0.6834,0.6446,0.5992,0.558,0.5283,0.5099,0.4995,0.4942,0.4911,0.4895,0.4888,0.4883,0.4879,0.4875,0.4875,0.4883,0.4901,0.4949,0.505,0.5224,0.549,0.5863,0.6351,0.6968,0.7706,0.8476,0.9177,0.9706,0.9981,1.0,0.9788,0.9366,0.8768,0.8069,0.7351,0.6703,0.6187,0.5792,0.5482,0.5224,0.4989,0.4765,0.4551,0.4335,0.4118,0.3904,0.3698,0.3508],
  },
  {
    id: 'H0',
    label: 'H0 – Haushalt',
    description: 'Wohngebäude: Peak abends 19–21 Uhr, Morgenspitze 7–9 Uhr.',
    shape: [0.4343,0.3886,0.3488,0.3166,0.2937,0.2785,0.2688,0.262,0.2566,0.2519,0.2482,0.245,0.2424,0.2409,0.2397,0.2403,0.2416,0.2446,0.2489,0.2544,0.2622,0.2767,0.3035,0.3479,0.4126,0.4894,0.5676,0.6366,0.6877,0.7228,0.7453,0.7597,0.7693,0.7745,0.776,0.7738,0.7683,0.7608,0.7516,0.7425,0.7344,0.7275,0.7228,0.7209,0.7222,0.7284,0.7402,0.7597,0.7863,0.8144,0.8369,0.847,0.8396,0.8186,0.7899,0.7597,0.7329,0.71,0.6896,0.6709,0.653,0.6371,0.6234,0.6131,0.6067,0.6056,0.6105,0.6225,0.6424,0.6694,0.7025,0.741,0.7835,0.8279,0.8724,0.9142,0.9513,0.9805,0.9979,1.0,0.9852,0.9588,0.9276,0.8986,0.877,0.8604,0.8446,0.8253,0.7991,0.7661,0.7271,0.6834,0.6358,0.5858,0.5346,0.4836],
  },
];

/** Scales a normalized BDEW shape (0–1) to kW values using the peak grid connection */
function bdewToProfile(shape: number[], peak_kw: number, max_grid_kw: number): LastgangProfile {
  const intervals = shape.map((rel, i) => {
    const hh = Math.floor(i / 4).toString().padStart(2, '0');
    const mm = ((i % 4) * 15).toString().padStart(2, '0');
    return { time: `${hh}:${mm}`, power_kw: Math.round(rel * peak_kw * 10) / 10 };
  });
  const powers = intervals.map(iv => iv.power_kw);
  return {
    intervals,
    peak_kw: Math.max(...powers),
    avg_kw: Math.round((powers.reduce((a, b) => a + b, 0) / powers.length) * 10) / 10,
    resolution_min: 15,
    rows_total: 96,
    max_grid_connection_kw: max_grid_kw,
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
  const { wizard, updateWizardStep3Depot, setWizardStep, lastgangProfile, lastgangProjectId, setLastgangProfile } = useProjectStore();
  // Only show the profile if it belongs to the current project
  const activeLastgang = lastgangProfile && lastgangProjectId === wizard.projectId ? lastgangProfile : null;
  const saveWizardConfig = useSaveWizardConfig();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLastgangFile = useCallback((file: File) => {
    setLastgangError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsvLastgang(text);
      if (rows.length === 0) {
        setLastgangError('Datei konnte nicht gelesen werden. Bitte Format prüfen.');
        return;
      }
      const profile = buildDailyAverage(rows, wizard.step3Depot?.max_grid_connection_kw ?? 100);
      if (!profile) {
        setLastgangError('Ungültige Auflösung. Die Datei muss 15-Minuten-Intervalle enthalten (96 Zeilen/Tag).');
        return;
      }
      setLastgangProfile(profile, wizard.projectId);
    };
    reader.readAsText(file, 'UTF-8');
  }, [wizard.step3Depot?.max_grid_connection_kw, wizard.projectId, setLastgangProfile]);

  // Total EVs — set synchronously by Step3Mobility when user confirms mobility profile:
  //   manual      → sum of vehicle_count per route
  //   fleet_level → sum of vehicle_count per Fahrzeugtyp
  //   upload      → refined async below via unique vehicle_ids
  //   reuse path  → refined async below via route vehicle_counts
  const { data: routesData, isLoading: routesLoading } = useRoutes(wizard.projectId ?? undefined);
  const totalEVs = (() => {
    const stored = wizard.step3TotalVehicles;
    // Always derive from routes when reusing a Reichweiten project
    if (!wizard.reuseReichweitenProjectId) {
      if (wizard.step3MobilityMode === 'upload') {
        const routes = routesData?.data ?? [];
        if (routes.length) {
          return new Set(routes.map((r: { vehicle_id?: string | null }) => r.vehicle_id).filter(Boolean)).size || routes.length;
        }
        return routesLoading ? 0 : (stored || 1);
      }
      if (stored > 0) return stored;
    }
    // Reuse path OR stored=0: sum vehicle_count from DB routes (wait for load)
    if (routesLoading) return 0;
    const routes = routesData?.data ?? [];
    const fromRoutes = routes.reduce((sum: number, r: { vehicle_count?: number | null }) => sum + (r.vehicle_count ?? 1), 0);
    // Fallback chain: DB routes → wizard.step3TotalVehicles (set from copy result) → 1
    return fromRoutes || stored || 1;
  })();
  const [lastgangError, setLastgangError] = useState<string | null>(null);
  const [selectedBdewId, setSelectedBdewId] = useState<string | null>(null);
  const [bdewPeakKw, setBdewPeakKw] = useState<number>(50); // user-defined peak for BDEW scaling

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
    if (wizard.projectId && !wizard.projectId.startsWith('local_')) {
      saveWizardConfig.mutate({
        projectId: wizard.projectId,
        config: { ...(wizard as any).wizard_config, step3Depot: data },
      });
    }
    // Step 4 = Ladeinfrastruktur in all modules that use Step3Depot
    setWizardStep(4);
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
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 uppercase tracking-wide">Optional</span>
            <InfoTip text="Bestehendes Lastprofil des Depots (CSV, 15-min-Auflösung). Wird in den Ergebnissen mit der EV-Ladelast überlagert. Trennzeichen , oder ; — Zeitraum beliebig, Tagesdurchschnitt wird berechnet. Einbindung in Ladeoptimierung folgt in V1.1." />
            <div className="flex-1 h-px bg-slate-100 ml-1" />
          </div>

          {lastgangError && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {lastgangError}
            </div>
          )}

          {/* ── BDEW standard profiles ── */}
          {!activeLastgang && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                BDEW-Standardlastprofil auswählen
              </p>

              {/* Peak scaling input */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[#001141] block mb-1">
                    Maximale Bestandslast
                    <InfoTip text="Gemessene oder geschätzte Spitzenlast des Depots ohne EV-Laden. Das BDEW-Profil wird auf diesen Wert skaliert. Erkennbar z.B. aus dem Zählerprotokoll oder der Jahreshöchstlast im Stromliefervertrag." />
                  </label>
                  <p className="text-[11px] text-slate-500">Das Profil wird auf diesen Spitzenwert skaliert</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    className="h-8 text-sm text-right w-24 rounded border border-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-[#0079C0]"
                    value={bdewPeakKw}
                    onChange={e => setBdewPeakKw(parseFloat(e.target.value) || 1)}
                  />
                  <span className="text-xs text-slate-400">kW</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {BDEW_PROFILES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const gridKw = watch('max_grid_connection_kw') ?? 100;
                      const profile = bdewToProfile(p.shape, bdewPeakKw, gridKw);
                      setLastgangProfile(profile, wizard.projectId);
                      setLastgangError(null);
                      setSelectedBdewId(p.id);
                    }}
                    className="text-left p-3 rounded border border-slate-200 hover:border-[#0079C0] hover:bg-[#f0f8ff] transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#001141] group-hover:text-[#0079C0]">{p.id}</span>
                      {/* Mini sparkline */}
                      <svg width="48" height="18" viewBox="0 0 48 18" className="text-[#0079C0]">
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          points={p.shape
                            .filter((_, i) => i % 4 === 0) // downsample to 24 points
                            .map((v, i) => `${(i / 23) * 47},${(1 - v) * 16 + 1}`)
                            .join(' ')}
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-slate-600 leading-snug">{p.description}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">oder eigenes Profil hochladen</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Format info */}
              <div className="rounded border border-slate-200 bg-slate-50 divide-y divide-slate-100">
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
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Vorlage herunterladen und befüllen</span>
                  <button
                    type="button"
                    onClick={() => {
                      const G0_SHAPE = [0.3125,0.3001,0.2872,0.2753,0.2649,0.2564,0.2493,0.2433,0.2385,0.2348,0.2321,0.231,0.2308,0.2329,0.2382,0.2475,0.261,0.2766,0.2923,0.3045,0.3119,0.3159,0.3185,0.3225,0.3299,0.3415,0.3582,0.3811,0.4109,0.4506,0.5031,0.5714,0.656,0.747,0.832,0.8984,0.9371,0.9536,0.9565,0.9554,0.9565,0.9616,0.969,0.979,0.9894,0.9975,1.0,0.9929,0.9738,0.9448,0.9098,0.8719,0.8342,0.7999,0.7711,0.7507,0.7409,0.7408,0.7488,0.7634,0.7829,0.8037,0.8222,0.8344,0.8375,0.835,0.8305,0.8287,0.8314,0.8332,0.8269,0.8051,0.7628,0.7057,0.6418,0.5798,0.526,0.4821,0.4491,0.4268,0.4152,0.4106,0.4089,0.406,0.3987,0.3882,0.3771,0.3671,0.3603,0.3561,0.3534,0.3503,0.3463,0.3408,0.3335,0.324];
                      const rows = ['Timestamp;Leistung_kW'];
                      const base = '2024-01-15';
                      for (let i = 0; i < 96; i++) {
                        const h = String(Math.floor(i / 4)).padStart(2, '0');
                        const m = String((i % 4) * 15).padStart(2, '0');
                        const kw = Math.round(G0_SHAPE[i] * 60 * 10) / 10;
                        rows.push(`${base} ${h}:${m};${kw}`);
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
            </div>
          )}

          {!activeLastgang ? (
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
            <div className={`p-3 rounded border ${activeLastgang.peak_kw > activeLastgang.max_grid_connection_kw ? 'border-amber-200 bg-amber-50' : 'border-[#c8e6c9] bg-[#f4fbf8]'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {activeLastgang.peak_kw > activeLastgang.max_grid_connection_kw
                    ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    : <CheckCircle2 className="h-4 w-4 text-[#043F2E] shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-[#001141]">
                      {selectedBdewId
                        ? `BDEW ${selectedBdewId} – ${BDEW_PROFILES.find(p => p.id === selectedBdewId)?.label.split('–')[1]?.trim() ?? selectedBdewId}`
                        : 'Lastprofil geladen'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {activeLastgang.intervals.length} Intervalle · {activeLastgang.resolution_min} min · {activeLastgang.rows_total.toLocaleString('de-DE')} Zeilen
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => { setLastgangProfile(null); setSelectedBdewId(null); }} className="text-slate-400 hover:text-slate-600 ml-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                {[
                  [activeLastgang.peak_kw.toFixed(1) + ' kW', 'Spitzenlast'],
                  [activeLastgang.avg_kw.toFixed(1) + ' kW', 'Mittlere Last'],
                  [activeLastgang.resolution_min + ' min', 'Auflösung'],
                ].map(([val, label]) => (
                  <div key={label} className="text-center p-1.5 bg-white rounded border border-slate-200">
                    <p className="font-semibold text-[#001141]">{val}</p>
                    <p className="text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              {activeLastgang.peak_kw > activeLastgang.max_grid_connection_kw && (
                <p className="text-xs text-amber-700 mt-2">
                  Bestehende Spitzenlast ({activeLastgang.peak_kw.toFixed(0)} kW) überschreitet den Netzanschluss ({activeLastgang.max_grid_connection_kw} kW). EV-Laden erfordert Lastmanagement.
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
