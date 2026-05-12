import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ComposedChart, AreaChart, LineChart, BarChart,
  Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Brush,
} from 'recharts';
import { Zap, Clock, DollarSign, AlertTriangle, Loader2, TrendingDown, LayoutDashboard, Download, TrendingUp, Activity, BarChart2 } from 'lucide-react';
import { Cell } from 'recharts';
import { useOptimizationLatest, OptimizationRunResult, VehicleOptResult } from '@/lib/api';
import { useProjectStore } from '@/store/projectStore';

const BIDDING_ZONES: Record<string, string> = {
  DE_LU: 'Deutschland/Luxemburg (DE-LU)',
  GB: 'Großbritannien (GB)',
  NL: 'Niederlande (NL)',
  DE_AT_LU: 'DE-AT-LU (historisch)',
  FR: 'Frankreich (FR)',
  ES: 'Spanien (ES)',
};

const VEHICLE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2',
  '#be185d', '#65a30d', '#9333ea', '#0284c7',
];

function formatTime(intervalIdx: number): string {
  const totalMinutes = intervalIdx * 15;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildTimeLabels(): string[] {
  return Array.from({ length: 96 }, (_, i) => formatTime(i));
}

const TIME_LABELS = buildTimeLabels();

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}

function KpiCard({ label, value, sub, icon: Icon, color = 'blue' }: KpiCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-[#e6f3fc] text-[#0079C0]',
    green: 'bg-[#e8f5f0] text-[#043F2E]',
    amber: 'bg-amber-50 text-[#C45600]',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded border border-slate-200 p-5 flex items-start gap-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded shrink-0 ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-[#001141] leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function OptimizationResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeProject, wizard } = useProjectStore();

  const pid = projectId || activeProject?.id;
  const latestQuery = useOptimizationLatest(pid);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string> | null>(null); // null = all

  const latestData = latestQuery.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawResults: any = latestData?.results ?? null;
  const isPeriod = rawResults?.type === 'period';
  const results: OptimizationRunResult | null = isPeriod ? null : (rawResults as OptimizationRunResult | null);
  const periodTotals = isPeriod ? rawResults?.totals : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodDays: any[] = isPeriod ? (rawResults?.days ?? []) : [];
  const isLoading = latestData?.status === 'pending' || latestData?.status === 'running';
  const isError = latestData?.status === 'failed';
  const isInfeasible = results?.status === 'infeasible';
  const isOptimal = results?.status === 'optimal' || isPeriod;
  const socArrivalWarning: string | null = rawResults?.soc_arrival_warning ?? null;
  const socArrivalPct: number | null = rawResults?.soc_arrival_pct ?? null;
  const socTarget: number = wizard?.step4?.soc_target ?? 80;
  const socMin: number = wizard?.step4?.soc_min ?? 20;

  // Build chart data for price + fleet power (optimized + naive + depot)
  const hasDepot = !!(results?.depot_profile_kw?.length === 96);
  const priceFleetData = TIME_LABELS.map((time, i) => ({
    time,
    price_eurkwh: results?.prices_15min?.[i] ?? 0,
    fleet_kw: results?.fleet_power_kw?.[i] ?? 0,
    naive_kw: results?.naive_fleet_power_kw?.[i] ?? 0,
    depot_kw: results?.depot_profile_kw?.[i] ?? 0,
    total_kw: (results?.fleet_power_kw?.[i] ?? 0) + (results?.depot_profile_kw?.[i] ?? 0),
  }));

  // Kostenvergleich: Optimiert vs Sofortladen
  const naiveCost = results?.naive_total_cost_eur ?? 0;
  const optimCost = results?.total_cost_eur ?? 0;
  const savingsEur = naiveCost - optimCost;
  const savingsPct = naiveCost > 0 ? (savingsEur / naiveCost) * 100 : 0;
  const kostenvergleichData = [
    { name: 'Sofortladen', cost: naiveCost, fill: '#94a3b8' },
    { name: 'Optimiert', cost: optimCost, fill: '#16a34a' },
  ];

  // Preishistogramm: energy charged per price bin
  const priceHistData = (() => {
    if (!results) return [];
    const BIN_SIZE = 2; // ct/kWh per bin
    const bins: Record<number, number> = {};
    results.prices_15min.forEach((p, i) => {
      const ctKwh = p * 100;
      const bin = Math.floor(ctKwh / BIN_SIZE) * BIN_SIZE;
      const energyCharged = results.fleet_power_kw[i] * 0.25;
      bins[bin] = (bins[bin] ?? 0) + energyCharged;
    });
    return Object.entries(bins)
      .map(([b, e]) => ({ bin: `${b}–${+b + BIN_SIZE} ct`, binVal: Number(b), energy: +e.toFixed(2) }))
      .sort((a, b) => a.binVal - b.binVal);
  })();

  // Weekly grouping for multi-day period
  const weeklyData = (() => {
    if (!isPeriod || periodDays.length === 0) return [];
    const weeks: Record<string, { week: string; cost: number; energy: number; days: number }> = {};
    periodDays.forEach((d: any) => {
      const date = new Date(d.date);
      const y = date.getFullYear();
      const w = Math.ceil((((date.getTime() - new Date(y, 0, 1).getTime()) / 86400000) + new Date(y, 0, 1).getDay() + 1) / 7);
      const key = `KW${w}`;
      if (!weeks[key]) weeks[key] = { week: key, cost: 0, energy: 0, days: 0 };
      weeks[key].cost += d.total_cost_eur ?? 0;
      weeks[key].energy += d.total_energy_kwh ?? 0;
      weeks[key].days += 1;
    });
    return Object.values(weeks);
  })();

  // For period mode: flatten all days into one continuous series
  const allPriceFleetData = isPeriod
    ? periodDays.flatMap((day: any) =>
        Array.from({ length: 96 }, (_, i) => ({
          time: `${day.date} ${formatTime(i)}`,
          price_eurkwh: day.prices_15min?.[i] ?? 0,
          fleet_kw: day.fleet_power_kw?.[i] ?? 0,
        }))
      )
    : priceFleetData;

  // Build per-vehicle schedule chart data (stacked)
  const scheduleData = TIME_LABELS.map((time, i) => {
    const entry: Record<string, number | string> = { time };
    if (results?.vehicles) {
      results.vehicles.forEach((vr) => {
        entry[vr.vehicle_name] = vr.schedule_kw[i] ?? 0;
      });
    }
    return entry;
  });

  // For period mode: flatten schedule data for all days
  const allScheduleData = isPeriod
    ? periodDays.flatMap((day: any) =>
        Array.from({ length: 96 }, (_, i) => {
          const entry: Record<string, number | string> = { time: `${day.date} ${formatTime(i)}` };
          if (day.vehicles) {
            day.vehicles.forEach((vr: any) => {
              entry[vr.vehicle_name] = vr.schedule_kw?.[i] ?? 0;
            });
          }
          return entry;
        })
      )
    : scheduleData;

  // For period mode: determine vehicle names from first day that has vehicles
  const periodVehicleNames: string[] = isPeriod
    ? (() => {
        const firstDayWithVehicles = periodDays.find((d: any) => d.vehicles?.length > 0);
        return firstDayWithVehicles?.vehicles?.map((v: any) => v.vehicle_name) ?? [];
      })()
    : [];

  // Build SOC curve data (97 points, but we use 96 time labels + initial)
  const socData = Array.from({ length: 97 }, (_, i) => {
    const entry: Record<string, number | string> = { time: i === 0 ? '00:00' : TIME_LABELS[i - 1] };
    if (results?.vehicles) {
      results.vehicles.forEach((vr) => {
        entry[vr.vehicle_name] = vr.soc_curve_pct[i] ?? 0;
      });
    }
    return entry;
  });

  // For period mode: flatten SOC data for all days (97 points per day)
  const allSocData = isPeriod
    ? periodDays.flatMap((day: any) =>
        Array.from({ length: 97 }, (_, i) => {
          const entry: Record<string, number | string> = {
            time: i === 0 ? `${day.date} 00:00` : `${day.date} ${formatTime(i - 1)}`,
          };
          if (day.vehicles) {
            day.vehicles.forEach((vr: any) => {
              entry[vr.vehicle_name] = vr.soc_curve_pct?.[i] ?? 0;
            });
          }
          return entry;
        })
      )
    : socData;

  // X-axis tick formatter: in period mode only show date label at first interval of each day
  const xTickFormatter = isPeriod
    ? (value: string, index: number) => index % 96 === 0 ? value.split(' ')[0] : ''
    : (value: string) => value;

  // Vehicles to render in period charts
  const chartVehicles = isPeriod ? periodVehicleNames : (results?.vehicles?.map(v => v.vehicle_name) ?? []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-[#001141]">Ladeprozess Optimierung</h1>
          <p className="text-sm text-slate-500 mt-1">
            LP-basierte kostenoptimale Ladeplanung mit ENTSO-E Day-Ahead Preisen
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isOptimal && (
            <button
              onClick={() => {
                const r = results!;
                const header = ['Zeit', 'Preis (€/kWh)', 'Flotte (kW)', ...r.vehicles.map(v => v.vehicle_name)];
                const rows = Array.from({ length: 96 }, (_, i) => [
                  `${String(Math.floor(i * 15 / 60)).padStart(2,'0')}:${String((i * 15) % 60).padStart(2,'0')}`,
                  String(r.prices_15min?.[i]?.toFixed(4) ?? ''),
                  String(r.fleet_power_kw?.[i]?.toFixed(2) ?? ''),
                  ...r.vehicles.map(v => String(v.schedule_kw[i]?.toFixed(2) ?? '')),
                ]);
                downloadCsv('ladeoptimierung.csv', [header, ...rows]);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0079C0] rounded hover:bg-[#005fa3]"
          >
            <LayoutDashboard className="w-4 h-4" /> Fertig
          </button>
        </div>
      </div>

      {/* Info row — metadata from the latest run */}
      {latestData && (
        <div className="bg-white rounded border border-slate-200 px-5 py-3 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-500">Datum: </span>
            <span className="font-medium text-[#001141]">{latestData.optimization_date ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Zone: </span>
            <span className="font-medium text-slate-900">{latestData.bidding_zone ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">GCP: </span>
            <span className="font-medium text-slate-900">{latestData.gcp_max_kw ?? '—'} kW</span>
          </div>
          {latestData.completed_at && (
            <div>
              <span className="text-slate-500">Berechnet: </span>
              <span className="font-medium text-slate-900">
                {new Date(latestData.completed_at).toLocaleString('de-DE')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded border border-slate-200 p-12 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#043F2E] animate-spin" />
          <p className="text-sm text-slate-600 font-medium">LP-Optimierung wird berechnet...</p>
          <p className="text-xs text-slate-400">ENTSO-E Day-Ahead Preise werden abgerufen und der Ladeplan optimiert.</p>
        </div>
      )}

      {/* Error / Infeasible */}
      {!isLoading && isError && (
        <div className="bg-red-50 border border-red-200 rounded p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Optimierung fehlgeschlagen</p>
            <p className="text-xs text-red-600 mt-1">{latestData?.results?.status === 'error' ? 'Interner Fehler beim LP-Solver.' : (latestQuery.data as { error_message?: string })?.error_message || 'Unbekannter Fehler.'}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && isInfeasible && (
        <div className="bg-amber-50 border border-amber-200 rounded p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Kein machbarer Ladeplan gefunden (Infeasible)</p>
            <p className="text-xs text-amber-700 mt-1">
              Das Optimierungsproblem hat keine Lösung. Mögliche Ursachen:
            </p>
            <ul className="text-xs text-amber-700 mt-1 list-disc list-inside space-y-0.5">
              <li>Der Netzanschluss (GCP) ist zu klein für alle Fahrzeuge gleichzeitig.</li>
              <li>Die Ladezeit zwischen Ankunft und Abfahrt reicht nicht aus, um das SOC-Ziel zu erreichen.</li>
              <li>Die Wallbox-Leistung ist zu gering.</li>
            </ul>
            <p className="text-xs text-amber-700 mt-2">
              Erhöhen Sie den Netzanschluss, die Wallbox-Leistung oder senken Sie das SOC-Ziel.
            </p>
          </div>
        </div>
      )}

      {/* SOC arrival warning */}
      {!isLoading && socArrivalWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">SOC-Warnung: Ankunft unter Minimum</p>
            <p className="text-xs text-amber-700 mt-1">{socArrivalWarning}</p>
            {socArrivalPct !== null && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                Verwendeter Ankunfts-SOC für die Optimierung: {socArrivalPct.toFixed(1)} %
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && isOptimal && (results || isPeriod) && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Gesamtkosten"
              value={`${isPeriod ? periodTotals?.total_cost_eur?.toFixed(2) : results!.total_cost_eur.toFixed(2)} €`}
              sub={isPeriod ? `${periodTotals?.days_count} Tage` : `für ${latestData?.optimization_date ?? '—'}`}
              icon={DollarSign}
              color="green"
            />
            <KpiCard
              label="Gesamtenergie"
              value={`${isPeriod ? periodTotals?.total_energy_kwh?.toFixed(1) : results!.total_energy_kwh.toFixed(1)} kWh`}
              sub={isPeriod ? 'Gesamter Zeitraum' : `${results!.vehicles.length} Fahrzeuge`}
              icon={Zap}
              color="blue"
            />
            <KpiCard
              label="Ø Preis"
              value={(() => {
                const cost = isPeriod ? periodTotals?.total_cost_eur : results!.total_cost_eur;
                const energy = isPeriod ? periodTotals?.total_energy_kwh : results!.total_energy_kwh;
                return `${energy > 0 ? ((cost / energy) * 100).toFixed(1) : '0'} ct/kWh`;
              })()}
              sub="Durchschnittlicher Ladepreis"
              icon={TrendingDown}
              color="amber"
            />
            <KpiCard
              label={isPeriod ? 'Tage analysiert' : 'Berechnungszeit'}
              value={isPeriod ? `${periodTotals?.days_count}` : `${results!.computation_time_ms} ms`}
              sub={isPeriod ? 'Mehrtägiger Zeitraum' : 'LP-Solver Laufzeit'}
              icon={Clock}
              color="purple"
            />
          </div>

          {/* Multi-day overview: daily cost bar chart */}
          {isPeriod && periodDays.length > 0 && (
            <div className="bg-white rounded border border-slate-200 p-6">
              <h2 className="text-sm font-normal text-[#001141] mb-4">Tagesübersicht – Ladekosten</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={periodDays} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" €" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} €`, 'Ladekosten']} />
                  <Bar dataKey="total_cost_eur" fill="#16a34a" name="Ladekosten" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed charts — shown in both single-day and period mode */}
          <div className="bg-white rounded border border-slate-200 p-6">
            <h2 className="text-sm font-normal text-[#001141] mb-4">Strompreise & Flotten-Ladeplan</h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={isPeriod ? allPriceFleetData : priceFleetData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={isPeriod ? xTickFormatter : (v, i) => i % 4 === 0 ? v : ''}
                  interval={isPeriod ? 95 : 3}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit=" kW" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit=" ct" tickFormatter={(v) => (v * 100).toFixed(1)} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'fleet_kw') return [`${value.toFixed(1)} kW`, 'Flotten-Leistung'];
                    if (name === 'price_eurkwh') return [`${(value * 100).toFixed(2)} ct/kWh`, 'Strompreis'];
                    return [value, name];
                  }}
                />
                <Legend
                  formatter={(value) => value === 'fleet_kw' ? 'Flotten-Leistung [kW]' : 'Strompreis [ct/kWh]'}
                />
                <Bar yAxisId="left" dataKey="fleet_kw" fill="#16a34a" opacity={0.8} name="fleet_kw" />
                <Line yAxisId="right" type="monotone" dataKey="price_eurkwh" stroke="#f59e0b" strokeWidth={2} dot={false} name="price_eurkwh" />
                <Brush dataKey="time" height={20} stroke="#94a3b8" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Gantt: Ankunft & Abfahrt */}
          {!isPeriod && results?.vehicles && results.vehicles.length > 0 && (() => {
            const ROW_H = 20; const LABEL_W = 80; const BAR_W = 860;
            const TICK_H = 20; const VB_W = LABEL_W + BAR_W;
            const n = results.vehicles.length; const VB_H = TICK_H + n * ROW_H + 4;
            const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
            const slotX = (s: number) => LABEL_W + (s / 96) * BAR_W;
            const slotToTime = (s: number) => {
              const m = s * 15;
              return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
            };
            return (
              <div className="bg-white rounded border border-slate-200 p-6">
                <h2 className="text-sm font-normal text-[#001141] mb-3">Ankunft &amp; Abfahrt je Fahrzeug (Ladefenster)</h2>
                <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }} preserveAspectRatio="none">
                  <rect x={0} y={0} width={VB_W} height={VB_H} fill="#f8fafc" rx={4} />
                  {HOURS.map(h => {
                    const x = LABEL_W + (h / 24) * BAR_W;
                    return (
                      <g key={h}>
                        <line x1={x} y1={TICK_H} x2={x} y2={VB_H} stroke="#e2e8f0" strokeWidth={0.8} />
                        <text x={x} y={TICK_H - 4} textAnchor="middle" fontSize={8} fill="#94a3b8">{String(h).padStart(2,'0')}:00</text>
                      </g>
                    );
                  })}
                  {results.vehicles.map((vr, ri) => {
                    const y       = TICK_H + ri * ROW_H;
                    const arr     = vr.arrival_interval   ?? 68; // ~17:00 fallback
                    // Use raw departure (0-95) so overnight vehicles show correct time (e.g. 06:00 not 96)
                    const depEff  = vr.departure_interval_raw ?? (vr.departure_interval ?? 28);
                    const overnight = depEff <= arr;
                    const segs    = overnight
                      ? [{ from: arr, to: 96 }, { from: 0, to: depEff }]
                      : [{ from: arr, to: depEff > arr ? depEff : arr + 1 }];
                    const color   = VEHICLE_COLORS[ri % VEHICLE_COLORS.length];
                    return (
                      <g key={vr.vehicle_id}>
                        <rect x={0} y={y} width={VB_W} height={ROW_H} fill={ri % 2 === 0 ? '#f8fafc' : '#f1f5f9'} />
                        <text x={4} y={y + ROW_H / 2 + 3} fontSize={9} fill="#64748b">{vr.vehicle_name}</text>
                        {segs.map((seg, si) => (
                          <rect key={si} x={slotX(seg.from)} y={y + 4}
                            width={slotX(seg.to) - slotX(seg.from)} height={ROW_H - 8}
                            fill={color} opacity={0.72} rx={2} />
                        ))}
                        <line x1={slotX(arr)} y1={y + 2} x2={slotX(arr)} y2={y + ROW_H - 2} stroke="#0f172a" strokeWidth={1.5} />
                        <text x={slotX(arr)} y={y + 10} textAnchor="middle" fontSize={7} fill="#0f172a">↓{slotToTime(arr)}</text>
                        <line x1={slotX(depEff)} y1={y + 2} x2={slotX(depEff)} y2={y + ROW_H - 2} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 2" />
                        <text x={slotX(depEff)} y={y + 10} textAnchor="middle" fontSize={7} fill="#dc2626">↑{slotToTime(depEff)}{overnight ? ' (+1T)' : ''}</text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1.5"><svg width="14" height="8"><rect x={0} y={1} width={14} height={6} fill="#2563eb" opacity={0.7} rx={1}/></svg>Ladefenster</span>
                  <span className="flex items-center gap-1.5"><svg width="10" height="10"><line x1={5} y1={0} x2={5} y2={10} stroke="#0f172a" strokeWidth={1.5}/></svg>Ankunft ↓</span>
                  <span className="flex items-center gap-1.5"><svg width="10" height="10"><line x1={5} y1={0} x2={5} y2={10} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 2"/></svg>Abfahrt ↑</span>
                </div>
              </div>
            );
          })()}

          {/* Per-vehicle charging schedule */}
          {(isPeriod ? periodVehicleNames.length > 0 : results?.vehicles && results.vehicles.length > 0) && (
            <div className="bg-white rounded border border-slate-200 p-6">
              <h2 className="text-sm font-normal text-[#001141] mb-4">Ladeplan je Fahrzeug [kW]</h2>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={isPeriod ? allScheduleData : scheduleData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    tickFormatter={isPeriod ? xTickFormatter : (v, i) => i % 4 === 0 ? v : ''}
                    interval={isPeriod ? 95 : 3}
                  />
                  <YAxis tick={{ fontSize: 10 }} unit=" kW" />
                  <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)} kW`, name]} />
                  <Legend />
                  {(isPeriod ? periodVehicleNames : results!.vehicles.map(v => v.vehicle_name)).map((name, idx) => (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stackId="1"
                      stroke={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                      fill={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                      fillOpacity={0.5}
                      dot={false}
                    />
                  ))}
                  <Brush dataKey="time" height={20} stroke="#94a3b8" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* SOC curves */}
          {(isPeriod ? periodVehicleNames.length > 0 : results?.vehicles && results.vehicles.length > 0) && (
            <div className="bg-white rounded border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-sm font-normal text-[#001141]">SOC-Verlauf je Fahrzeug [%]</h2>
                {/* Vehicle filter chips */}
                {!isPeriod && results && results.vehicles.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedVehicles(null)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${selectedVehicles === null ? 'bg-[#001141] text-white border-[#001141]' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'}`}
                    >
                      Alle
                    </button>
                    {results.vehicles.map((vr, idx) => {
                      const isSelected = selectedVehicles?.has(vr.vehicle_name) ?? false;
                      return (
                        <button
                          key={vr.vehicle_name}
                          onClick={() => {
                            setSelectedVehicles(prev => {
                              const base = prev ?? new Set(results.vehicles.map(v => v.vehicle_name));
                              const next = new Set(base);
                              if (next.has(vr.vehicle_name)) { next.delete(vr.vehicle_name); }
                              else { next.add(vr.vehicle_name); }
                              return next.size === results.vehicles.length ? null : next;
                            });
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors`}
                          style={{
                            backgroundColor: (selectedVehicles === null || isSelected) ? VEHICLE_COLORS[idx % VEHICLE_COLORS.length] + '22' : 'white',
                            borderColor: VEHICLE_COLORS[idx % VEHICLE_COLORS.length],
                            color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length],
                          }}
                        >
                          {vr.vehicle_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={isPeriod ? allSocData : socData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    tickFormatter={isPeriod ? xTickFormatter : (v, i) => i % 4 === 0 ? v : ''}
                    interval={isPeriod ? 96 : 3}
                  />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} />
                  <ReferenceLine y={socTarget} stroke="#dc2626" strokeDasharray="4 2" label={{ value: `Ziel ${socTarget}%`, fontSize: 10, fill: '#dc2626' }} />
                  <ReferenceLine y={socMin} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Min ${socMin}%`, fontSize: 10, fill: '#f59e0b' }} />
                  {(isPeriod ? periodVehicleNames : results!.vehicles.map(v => v.vehicle_name))
                    .filter(name => selectedVehicles === null || selectedVehicles.has(name))
                    .map((name, idx) => (
                      <Line key={name} type="monotone" dataKey={name}
                        stroke={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                        strokeWidth={2} dot={false} />
                    ))}
                  <Brush dataKey="time" height={20} stroke="#94a3b8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Kostenvergleich: Optimiert vs Sofortladen (single day) ────────── */}
          {!isPeriod && results && naiveCost > 0 && (
            <div className="bg-white rounded border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-normal text-[#001141] flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#043F2E]" />
                  Kostenvergleich: Optimiert vs. Sofortladen
                </h2>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#e8f5f0] border border-[#043F2E]/20 rounded">
                  <TrendingDown className="w-3.5 h-3.5 text-[#043F2E]" />
                  <span className="text-xs font-semibold text-[#043F2E]">
                    Ersparnis: {savingsEur.toFixed(3)} € ({savingsPct.toFixed(1)} %)
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={kostenvergleichData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }} barSize={60}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" €" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(3)} €`, 'Ladekosten']} />
                  <Bar dataKey="cost" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11, formatter: (v: number) => `${v.toFixed(3)} €` }}>
                    {kostenvergleichData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── GCP-Auslastung: Optimiert vs Sofortladen ────────────────────── */}
          {!isPeriod && results && (
            <div className="bg-white rounded border border-slate-200 p-6">
              <h2 className="text-sm font-normal text-[#001141] mb-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#0079C0]" />
                GCP-Auslastung: Optimiert vs. Sofortladen
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Grün = LP-optimierter Plan · Grau = Sofortladen · Rote Linie = GCP-Limit ({latestData?.gcp_max_kw} kW)
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={priceFleetData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickFormatter={(v, i) => i % 4 === 0 ? v : ''} interval={3} />
                  <YAxis tick={{ fontSize: 10 }} unit=" kW" />
                  <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)} kW`, name === 'fleet_kw' ? 'Optimiert' : 'Sofortladen']} />
                  <Legend formatter={(v) => {
                    if (v === 'fleet_kw') return 'EV optimiert [kW]';
                    if (v === 'naive_kw') return 'Sofortladen [kW]';
                    if (v === 'depot_kw') return 'Depot-Last [kW]';
                    if (v === 'total_kw') return 'Gesamt (Depot+EV) [kW]';
                    return v;
                  }} />
                  <ReferenceLine y={latestData?.gcp_max_kw ?? 100} stroke="#dc2626" strokeDasharray="4 2" label={{ value: `GCP ${latestData?.gcp_max_kw ?? ''}kW`, fontSize: 10, fill: '#dc2626' }} />
                  <Area type="monotone" dataKey="naive_kw" stroke="#94a3b8" fill="#e2e8f0" fillOpacity={0.6} dot={false} name="naive_kw" />
                  {hasDepot && <Area type="monotone" dataKey="depot_kw" stroke="#f59e0b" fill="#fef3c7" fillOpacity={0.5} dot={false} name="depot_kw" />}
                  <Area type="monotone" dataKey="fleet_kw" stroke="#16a34a" fill="#bbf7d0" fillOpacity={0.7} dot={false} name="fleet_kw" />
                  {hasDepot && <Line type="monotone" dataKey="total_kw" stroke="#dc2626" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="total_kw" />}
                  <Brush dataKey="time" height={20} stroke="#94a3b8" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Preishistogramm: Energie je Preisklasse ──────────────────────── */}
          {!isPeriod && priceHistData.length > 0 && (
            <div className="bg-white rounded border border-slate-200 p-6">
              <h2 className="text-sm font-normal text-[#001141] mb-1 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#C45600]" />
                Ladeenergie nach Preisklasse
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Zeigt in welchen Preisniveaus der Optimierer geladen hat — günstige Klassen sollten dominieren.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={priceHistData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="bin" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} unit=" kWh" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} kWh`, 'Geladene Energie']} />
                  <Bar dataKey="energy" radius={[4, 4, 0, 0]} name="energy">
                    {priceHistData.map((entry, i) => (
                      <Cell key={i} fill={entry.binVal < 10 ? '#16a34a' : entry.binVal < 20 ? '#65a30d' : entry.binVal < 30 ? '#f59e0b' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Wochenübersicht (nur Mehrtages-Modus) ────────────────────────── */}
          {isPeriod && weeklyData.length > 1 && (
            <div className="bg-white rounded border border-slate-200 p-6">
              <h2 className="text-sm font-normal text-[#001141] mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0079C0]" />
                Wochenübersicht – Ladekosten &amp; Energie
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={weeklyData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit=" €" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit=" kWh" />
                  <Tooltip formatter={(v: number, name: string) => [
                    name === 'cost' ? `${v.toFixed(2)} €` : `${v.toFixed(1)} kWh`,
                    name === 'cost' ? 'Ladekosten' : 'Energie'
                  ]} />
                  <Legend formatter={(v) => v === 'cost' ? 'Ladekosten [€]' : 'Energie [kWh]'} />
                  <Bar yAxisId="left" dataKey="cost" fill="#16a34a" radius={[4, 4, 0, 0]} name="cost" />
                  <Line yAxisId="right" type="monotone" dataKey="energy" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="energy" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Vehicle cost table — single day only */}
          {!isPeriod && results && (
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-normal text-[#001141]">Kosten je Fahrzeug</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-normal text-slate-500 uppercase tracking-wider">Fahrzeug</th>
                    <th className="text-right px-4 py-3 text-xs font-normal text-slate-500 uppercase tracking-wider">
                      <span title="Energie die aus dem Netz bezogen wird (inkl. Ladeverluste)">Netz [kWh] ⓘ</span>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-normal text-slate-500 uppercase tracking-wider">
                      <span title="Energie die in der Batterie gespeichert wird = Verbrauch der Route">Batterie [kWh] ⓘ</span>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-normal text-slate-500 uppercase tracking-wider">Kosten [€]</th>
                    <th className="text-right px-4 py-3 text-xs font-normal text-slate-500 uppercase tracking-wider">SOC Ankunft</th>
                    <th className="text-right px-6 py-3 text-xs font-normal text-slate-500 uppercase tracking-wider">SOC Ziel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.vehicles.map((vr: VehicleOptResult, idx) => (
                    <tr key={vr.vehicle_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900 flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] }}
                        />
                        {vr.vehicle_name}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{vr.energy_kwh.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {(vr.battery_energy_kwh ?? vr.energy_kwh * 0.92).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{vr.cost_eur.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {vr.soc_curve_pct[0]?.toFixed(0) ?? '—'}%
                      </td>
                      <td className="px-6 py-3 text-right text-[#043F2E] font-semibold">
                        {vr.soc_curve_pct[vr.soc_curve_pct.length - 1]?.toFixed(0) ?? '—'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-6 py-3 font-semibold text-[#001141]">Gesamt</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#001141]">{results.total_energy_kwh.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {results.vehicles.reduce((s, v) => s + (v.battery_energy_kwh ?? v.energy_kwh * 0.92), 0).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#043F2E]">{results.total_cost_eur.toFixed(3)} €</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !results && !isPeriod && (
        <div className="bg-white rounded border border-slate-200 p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-[#e8f5f0] flex items-center justify-center">
            <Zap className="w-7 h-7 text-[#043F2E]" />
          </div>
          <div>
            <p className="text-sm font-normal text-[#001141]">Noch keine Optimierung durchgeführt</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Schließe den Wizard ab (Schritt 6 – Ladestrategie) um die LP-Optimierung zu starten.
            </p>
          </div>
          {pid && (
            <button
              onClick={() => navigate(`/projekte/${pid}/wizard`)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#043F2E] rounded hover:bg-[#032d20] mt-2"
            >
              <Zap className="w-4 h-4" /> Zum Wizard – Optimierung starten
            </button>
          )}
        </div>
      )}
    </div>
  );
}
