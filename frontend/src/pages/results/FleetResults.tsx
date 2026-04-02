import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Download, RefreshCw, TrendingDown, Zap, Leaf, DollarSign, BarChart2 } from 'lucide-react';
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
import KPICard from '@/components/shared/KPICard';
import CostComparisonChart from '@/components/charts/CostComparisonChart';
import CO2ComparisonChart from '@/components/charts/CO2ComparisonChart';
import TCOComparisonChart from '@/components/charts/TCOComparisonChart';
import FeasibilityPieChart from '@/components/charts/FeasibilityPieChart';
import { formatCurrency, formatCO2, formatPercent, formatPayback } from '@/lib/utils';
import type { SimulationRun } from '@shared/types';

// ─── Single scenario results panel ──────────────────────────────────────────
function ScenarioResultsPanel({ runId, projectId, scenarioId }: {
  runId: string;
  projectId: string;
  scenarioId: string;
}) {
  const runSimulation = useRunSimulation();
  const { data: statusData } = useSimulationStatus(runId);
  const { data: results, isLoading } = useSimulationResults(
    statusData?.status === 'completed' ? runId : undefined
  );

  const summary = results?.summary;
  const isRunning = statusData?.status === 'running' || statusData?.status === 'pending';

  const routeResults = results?.route_results ?? [];
  const totalTours = routeResults.length;
  const electrifiableTours = routeResults.filter(r => r.feasible_without_charging || r.feasible_with_charging).length;
  const notFeasibleTours = totalTours - electrifiableTours;

  const handleRerun = async () => {
    await runSimulation.mutateAsync({ project_id: projectId, scenario_id: scenarioId });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
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
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
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
              tooltip="Jährliche CO₂e-Einsparung gegenüber Status quo"
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
            <TCOComparisonChart tcoIce={summary.tco_ice} tcoEv={summary.tco_ev} />
            <FeasibilityPieChart
              feasible={totalTours > 0 ? electrifiableTours : summary.electrifiable_count}
              notFeasible={totalTours > 0 ? notFeasibleTours : Math.max(0, summary.total_vehicles - summary.electrifiable_count)}
            />
          </div>

          <div className="bg-white border rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Empfehlung Ladeinfrastruktur</h3>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{summary.recommended_charger_count}</p>
                <p className="text-xs text-slate-500">Ladepunkte gesamt</p>
              </div>
              <p className="text-sm text-slate-600">
                Empfehlung basierend auf täglichem Energiebedarf und verfügbarem Ladefenster.
                Detaillierte Infrastrukturplanung unter <strong>Infrastruktur-Ergebnisse</strong>.
              </p>
            </div>
          </div>
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
function ScenarioComparisonPanel({ runs }: { runs: (SimulationRun & {
  scenario_name: string;
  scenario_type?: string;
  electrifiable_pct: number | null;
  co2e_savings_pct: number | null;
  payback_years: number | null;
  tco_savings: number | null;
})[] }) {
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
            <th className="text-left px-4 py-3 font-semibold text-slate-700">Szenario</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-700">Elektrifizierbar</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-700">CO₂-Einsparung</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-700">TCO-Einsparung</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-700">Amortisation</th>
          </tr>
        </thead>
        <tbody>
          {completed.map((run, i) => (
            <tr key={run.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-4 py-3 font-medium text-slate-900">
                {run.scenario_name}
                <Badge variant="outline" className="ml-2 text-xs">{run.scenario_type}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-slate-700">
                {run.electrifiable_pct != null ? formatPercent(run.electrifiable_pct) : '–'}
              </td>
              <td className="px-4 py-3 text-right text-green-700 font-medium">
                {run.co2e_savings_pct != null ? formatPercent(run.co2e_savings_pct) : '–'}
              </td>
              <td className="px-4 py-3 text-right text-green-700 font-medium">
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

// ─── Main page ───────────────────────────────────────────────────────────────
export default function FleetResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeRunId } = useProjectStore();

  const { data: allRuns = [], isLoading: runsLoading } = useSimulationRuns(projectId);
  const completedRuns = (allRuns as any[]).filter(r => r.status === 'completed');
  const pendingRuns = (allRuns as any[]).filter(r => r.status === 'pending' || r.status === 'running');

  // Pre-select the activeRunId tab, or first completed run
  const defaultTab = activeRunId && completedRuns.find(r => r.id === activeRunId)
    ? activeRunId
    : completedRuns[0]?.id ?? 'compare';

  const [selectedTab, setSelectedTab] = useState(defaultTab);

  // Update selected tab if activeRunId changes (new simulation finished)
  useEffect(() => {
    if (activeRunId && completedRuns.find(r => r.id === activeRunId)) {
      setSelectedTab(activeRunId);
    }
  }, [activeRunId, completedRuns.length]);

  if (!projectId) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Flottenergebnisse</h1>
        <p className="text-sm text-slate-500 mt-1">Elektrifizierungsanalyse nach Szenario</p>
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

          {completedRuns.map((run: any) => (
            <TabsContent key={run.id} value={run.id} className="mt-5">
              <ScenarioResultsPanel
                runId={run.id}
                projectId={projectId}
                scenarioId={run.scenario_id}
              />
            </TabsContent>
          ))}

          <TabsContent value="compare" className="mt-5">
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                Szenarien-Vergleich
              </h3>
              <ScenarioComparisonPanel runs={allRuns as any} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
