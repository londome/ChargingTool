import { useParams, useNavigate } from 'react-router-dom';
import {
  ComposedChart, AreaChart, LineChart, BarChart,
  Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Brush,
} from 'recharts';
import {
  Battery, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, Loader2, RefreshCw, ArrowLeft, LayoutDashboard, Download, Activity, BarChart2,
} from 'lucide-react';
import { Cell } from 'recharts';
import { useArbitrageLatest, ArbitrageRunResult } from '@/lib/api';
import { useProjectStore } from '@/store/projectStore';

function formatTime(intervalIdx: number): string {
  const totalMinutes = intervalIdx * 15;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const TIME_LABELS = Array.from({ length: 96 }, (_, i) => formatTime(i));

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

function KpiCard({ label, value, sub, icon: Icon, color = 'blue' }: KpiCardProps) {
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${colorMap[color]}`}>
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

export default function ArbitrageResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeProject } = useProjectStore();
  const pid = projectId || activeProject?.id;

  const latestQuery = useArbitrageLatest(pid);

  const latestData = latestQuery.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawResults: any = latestData?.results ?? null;
  const isPeriod = rawResults?.type === 'period';
  const results: ArbitrageRunResult | null = isPeriod ? null : (rawResults as ArbitrageRunResult | null);
  const periodTotals = isPeriod ? rawResults?.totals : null;
  const periodDays: { date: string; net_profit_eur: number; total_revenue_eur: number; total_cost_eur: number }[] = isPeriod ? (rawResults?.days ?? []) : [];
  const isLoading = latestData?.status === 'pending' || latestData?.status === 'running';
  const isError = latestData?.status === 'failed';
  const isInfeasible = results?.status === 'infeasible';
  const isOptimal = results?.status === 'optimal' || isPeriod;

  // Chart 1: Price (bar) + Net grid power (line)
  const priceNetData = TIME_LABELS.map((time, i) => ({
    time,
    price_eurkwh: results?.prices_15min?.[i] ?? 0,
    net_grid_kw:  results?.net_grid_kw?.[i] ?? 0,
  }));

  // For period mode: flatten price + net grid power for all days
  const allPriceNetData = isPeriod
    ? periodDays.flatMap((day: any) =>
        Array.from({ length: 96 }, (_, i) => ({
          time: `${day.date} ${formatTime(i)}`,
          price_eurkwh: day.prices_15min?.[i] ?? 0,
          net_grid_kw:  day.net_grid_kw?.[i] ?? 0,
        }))
      )
    : priceNetData;

  // Chart 2: Charge / Discharge schedules (area, both positive)
  const scheduleData = TIME_LABELS.map((time, i) => ({
    time,
    charge_kw:     results?.schedule_charge_kw?.[i] ?? 0,
    discharge_kw:  results?.schedule_discharge_kw?.[i] ?? 0,
    reference_kw:  results?.reference_charge_kw?.[i] ?? 0,
  }));

  // For period mode: flatten charge/discharge schedule for all days
  const allScheduleData = isPeriod
    ? periodDays.flatMap((day: any) =>
        Array.from({ length: 96 }, (_, i) => ({
          time:          `${day.date} ${formatTime(i)}`,
          charge_kw:     day.schedule_charge_kw?.[i] ?? 0,
          discharge_kw:  day.schedule_discharge_kw?.[i] ?? 0,
          reference_kw:  day.reference_charge_kw?.[i] ?? 0,
        }))
      )
    : scheduleData;

  // Chart 3: SOC curve (97 points) — V2G + reference
  const socData = Array.from({ length: 97 }, (_, i) => ({
    time:      i === 0 ? '00:00' : TIME_LABELS[i - 1],
    soc_pct:   results?.soc_curve_pct?.[i] ?? 0,
    soc_ref:   results?.reference_soc_curve_pct?.[i] ?? 0,
  }));

  // For period mode: flatten SOC curve for all days
  const allSocData = isPeriod
    ? periodDays.flatMap((day: any) =>
        Array.from({ length: 97 }, (_, i) => ({
          time:    i === 0 ? `${day.date} 00:00` : `${day.date} ${formatTime(i - 1)}`,
          soc_pct: day.soc_curve_pct?.[i] ?? 0,
          soc_ref: day.reference_soc_curve_pct?.[i] ?? 0,
        }))
      )
    : socData;

  // X-axis tick formatter: in period mode only show date label at first interval of each day
  const xTickFormatter = isPeriod
    ? (value: string, index: number) => index % 96 === 0 ? value.split(' ')[0] : ''
    : (value: string) => value;

  // ── New analytics data ──────────────────────────────────────────────────────

  // Einnahmen vs Ausgaben (waterfall-style grouped bar)
  const chargeOnlyCost = results?.charge_only_cost_eur ?? 0;
  const v2gSavings = chargeOnlyCost > 0 ? chargeOnlyCost - (results?.total_cost_eur ?? 0) + (results?.total_revenue_eur ?? 0) : 0;
  const finanzData = [
    { name: 'Nur-Laden\n(Referenz)', value: chargeOnlyCost, fill: '#94a3b8' },
    { name: 'Ladekosten\n(V2G)', value: results?.total_cost_eur ?? 0, fill: '#ef4444' },
    { name: 'V2G-Erlöse', value: results?.total_revenue_eur ?? 0, fill: '#16a34a' },
    { name: 'Netto-Gewinn', value: results?.net_profit_eur ?? 0, fill: (results?.net_profit_eur ?? 0) >= 0 ? '#2563eb' : '#f59e0b' },
  ];

  // Arbitrage-Spread: price chart colored by charge/discharge action
  const spreadData = TIME_LABELS.map((time, i) => ({
    time,
    price_ct: (results?.prices_15min?.[i] ?? 0) * 100,
    charge_kw: results?.schedule_charge_kw?.[i] ?? 0,
    discharge_kw: results?.schedule_discharge_kw?.[i] ?? 0,
    action: (results?.schedule_discharge_kw?.[i] ?? 0) > 0.01 ? 'discharge'
          : (results?.schedule_charge_kw?.[i] ?? 0) > 0.01 ? 'charge'
          : 'idle',
  }));

  // Cycles per day (period mode)
  const cyclesPerDay = isPeriod
    ? periodDays.map((d: any) => ({ date: d.date, cycles: d.cycles ?? 0 }))
    : [];

  // Annual projected cycles
  const annualCycles = results ? results.cycles * 250 : 0;

  const handleNewOptimization = () => {
    navigate(pid ? `/projekte/${pid}/wizard` : '/');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Energiearbitrage (V2G)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bidirektionale Ladeoptimierung der EV-Flotte mit ENTSO-E Day-Ahead Preisen
          </p>
        </div>
        <div className="flex gap-2">
          {isOptimal && (
            <button
              onClick={() => {
                const r = results!;
                const header = ['Zeit', 'Preis (€/kWh)', 'Netz (kW)', 'Laden (kW)', 'Entladen (kW)', 'SOC (%)'];
                const rows = Array.from({ length: 96 }, (_, i) => [
                  `${String(Math.floor(i * 15 / 60)).padStart(2,'0')}:${String((i * 15) % 60).padStart(2,'0')}`,
                  String(r.prices_15min?.[i]?.toFixed(4) ?? ''),
                  String(r.net_grid_kw?.[i]?.toFixed(2) ?? ''),
                  String(r.schedule_charge_kw?.[i]?.toFixed(2) ?? ''),
                  String(r.schedule_discharge_kw?.[i]?.toFixed(2) ?? ''),
                  String(r.soc_curve_pct?.[i]?.toFixed(1) ?? ''),
                ]);
                downloadCsv('arbitrage.csv', [header, ...rows]);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          <button
            onClick={handleNewOptimization}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Neue Optimierung
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <LayoutDashboard className="w-4 h-4" /> Fertig
          </button>
        </div>
      </div>

      {/* Info row */}
      {latestData && (
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-500">Datum: </span>
            <span className="font-medium text-slate-900">{latestData.run_date ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Marktzone: </span>
            <span className="font-medium text-slate-900">{latestData.bidding_zone ?? '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Netzanschluss: </span>
            <span className="font-medium text-slate-900">{latestData.gcp_max_kw ?? '—'} kW</span>
          </div>
          {latestData.completed_at && (
            <div>
              <span className="text-slate-500">Abgeschlossen: </span>
              <span className="font-medium text-slate-900">
                {new Date(latestData.completed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-14 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
          <p className="text-sm text-slate-700 font-medium">MILP-Optimierung läuft...</p>
          <p className="text-xs text-slate-400 text-center max-w-sm">
            Fahrzeugflotte wird optimiert. ENTSO-E Day-Ahead Preise werden abgerufen
            und die V2G-Arbitrage-Strategie berechnet.
          </p>
        </div>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Arbitrage-Berechnung fehlgeschlagen</p>
            <p className="text-xs text-red-600 mt-1">
              {(latestData as { error_message?: string } | undefined)?.error_message ||
                'Interner Fehler beim MILP-Solver.'}
            </p>
          </div>
        </div>
      )}

      {/* Infeasible */}
      {!isLoading && !isError && isInfeasible && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Keine machbare Lösung (Infeasible)</p>
            <p className="text-xs text-amber-700 mt-1">
              Die EV-Flotte kann mit den aktuellen Parametern keine V2G-Arbitrage durchführen.
              Mögliche Ursachen:
            </p>
            <ul className="text-xs text-amber-700 mt-1 list-disc list-inside space-y-0.5">
              <li>SOC-Grenzen zu eng (soc_min ≥ soc_target).</li>
              <li>Verfügbare Ladezeit zu kurz, um SOC-Ziel zu erreichen.</li>
              <li>Netzanschluss zu klein für die gewählte Wallbox-Leistung.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && isOptimal && (results || isPeriod) && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="V2G Mehrwert"
              value={`${isPeriod
                ? (periodTotals ? (periodTotals.charge_only_cost_eur ?? 0) - periodTotals.total_cost_eur + periodTotals.total_revenue_eur : 0).toFixed(2)
                : v2gSavings.toFixed(2)} €`}
              sub={v2gSavings >= 0 ? 'Ersparnis vs. Nur-Laden' : 'Mehrkosten vs. Nur-Laden'}
              icon={DollarSign}
              color={(!isPeriod && v2gSavings < 0) ? 'amber' : 'green'}
            />
            <KpiCard
              label="V2G Erlöse"
              value={`${isPeriod ? periodTotals?.total_revenue_eur?.toFixed(2) : results!.total_revenue_eur.toFixed(2)} €`}
              sub="Einspeisung ins Netz"
              icon={TrendingUp}
              color="blue"
            />
            <KpiCard
              label="Gesamtladekosten"
              value={`${isPeriod ? periodTotals?.total_cost_eur?.toFixed(2) : results!.total_cost_eur.toFixed(2)} €`}
              sub={!isPeriod && chargeOnlyCost > 0 ? `Ohne V2G: ${chargeOnlyCost.toFixed(2)} €` : 'Bezug aus dem Netz'}
              icon={TrendingDown}
              color="amber"
            />
            <KpiCard
              label={isPeriod ? 'Zyklen gesamt' : 'Zyklen'}
              value={isPeriod ? periodTotals?.total_cycles?.toFixed(2) : results!.cycles.toFixed(2)}
              sub={isPeriod ? 'Über den gesamten Zeitraum' : `${results!.computation_time_ms} ms Berechnungszeit`}
              icon={RefreshCw}
              color="purple"
            />
          </div>

          {/* Erklärungsbox: was bedeuten die Zahlen */}
          {!isPeriod && results && chargeOnlyCost > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-xs text-blue-800 flex flex-wrap gap-x-8 gap-y-1">
              <span>📦 <strong>Pflichtladung</strong> (ohne V2G nötig): <strong>{chargeOnlyCost.toFixed(3)} €</strong></span>
              <span>⚡ <strong>Geladene Energie</strong> (inkl. V2G-Puffer): <strong>{results.total_cost_eur.toFixed(3)} €</strong></span>
              <span>💰 <strong>V2G-Erlöse</strong>: <strong>+{results.total_revenue_eur.toFixed(3)} €</strong></span>
              <span className={v2gSavings >= 0 ? 'text-green-700 font-semibold' : 'text-amber-700 font-semibold'}>
                {v2gSavings >= 0 ? '✅' : '⚠️'} <strong>V2G-Entscheidung</strong>: {v2gSavings >= 0 ? 'spart' : 'kostet extra'} <strong>{Math.abs(v2gSavings).toFixed(3)} € vs. Nur-Laden</strong>
              </span>
            </div>
          )}

          {/* Multi-day overview: daily V2G benefit bar chart */}
          {isPeriod && periodDays.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Tagesübersicht – V2G Mehrwert vs. Nur-Laden</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={periodDays} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" €" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(3)} €`, 'V2G Mehrwert']} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar
                    dataKey={(d: any) => (d.charge_only_cost_eur ?? 0) - d.total_cost_eur + d.total_revenue_eur}
                    name="V2G Mehrwert"
                    radius={[4, 4, 0, 0]}
                    fill="#16a34a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Chart 1: Price + Net grid power — shown in both single-day and period mode */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Strompreise &amp; Netzleistung (+ Bezug / − V2G Einspeisung)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={isPeriod ? allPriceNetData : priceNetData} margin={{ top: 5, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={isPeriod ? xTickFormatter : (v, i) => i % 4 === 0 ? v : ''}
                  interval={isPeriod ? 95 : 3}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit=" kW" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  unit=" ct"
                  tickFormatter={(v) => (v * 100).toFixed(1)}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'net_grid_kw') return [`${value.toFixed(1)} kW`, 'Netzleistung'];
                    if (name === 'price_eurkwh') return [`${(value * 100).toFixed(2)} ct/kWh`, 'Strompreis'];
                    return [value, name];
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'net_grid_kw' ? 'Netzleistung [kW]' : 'Strompreis [ct/kWh]'
                  }
                />
                <Bar yAxisId="right" dataKey="price_eurkwh" fill="#fde68a" opacity={0.7} name="price_eurkwh" />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="net_grid_kw"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  name="net_grid_kw"
                />
                <Brush dataKey="time" height={20} stroke="#94a3b8" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2: Charge / Discharge schedule + Referenzplan */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">
              Lade- und Entladeplan [kW]
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Gestrichelte Linie = Referenzplan (Sofortladen ohne V2G)
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={isPeriod ? allScheduleData : scheduleData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={isPeriod ? xTickFormatter : (v, i) => i % 4 === 0 ? v : ''}
                  interval={isPeriod ? 95 : 3}
                />
                <YAxis tick={{ fontSize: 10 }} unit=" kW" />
                <Tooltip formatter={(v: number, name: string) => [
                  `${v.toFixed(1)} kW`,
                  name === 'charge_kw' ? 'V2G Laden' : name === 'discharge_kw' ? 'V2G Entladen' : 'Referenz Laden',
                ]} />
                <Legend formatter={(v) =>
                  v === 'charge_kw' ? 'V2G Laden [kW]' : v === 'discharge_kw' ? 'V2G Entladen [kW]' : 'Referenz Laden [kW]'
                } />
                <Area type="monotone" dataKey="charge_kw" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} dot={false} name="charge_kw" />
                <Area type="monotone" dataKey="discharge_kw" stroke="#ea580c" fill="#ea580c" fillOpacity={0.35} dot={false} name="discharge_kw" />
                <Line type="monotone" dataKey="reference_kw" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 3" dot={false} name="reference_kw" />
                <Brush dataKey="time" height={20} stroke="#94a3b8" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 3: SOC curve — V2G vs Referenz */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">SOC-Verlauf [%]</h2>
            <p className="text-xs text-slate-400 mb-4">
              Grün = V2G-optimierter Plan · Gestrichelt grau = Referenzplan (Sofortladen)
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={isPeriod ? allSocData : socData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={isPeriod ? xTickFormatter : (v, i) => i % 4 === 0 ? v : ''}
                  interval={isPeriod ? 96 : 3}
                />
                <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v: number, name: string) => [
                  `${v.toFixed(1)}%`,
                  name === 'soc_pct' ? 'SOC V2G' : 'SOC Referenz',
                ]} />
                <Legend formatter={(v) => v === 'soc_pct' ? 'SOC V2G [%]' : 'SOC Referenz [%]'} />
                {!isPeriod && (
                  <ReferenceLine
                    y={latestData?.results?.soc_curve_pct?.[0] ?? 0}
                    stroke="#cbd5e1"
                    strokeDasharray="4 2"
                    label={{ value: 'Ankunft-SOC', fontSize: 10, fill: '#94a3b8' }}
                  />
                )}
                <Line type="monotone" dataKey="soc_ref" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="soc_ref" />
                <Line type="monotone" dataKey="soc_pct" stroke="#16a34a" strokeWidth={2} dot={false} name="soc_pct" />
                <Brush dataKey="time" height={20} stroke="#94a3b8" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Vergleich: Nur-Laden vs V2G ──────────────────────────────────── */}
          {!isPeriod && results && chargeOnlyCost > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-purple-600" />
                  Vergleich: Nur-Laden vs. V2G Arbitrage
                </h2>
                {v2gSavings > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                    <TrendingDown className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">
                      V2G-Vorteil: +{v2gSavings.toFixed(3)} € ({chargeOnlyCost > 0 ? ((v2gSavings / chargeOnlyCost) * 100).toFixed(1) : 0} %)
                    </span>
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={finanzData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barSize={50}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" €" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(3)} €`]} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 10, formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)} €` }}>
                    {finanzData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Arbitrage-Spread: Preis gefärbt nach Aktion ──────────────────── */}
          {!isPeriod && results && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                Arbitrage-Spread: Lade- &amp; Entladezeitpunkte
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                🟦 Laden (günstiger Einkauf) · 🟧 V2G Einspeisung (teurer Verkauf) · Grau = inaktiv
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={spreadData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} tickFormatter={(v, i) => i % 4 === 0 ? v : ''} interval={3} />
                  <YAxis yAxisId="price" tick={{ fontSize: 10 }} unit=" ct" />
                  <YAxis yAxisId="power" orientation="right" tick={{ fontSize: 10 }} unit=" kW" />
                  <Tooltip formatter={(v: number, name: string) => [
                    name === 'price_ct' ? `${v.toFixed(2)} ct/kWh` : `${v.toFixed(1)} kW`,
                    name === 'price_ct' ? 'Strompreis' : name === 'charge_kw' ? 'Laden' : 'V2G',
                  ]} />
                  <Legend formatter={(v) => v === 'price_ct' ? 'Preis [ct/kWh]' : v === 'charge_kw' ? 'Laden [kW]' : 'V2G [kW]'} />
                  <Bar yAxisId="price" dataKey="price_ct" name="price_ct" radius={[2, 2, 0, 0]}>
                    {spreadData.map((entry, i) => (
                      <Cell key={i}
                        fill={entry.action === 'charge' ? '#bfdbfe' : entry.action === 'discharge' ? '#fed7aa' : '#f1f5f9'}
                        opacity={0.9}
                      />
                    ))}
                  </Bar>
                  <Line yAxisId="power" type="monotone" dataKey="charge_kw" stroke="#2563eb" strokeWidth={2} dot={false} name="charge_kw" />
                  <Line yAxisId="power" type="monotone" dataKey="discharge_kw" stroke="#ea580c" strokeWidth={2} dot={false} name="discharge_kw" />
                  <Brush dataKey="time" height={20} stroke="#94a3b8" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Batterie-Zyklen Analyse ───────────────────────────────────────── */}
          {!isPeriod && results && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-amber-600" />
                Batterie-Zyklen &amp; Degradationsindikator
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Zyklen heute</p>
                  <p className="text-xl font-bold text-slate-900">{results.cycles.toFixed(2)}</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Proj. Jahreszyklen</p>
                  <p className={`text-xl font-bold ${annualCycles > 500 ? 'text-red-600' : annualCycles > 300 ? 'text-amber-600' : 'text-green-600'}`}>
                    {annualCycles.toFixed(0)}
                  </p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Typisches Limit</p>
                  <p className="text-xl font-bold text-slate-400">500 / Jahr</p>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${annualCycles > 500 ? 'bg-red-500' : annualCycles > 300 ? 'bg-amber-400' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, (annualCycles / 500) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {annualCycles <= 300
                  ? '✅ Zyklenbelastung im unkritischen Bereich.'
                  : annualCycles <= 500
                  ? '⚠️ Moderate Zyklenbelastung – Degradation beobachten.'
                  : '🔴 Hohe Zyklenbelastung – Batterielebensdauer prüfen.'}
              </p>
            </div>
          )}

          {/* ── Tagesübersicht Zyklen (Mehrtages-Modus) ──────────────────────── */}
          {isPeriod && cyclesPerDay.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                Zyklen je Tag
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cyclesPerDay} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)}`, 'Zyklen']} />
                  <ReferenceLine y={1} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '1 Zyklus/Tag', fontSize: 10, fill: '#f59e0b' }} />
                  <Bar dataKey="cycles" name="Zyklen" radius={[4, 4, 0, 0]}>
                    {cyclesPerDay.map((_: any, i: number) => (
                      <Cell key={i} fill="#7c3aed" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary table — single day only */}
          {!isPeriod && results && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Ergebniszusammenfassung</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-600 font-medium">Datum</td>
                    <td className="px-6 py-3 text-right text-slate-900">{results.date}</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-600 font-medium">Geladene Energie</td>
                    <td className="px-6 py-3 text-right text-slate-900">
                      {results.schedule_charge_kw.reduce((s, p) => s + p * 0.25, 0).toFixed(1)} kWh
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-600 font-medium">Entladene Energie (V2G)</td>
                    <td className="px-6 py-3 text-right text-slate-900">
                      {results.schedule_discharge_kw.reduce((s, p) => s + p * 0.25, 0).toFixed(1)} kWh
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-600 font-medium">Ladekosten</td>
                    <td className="px-6 py-3 text-right text-red-600 font-medium">
                      −{results.total_cost_eur.toFixed(3)} €
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-600 font-medium">V2G Einspeisung-Erlöse</td>
                    <td className="px-6 py-3 text-right text-green-700 font-medium">
                      +{results.total_revenue_eur.toFixed(3)} €
                    </td>
                  </tr>
                  {chargeOnlyCost > 0 && (
                    <tr className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-600 font-medium">Ladekosten ohne V2G (Referenz)</td>
                      <td className="px-6 py-3 text-right text-slate-500">−{chargeOnlyCost.toFixed(3)} €</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50">
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      V2G Mehrwert
                      <span className="ml-2 text-xs font-normal text-slate-500">(vs. Nur-Laden)</span>
                    </td>
                    <td className={`px-6 py-3 text-right font-bold text-lg ${v2gSavings >= 0 ? 'text-green-700' : 'text-amber-600'}`}>
                      {v2gSavings >= 0 ? '+' : ''}{v2gSavings.toFixed(3)} €/Tag
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      )}

      {/* Empty state — no run exists yet */}
      {!isLoading && !isError && !latestData && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center">
            <Battery className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Noch keine Arbitrage-Berechnung vorhanden</p>
            <p className="text-xs text-slate-400 mt-1">
              Starten Sie eine Optimierung über den Wizard (Schritt 4).
            </p>
          </div>
          <button
            onClick={handleNewOptimization}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Zum Wizard
          </button>
        </div>
      )}
    </div>
  );
}
