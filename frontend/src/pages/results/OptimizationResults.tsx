import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ComposedChart, AreaChart, LineChart, BarChart,
  Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Brush,
} from 'recharts';
import { Zap, Clock, DollarSign, AlertTriangle, Loader2, TrendingDown, LayoutDashboard, Download } from 'lucide-react';
import { useRunOptimization, useOptimizationLatest, OptimizationRunResult, VehicleOptResult } from '@/lib/api';
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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
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

  // Pre-fill from wizard store (Step 3 Depot + Step 4)
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [biddingZone, setBiddingZone] = useState('DE_LU');
  const [gcpMaxKw, setGcpMaxKw] = useState(() => wizard.step3Depot.max_grid_connection_kw ?? 100);
  const [wallboxKw, setWallboxKw] = useState(() => wizard.step4.charging_power_kw ?? 22);
  const [arrivalTime, setArrivalTime] = useState('17:00');
  const [departureTime, setDepartureTime] = useState('07:00');
  const [socTarget, setSocTarget] = useState(() => wizard.step4.soc_target ?? 80);
  const [socMin, setSocMin] = useState(() => wizard.step4.soc_min ?? 20);
  const [isRunning, setIsRunning] = useState(false);

  const runOpt = useRunOptimization();
  const pid = projectId || activeProject?.id;
  const latestQuery = useOptimizationLatest(pid);

  // Poll status until completed
  useEffect(() => {
    const status = latestQuery.data?.status;
    if (status === 'completed' || status === 'failed') {
      setIsRunning(false);
    }
  }, [latestQuery.data?.status]);

  const handleRun = async () => {
    if (!pid) return;
    setIsRunning(true);
    try {
      await runOpt.mutateAsync({
        project_id: pid,
        date,
        bidding_zone: biddingZone,
        gcp_max_kw: gcpMaxKw,
        wallbox_power_kw: wallboxKw,
        soc_target_pct: socTarget,
        soc_min_pct: socMin,
        arrival_time: arrivalTime,
        departure_time: departureTime,
      });
      latestQuery.refetch();
    } catch (e) {
      console.error('Optimization failed:', e);
      setIsRunning(false);
    }
  };

  const latestData = latestQuery.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawResults: any = latestData?.results ?? null;
  const isPeriod = rawResults?.type === 'period';
  const results: OptimizationRunResult | null = isPeriod ? null : (rawResults as OptimizationRunResult | null);
  const periodTotals = isPeriod ? rawResults?.totals : null;
  const periodDays: { date: string; total_cost_eur: number; total_energy_kwh: number }[] = isPeriod ? (rawResults?.days ?? []) : [];
  const isLoading = isRunning || latestData?.status === 'pending' || latestData?.status === 'running';
  const isError = latestData?.status === 'failed';
  const isInfeasible = results?.status === 'infeasible';
  const isOptimal = results?.status === 'optimal' || isPeriod;

  // Build chart data for price + fleet power
  const priceFleetData = TIME_LABELS.map((time, i) => ({
    time,
    price_eurkwh: results?.prices_15min?.[i] ?? 0,
    fleet_kw: results?.fleet_power_kw?.[i] ?? 0,
  }));

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
          <h1 className="text-2xl font-bold text-slate-900">Ladeprozess Optimierung</h1>
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <LayoutDashboard className="w-4 h-4" /> Fertig
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Optimierungsparameter</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Bidding zone */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Strommarktzone</label>
            <select
              value={biddingZone}
              onChange={(e) => setBiddingZone(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(BIDDING_ZONES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* GCP max */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Max. Netzanschluss [kW]</label>
            <input
              type="number"
              value={gcpMaxKw}
              min={1}
              onChange={(e) => setGcpMaxKw(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Wallbox power */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Wallbox-Leistung [kW]</label>
            <input
              type="number"
              value={wallboxKw}
              min={1}
              onChange={(e) => setWallboxKw(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Arrival time */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ankunft Depot</label>
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Departure time (next day) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Abfahrt (nächster Tag)</label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* SOC target */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">SOC Ziel [%]</label>
            <input
              type="number"
              value={socTarget}
              min={0}
              max={100}
              onChange={(e) => setSocTarget(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* SOC min */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">SOC Minimum [%]</label>
            <input
              type="number"
              value={socMin}
              min={0}
              max={100}
              onChange={(e) => setSocMin(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleRun}
            disabled={isRunning || !pid}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Optimierung läuft...</>
            ) : (
              <><Zap className="w-4 h-4" /> Optimierung starten</>
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
          <p className="text-sm text-slate-600 font-medium">LP-Optimierung wird berechnet...</p>
          <p className="text-xs text-slate-400">ENTSO-E Day-Ahead Preise werden abgerufen und der Ladeplan optimiert.</p>
        </div>
      )}

      {/* Error / Infeasible */}
      {!isLoading && isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Optimierung fehlgeschlagen</p>
            <p className="text-xs text-red-600 mt-1">{latestData?.results?.status === 'error' ? 'Interner Fehler beim LP-Solver.' : (latestQuery.data as { error_message?: string })?.error_message || 'Unbekannter Fehler.'}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && isInfeasible && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
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

      {/* Results */}
      {!isLoading && !isError && isOptimal && (results || isPeriod) && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Gesamtkosten"
              value={`${isPeriod ? periodTotals?.total_cost_eur?.toFixed(2) : results!.total_cost_eur.toFixed(2)} €`}
              sub={isPeriod ? `${periodTotals?.days_count} Tage` : `für ${latestData?.optimization_date ?? date}`}
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
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Tagesübersicht – Ladekosten</h2>
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
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Strompreise & Flotten-Ladeplan</h2>
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
                <Bar yAxisId="right" dataKey="price_eurkwh" fill="#fde68a" opacity={0.7} name="price_eurkwh" />
                <Line yAxisId="left" type="monotone" dataKey="fleet_kw" stroke="#16a34a" strokeWidth={2} dot={false} name="fleet_kw" />
                <Brush dataKey="time" height={20} stroke="#94a3b8" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Per-vehicle charging schedule */}
          {(isPeriod ? periodVehicleNames.length > 0 : results?.vehicles && results.vehicles.length > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Ladeplan je Fahrzeug [kW]</h2>
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
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">SOC-Verlauf je Fahrzeug [%]</h2>
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
                  <Legend />
                  <ReferenceLine y={socTarget} stroke="#dc2626" strokeDasharray="4 2" label={{ value: `Ziel ${socTarget}%`, fontSize: 10, fill: '#dc2626' }} />
                  <ReferenceLine y={socMin} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Min ${socMin}%`, fontSize: 10, fill: '#f59e0b' }} />
                  {(isPeriod ? periodVehicleNames : results!.vehicles.map(v => v.vehicle_name)).map((name, idx) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={VEHICLE_COLORS[idx % VEHICLE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  <Brush dataKey="time" height={20} stroke="#94a3b8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Vehicle cost table — single day only */}
          {!isPeriod && results && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Kosten je Fahrzeug</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fahrzeug</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Energie [kWh]</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kosten [€]</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SOC Ankunft</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SOC Ziel</th>
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
                      <td className="px-4 py-3 text-right text-slate-700">{vr.cost_eur.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {vr.soc_curve_pct[0]?.toFixed(0) ?? '—'}%
                      </td>
                      <td className="px-6 py-3 text-right text-green-700 font-semibold">
                        {vr.soc_curve_pct[vr.soc_curve_pct.length - 1]?.toFixed(0) ?? '—'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-6 py-3 font-semibold text-slate-700">Gesamt</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{results.total_energy_kwh.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{results.total_cost_eur.toFixed(3)} €</td>
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
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <Zap className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Noch keine Optimierung durchgeführt</p>
            <p className="text-xs text-slate-400 mt-1">
              Wählen Sie Parameter oben und klicken Sie auf "Optimierung starten".
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
