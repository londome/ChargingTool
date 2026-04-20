import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, Download, RefreshCw, TrendingDown, Zap, Leaf, DollarSign,
  BarChart2, Building2, AlertTriangle, BatteryCharging, FileDown, ArrowUpDown,
} from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import {
  useSimulationStatus, useSimulationResults, useSimulationRuns,
  useRunSimulation, downloadExport,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import KPICard from '@/components/shared/KPICard';
import StatusBadge from '@/components/shared/StatusBadge';
import EVLastgangChart from '@/components/charts/EVLastgangChart';
import CostComparisonChart from '@/components/charts/CostComparisonChart';
import CO2ComparisonChart from '@/components/charts/CO2ComparisonChart';
import TCOComparisonChart from '@/components/charts/TCOComparisonChart';
import TourDistributionChart from '@/components/charts/TourDistributionChart';
import { formatCurrency, formatCO2, formatPercent, formatPayback, formatKWh, formatKW, formatNumber, formatDistance } from '@/lib/utils';
import type { SimulationRun, RouteResult } from '@shared/types';
import { FeasibilityStatus } from '@shared/types';

// ─── Section divider ─────────────────────────────────────────────────────────
function SectionHeader({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <div id={id} className="pt-2 scroll-mt-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-px flex-1 bg-slate-200" />
        <h2 className="text-lg font-light text-[#001141] whitespace-nowrap">{title}</h2>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      {subtitle && <p className="text-xs text-slate-400 text-center mb-4">{subtitle}</p>}
    </div>
  );
}

// ─── Single scenario results panel (Flottenergebnisse) ───────────────────────
function ScenarioResultsPanel({ runId, projectId, scenarioId }: {
  runId: string; projectId: string; scenarioId: string;
}) {
  const runSimulation = useRunSimulation();
  const { wizard, lastgangProfile } = useProjectStore();
  const { data: statusData } = useSimulationStatus(runId);
  const { data: results, isLoading } = useSimulationResults(
    statusData?.status === 'completed' ? runId : undefined
  );

  const summary = results?.summary;
  const isRunning = statusData?.status === 'running' || statusData?.status === 'pending';
  const routeResults = results?.route_results ?? [];
  const totalTours = routeResults.length;
  const electrifiableTours = routeResults.filter(r => r.feasible_without_charging || r.feasible_with_charging).length;

  const handleRerun = async () => {
    await runSimulation.mutateAsync({ project_id: projectId, scenario_id: scenarioId });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        {summary && (
          <>
            <Button variant="outline" size="sm" onClick={() => downloadExport(runId, 'xlsx')}>
              <Download className="h-4 w-4 mr-1" /> XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadExport(runId, 'csv')}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={handleRerun} disabled={isRunning || runSimulation.isPending}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isRunning ? 'animate-spin' : ''}`} />
          Neu berechnen
        </Button>
      </div>

      {isRunning && (
        <Alert variant="info">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="ml-2">Simulation läuft…</AlertDescription>
        </Alert>
      )}

      {statusData?.status === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>Fehler: {statusData.error_message}</AlertDescription>
        </Alert>
      )}

      {isLoading || isRunning ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded" />)}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Elektrifizierbar"
              value={formatPercent(summary.electrifiable_pct)}
              subtitle={totalTours > 0 ? `${electrifiableTours} von ${totalTours} Touren` : `${summary.electrifiable_count} von ${summary.total_vehicles} Fahrzeugen`}
              icon={Zap} color="blue"
              tooltip="Anteil der Touren, die mit einem geeigneten EV elektrifiziert werden können"
            />
            <KPICard
              title="CO₂-Einsparung"
              value={formatCO2(summary.co2e_savings_t)}
              subtitle={`${formatPercent(summary.co2e_savings_pct)} weniger als ICE`}
              icon={Leaf} color="green"
              tooltip="CO₂e-Einsparung = ICE − EV (jährlich)"
            />
            <KPICard
              title="TCO-Einsparung"
              value={formatCurrency(summary.tco_ice - summary.tco_ev)}
              subtitle="Lebenszeit-Gesamteinsparung"
              icon={DollarSign} color="green"
              tooltip="Gesamte TCO-Einsparung über die Fahrzeuglebensdauer"
            />
            <KPICard
              title="Amortisationszeit"
              value={formatPayback(summary.payback_years)}
              subtitle="Investitions-Payback"
              icon={TrendingDown} color="amber"
              tooltip="Zeit bis zur Amortisation der Mehrinvestition"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CostComparisonChart
              iceOpex={summary.opex_ice} evOpex={summary.opex_ev}
              iceFuelCost={summary.annual_fuel_cost_ice} evElecCost={summary.annual_electricity_cost_ev}
            />
            <CO2ComparisonChart iceT={summary.co2e_ice_t} evT={summary.co2e_ev_t} />
          </div>

          <TCOComparisonChart
            tcoIce={summary.tco_ice} tcoEv={summary.tco_ev}
            opexIce={summary.opex_ice} opexEv={summary.opex_ev}
            fuelCostIce={summary.annual_fuel_cost_ice}
            elecCostEv={summary.annual_electricity_cost_ev}
            infraCapex={results?.infrastructure?.infra_capex_total ?? 0}
          />
        </>
      ) : (
        <Alert variant="info">
          <AlertDescription>Keine Ergebnisse für dieses Szenario vorhanden.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Scenario comparison table ───────────────────────────────────────────────
function ScenarioComparisonPanel({ runs }: { runs: any[] }) {
  const completed = runs.filter(r => r.status === 'completed');
  if (completed.length === 0) {
    return (
      <Alert variant="info">
        <AlertDescription>Noch keine abgeschlossenen Simulationen zum Vergleich.</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-3 font-normal text-[#001141]">Szenario</th>
            <th className="text-right px-4 py-3 font-normal text-[#001141]">Elektrifizierbar</th>
            <th className="text-right px-4 py-3 font-normal text-[#001141]">CO₂-Einsparung</th>
            <th className="text-right px-4 py-3 font-normal text-[#001141]">TCO-Einsparung</th>
            <th className="text-right px-4 py-3 font-normal text-[#001141]">Amortisation</th>
          </tr>
        </thead>
        <tbody>
          {completed.map((run, i) => (
            <tr key={run.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-4 py-3 font-medium text-[#001141]">
                {run.scenario_name}
                <Badge variant="outline" className="ml-2 text-xs">{run.scenario_type}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-slate-700">
                {run.electrifiable_pct != null ? formatPercent(run.electrifiable_pct) : '–'}
              </td>
              <td className="px-4 py-3 text-right text-[#043F2E] font-medium">
                {run.co2e_savings_pct != null ? formatPercent(run.co2e_savings_pct) : '–'}
              </td>
              <td className="px-4 py-3 text-right text-[#043F2E] font-medium">
                {run.tco_savings != null ? formatCurrency(run.tco_savings) : '–'}
              </td>
              <td className="px-4 py-3 text-right text-slate-700">
                {run.payback_years != null ? formatPayback(run.payback_years) : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tourenanalyse section ────────────────────────────────────────────────────
type SortKey = 'distance_km' | 'fuel_cost' | 'ev_energy_kwh' | 'annual_cost_delta' | 'annual_co2e_delta_kg';
type SortDir = 'asc' | 'desc';

function TourenanalyseSection({ activeRunId }: { activeRunId: string | null }) {
  const { data: results, isLoading } = useSimulationResults(activeRunId ?? undefined);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'feasible' | 'charging' | 'not_feasible'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('distance_km');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const routes = results?.route_results || [];

  const getFeasibility = (r: RouteResult) =>
    r.feasible_without_charging ? FeasibilityStatus.FEASIBLE
    : r.feasible_with_charging ? FeasibilityStatus.FEASIBLE_WITH_CHARGING
    : FeasibilityStatus.NOT_FEASIBLE;

  const filtered = routes.filter(r => {
    const feas = getFeasibility(r);
    if (filter === 'feasible' && feas !== FeasibilityStatus.FEASIBLE) return false;
    if (filter === 'charging' && feas !== FeasibilityStatus.FEASIBLE_WITH_CHARGING) return false;
    if (filter === 'not_feasible' && feas !== FeasibilityStatus.NOT_FEASIBLE) return false;
    if (search && !r.route_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const aVal = a[sortKey] as number;
    const bVal = b[sortKey] as number;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ArrowUpDown className={`h-3 w-3 ml-1 inline ${sortKey === k ? 'text-[#0079C0]' : 'text-slate-300'}`} />
  );

  if (!activeRunId) {
    return (
      <Alert variant="info">
        <AlertDescription>Bitte wählen Sie oben ein Szenario aus.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">{routes.length} Touren analysiert</p>
        {activeRunId && (
          <Button variant="outline" size="sm" onClick={() => downloadExport(activeRunId, 'xlsx')}>
            <Download className="h-4 w-4 mr-1" /> Export XLSX
          </Button>
        )}
      </div>

      {routes.length > 0 && <TourDistributionChart routes={routes} />}

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Tour-ID suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Touren</SelectItem>
            <SelectItem value="feasible">Machbar (ohne Laden)</SelectItem>
            <SelectItem value="charging">Machbar mit Zwischenladen</SelectItem>
            <SelectItem value="not_feasible">Nicht machbar</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">{filtered.length} Touren</Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded" />
      ) : (
        <div className="bg-white border rounded overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tour-ID</TableHead>
                <TableHead>Machbarkeit</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('distance_km')}>
                  Distanz <SortIcon k="distance_km" />
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('fuel_cost')}>
                  Kraftstoffkosten <SortIcon k="fuel_cost" />
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('ev_energy_kwh')}>
                  EV-Energie <SortIcon k="ev_energy_kwh" />
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('annual_cost_delta')}>
                  Kostendelta/Jahr <SortIcon k="annual_cost_delta" />
                </TableHead>
                <TableHead className="text-right">CO₂-Delta/Jahr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.route_id}</TableCell>
                  <TableCell><StatusBadge status={getFeasibility(r)} /></TableCell>
                  <TableCell>{formatDistance(r.distance_km)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.fuel_cost)}</TableCell>
                  <TableCell className="text-right">{formatKWh(r.ev_energy_kwh)}</TableCell>
                  <TableCell className={`text-right font-medium ${r.annual_cost_delta < 0 ? 'text-[#043F2E]' : 'text-red-600'}`}>
                    {r.annual_cost_delta < 0 ? '' : '+'}{formatCurrency(r.annual_cost_delta)}
                  </TableCell>
                  <TableCell className={`text-right ${r.annual_co2e_delta_kg < 0 ? 'text-[#043F2E]' : 'text-red-600'}`}>
                    {r.annual_co2e_delta_kg < 0 ? '' : '+'}{(r.annual_co2e_delta_kg / 1000).toFixed(1)} t
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 100 && (
            <p className="text-xs text-slate-400 p-3 text-center">
              Zeige 100 von {filtered.length} Touren. Exportieren Sie für vollständige Daten.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Infrastruktur section ────────────────────────────────────────────────────
function InfrastrukturSection({ activeRunId }: { activeRunId: string | null }) {
  const { lastgangProfile, wizard } = useProjectStore();
  const { data: results, isLoading } = useSimulationResults(activeRunId ?? undefined);
  const infra = results?.infrastructure;

  if (!activeRunId) {
    return (
      <Alert variant="info">
        <AlertDescription>Bitte wählen Sie oben ein Szenario aus.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded" />)}
        </div>
      ) : infra ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Ladepunkte gesamt"
              value={formatNumber(infra.required_charger_count)}
              subtitle="Empfohlene Mindestanzahl"
              icon={BatteryCharging} color="blue"
              tooltip="N = ceil(Σ Ladezeit_i / (Ladefenster × Auslastungsziel))"
            />
            <KPICard
              title="Depot-Ladepunkte"
              value={formatNumber(infra.depot_chargers)}
              subtitle="AC-Lader im Depot"
              icon={Building2} color="blue"
            />
            <KPICard
              title="Täglicher Energiebedarf"
              value={formatKWh(infra.daily_energy_demand_kwh)}
              subtitle="Gesamtflotte"
              icon={Zap} color="amber"
            />
            <KPICard
              title="Ø Ladeleistung"
              value={formatKW(infra.avg_charging_power_kw)}
              subtitle={`${infra.charging_window_hours}h Ladefenster`}
              icon={Zap} color="green"
            />
          </div>

          {Array.isArray(infra.warnings) && infra.warnings.length > 0 && (
            <div className="space-y-2">
              {infra.warnings.map((w: string, i: number) => (
                <Alert key={i} variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{w}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Infrastrukturplanung – Detailansicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">EV-Fahrzeuge</span>
                    <span className="font-medium">{infra.total_ev_count}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Tagesbedarf gesamt</span>
                    <span className="font-medium">{formatKWh(infra.daily_energy_demand_kwh)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Bedarf je Fahrzeug</span>
                    <span className="font-medium">{formatKWh(Number(infra.daily_energy_demand_kwh) / Math.max(infra.total_ev_count, 1))}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Ladefenster</span>
                    <span className="font-medium">{infra.charging_window_hours} Stunden/Nacht</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Ladepunkte Depot</span>
                    <span className="font-medium">{infra.depot_chargers}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Öffentliche Ladepunkte</span>
                    <span className="font-medium">{infra.public_chargers}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Peak-Netzlast</span>
                    <span className="font-medium">{formatKW(Number(infra.required_charger_count) * Number(infra.avg_charging_power_kw))}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Ø Ladeleistung je LP</span>
                    <span className="font-medium">{formatKW(infra.avg_charging_power_kw)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[#e6f3fc] rounded text-xs text-[#0079C0]">
                <strong>Berechnungsformel:</strong>{' '}
                N_Ladepunkte = ⌈ Σ(E_EV_i / (P_Lader × η)) / (T_Fenster × Auslastungsziel) ⌉
                <br />
                Auslastungsziel: 80% · Ladefenster: 10h · Effizienz: {(0.92 * 100).toFixed(0)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Investitionskosten Ladeinfrastruktur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-slate-50 rounded">
                  <p className="text-2xl font-bold text-[#001141]">
                    {infra.infra_capex_total
                      ? `${Math.round(Number(infra.infra_capex_total) / Number(infra.required_charger_count) - Number(infra.installation_cost_per_point ?? 0)).toLocaleString('de-DE')} €`
                      : `${(Number(infra.depot_chargers) * 1200).toLocaleString('de-DE')} €`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{infra.required_charger_count}× Wallbox</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded">
                  <p className="text-2xl font-bold text-[#001141]">
                    {infra.installation_cost_per_point != null
                      ? `${(Number(infra.installation_cost_per_point) * Number(infra.required_charger_count)).toLocaleString('de-DE')} €`
                      : `~${(Number(infra.depot_chargers) * 3500).toLocaleString('de-DE')} €`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Installation</p>
                  {infra.installation_cost_per_point != null && (
                    <p className="text-xs text-[#0079C0] mt-0.5">{Number(infra.installation_cost_per_point).toLocaleString('de-DE')} €/LP</p>
                  )}
                </div>
                <div className="text-center p-3 bg-[#e6f3fc] rounded border border-[#0079C0]/30">
                  <p className="text-2xl font-bold text-[#001141]">
                    {infra.infra_capex_total
                      ? `${Math.round(Number(infra.infra_capex_total)).toLocaleString('de-DE')} €`
                      : `~${(Number(infra.depot_chargers) * 12000).toLocaleString('de-DE')} €`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Gesamt-Investition</p>
                  {infra.infra_capex_total && <p className="text-xs text-[#0079C0] mt-0.5">In TCO berücksichtigt</p>}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                * Investitionskosten sind im EV-TCO eingerechnet und beeinflussen die Amortisationszeit.
              </p>
            </CardContent>
          </Card>

          <EVLastgangChart
            routeResults={results?.route_results ?? []}
            vehicleResults={results?.vehicle_results ?? []}
            chargingPowerKw={infra?.avg_charging_power_kw ?? wizard.step4?.charging_power_kw ?? 22}
            chargingEfficiency={wizard.step4?.charging_efficiency ?? 0.92}
            socTarget={wizard.step4?.soc_target ?? 80}
            lastgangProfile={lastgangProfile}
          />
        </>
      ) : (
        <Alert variant="info">
          <AlertDescription>Keine Infrastrukturdaten verfügbar.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Main combined page ───────────────────────────────────────────────────────
export default function SimulationResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeRunId } = useProjectStore();

  const { data: allRuns = [], isLoading: runsLoading } = useSimulationRuns(projectId);
  const completedRuns = (allRuns as any[]).filter(r => r.status === 'completed');
  const pendingRuns = (allRuns as any[]).filter(r => r.status === 'pending' || r.status === 'running');

  const defaultTab = activeRunId && completedRuns.find((r: any) => r.id === activeRunId)
    ? activeRunId
    : completedRuns[0]?.id ?? 'compare';

  const [selectedTab, setSelectedTab] = useState(defaultTab);

  useEffect(() => {
    if (activeRunId && completedRuns.find((r: any) => r.id === activeRunId)) {
      setSelectedTab(activeRunId);
    }
  }, [activeRunId, completedRuns.length]);

  const handlePrintPDF = () => window.print();

  if (!projectId) return null;

  const selectedRunId = selectedTab !== 'compare' ? selectedTab : (completedRuns[0]?.id ?? null);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light text-[#001141]">Simulationsergebnisse</h1>
          <p className="text-sm text-slate-500 mt-1">Vollständige Analyse der Flottenelektrifizierung</p>
        </div>
        <button
          onClick={handlePrintPDF}
          className="no-print flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <FileDown className="h-4 w-4" />
          PDF-Export
        </button>
      </div>

      {runsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : pendingRuns.length > 0 && completedRuns.length === 0 ? (
        <Alert variant="info">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          <AlertDescription className="inline">
            {pendingRuns.length} Simulation{pendingRuns.length > 1 ? 'en laufen' : ' läuft'}… Ergebnisse erscheinen automatisch.
          </AlertDescription>
        </Alert>
      ) : completedRuns.length === 0 ? (
        <Alert variant="info">
          <AlertDescription>
            Keine Simulation vorhanden. Erstellen Sie zunächst ein Szenario und starten Sie eine Simulation.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Scenario selector tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="flex flex-wrap gap-1 h-auto">
              {completedRuns.map((run: any) => (
                <TabsTrigger key={run.id} value={run.id} className="text-xs">
                  {run.scenario_name}
                </TabsTrigger>
              ))}
              <TabsTrigger value="compare" className="text-xs flex items-center gap-1">
                <BarChart2 className="h-3.5 w-3.5" />
                Vergleich
              </TabsTrigger>
            </TabsList>

            {/* ── Section 1: Flottenergebnisse ───────────────────────────── */}
            {completedRuns.map((run: any) => (
              <TabsContent key={run.id} value={run.id} className="mt-6 space-y-8">
                <div>
                  <SectionHeader id="flotte" title="Flottenergebnisse" subtitle="Elektrifizierungsanalyse nach Szenario" />
                  <ScenarioResultsPanel
                    runId={run.id}
                    projectId={projectId}
                    scenarioId={run.scenario_id}
                  />
                </div>

                <div>
                  <SectionHeader id="touren" title="Tourenanalyse" subtitle="Detaillierte Analyse aller Routen" />
                  <TourenanalyseSection activeRunId={run.id} />
                </div>

                <div>
                  <SectionHeader id="infrastruktur" title="Ladeinfrastruktur" subtitle="Infrastrukturbedarf für die Elektrifizierung" />
                  <InfrastrukturSection activeRunId={run.id} />
                </div>
              </TabsContent>
            ))}

            <TabsContent value="compare" className="mt-6 space-y-8">
              <div>
                <SectionHeader id="flotte" title="Flottenergebnisse" subtitle="Szenarien-Vergleich" />
                <div className="bg-white border rounded p-5">
                  <ScenarioComparisonPanel runs={allRuns as any} />
                </div>
              </div>

              <div>
                <SectionHeader id="touren" title="Tourenanalyse" subtitle="Detaillierte Analyse aller Routen" />
                <TourenanalyseSection activeRunId={selectedRunId} />
              </div>

              <div>
                <SectionHeader id="infrastruktur" title="Ladeinfrastruktur" subtitle="Infrastrukturbedarf für die Elektrifizierung" />
                <InfrastrukturSection activeRunId={selectedRunId} />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// Inject print styles
if (typeof document !== 'undefined' && !document.getElementById('sim-results-print-styles')) {
  const style = document.createElement('style');
  style.id = 'sim-results-print-styles';
  style.textContent = `
    @media print {
      aside, nav, .no-print, button { display: none !important; }
      body { background: white; }
      .animate-fade-in { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}
