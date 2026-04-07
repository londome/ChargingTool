import { useParams, useNavigate } from 'react-router-dom';
import {
  ComposedChart, AreaChart, LineChart,
  Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Battery, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, Loader2, RefreshCw, ArrowLeft,
} from 'lucide-react';
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

export default function ArbitrageResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeProject } = useProjectStore();
  const pid = projectId || activeProject?.id;

  const latestQuery = useArbitrageLatest(pid);

  const latestData = latestQuery.data;
  const results: ArbitrageRunResult | null = latestData?.results ?? null;
  const isLoading = latestData?.status === 'pending' || latestData?.status === 'running';
  const isError = latestData?.status === 'failed';
  const isInfeasible = results?.status === 'infeasible';
  const isOptimal = results?.status === 'optimal';

  // Chart 1: Price (bar) + Net grid power (line)
  const priceNetData = TIME_LABELS.map((time, i) => ({
    time,
    price_eurkwh: results?.prices_15min?.[i] ?? 0,
    net_grid_kw:  results?.net_grid_kw?.[i] ?? 0,
  }));

  // Chart 2: Charge / Discharge schedules (area, both positive)
  const scheduleData = TIME_LABELS.map((time, i) => ({
    time,
    charge_kw:    results?.schedule_charge_kw?.[i] ?? 0,
    discharge_kw: results?.schedule_discharge_kw?.[i] ?? 0,
  }));

  // Chart 3: SOC curve (97 points)
  const socData = Array.from({ length: 97 }, (_, i) => ({
    time:    i === 0 ? '00:00' : TIME_LABELS[i - 1],
    soc_pct: results?.soc_curve_pct?.[i] ?? 0,
  }));

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
        <button
          onClick={handleNewOptimization}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Neue Optimierung
        </button>
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
      {!isLoading && !isError && isOptimal && results && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Netto-Gewinn"
              value={`${results.net_profit_eur.toFixed(2)} €`}
              sub={`am ${latestData?.run_date ?? ''}`}
              icon={DollarSign}
              color="green"
            />
            <KpiCard
              label="Erlöse (V2G Einspeisung)"
              value={`${results.total_revenue_eur.toFixed(2)} €`}
              sub="Einspeisung ins Netz"
              icon={TrendingUp}
              color="blue"
            />
            <KpiCard
              label="Kosten (Ladung)"
              value={`${results.total_cost_eur.toFixed(2)} €`}
              sub="Bezug aus dem Netz"
              icon={TrendingDown}
              color="amber"
            />
            <KpiCard
              label="Zyklen"
              value={results.cycles.toFixed(2)}
              sub={`${results.computation_time_ms} ms Berechnungszeit`}
              icon={RefreshCw}
              color="purple"
            />
          </div>

          {/* Chart 1: Price + Net grid power */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Strompreise &amp; Netzleistung (+ Bezug / − V2G Einspeisung)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={priceNetData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v, i) => i % 4 === 0 ? v : ''}
                  interval={3}
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2: Charge / Discharge schedule */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Lade- und Entladeplan [kW]
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={scheduleData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v, i) => i % 4 === 0 ? v : ''}
                  interval={3}
                />
                <YAxis tick={{ fontSize: 10 }} unit=" kW" />
                <Tooltip formatter={(v: number, name: string) => [
                  `${v.toFixed(1)} kW`,
                  name === 'charge_kw' ? 'Ladeleistung' : 'V2G Entladeleistung',
                ]} />
                <Legend formatter={(value) =>
                  value === 'charge_kw' ? 'Ladeleistung [kW]' : 'V2G Entladeleistung [kW]'
                } />
                <Area
                  type="monotone"
                  dataKey="charge_kw"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.35}
                  dot={false}
                  name="charge_kw"
                />
                <Area
                  type="monotone"
                  dataKey="discharge_kw"
                  stroke="#ea580c"
                  fill="#ea580c"
                  fillOpacity={0.35}
                  dot={false}
                  name="discharge_kw"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 3: SOC curve */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">SOC-Verlauf [%]</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={socData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v, i) => i % 4 === 0 ? v : ''}
                  interval={3}
                />
                <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'SOC']} />
                <ReferenceLine
                  y={latestData?.results?.soc_curve_pct?.[0] ?? 0}
                  stroke="#94a3b8"
                  strokeDasharray="4 2"
                  label={{ value: 'Ankunft-SOC', fontSize: 10, fill: '#94a3b8' }}
                />
                <Line
                  type="monotone"
                  dataKey="soc_pct"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  name="soc_pct"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
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
                  <tr className="bg-slate-50">
                    <td className="px-6 py-3 font-semibold text-slate-900">Netto-Gewinn</td>
                    <td className={`px-6 py-3 text-right font-bold text-lg ${results.net_profit_eur >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {results.net_profit_eur >= 0 ? '+' : ''}{results.net_profit_eur.toFixed(3)} €/Tag
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
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
