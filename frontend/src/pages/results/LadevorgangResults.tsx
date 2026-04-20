import { useParams, useNavigate } from 'react-router-dom';
import { FileDown, Home } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useSimulationResults } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import EVLastgangChart from '@/components/charts/EVLastgangChart';

export default function LadevorgangResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeRunId, lastgangProfile, wizard, setActiveProject, setActiveRunId, setActiveScenarioId, setLastgangProfile } = useProjectStore();
  const navigate = useNavigate();

  const { data: results, isLoading } = useSimulationResults(activeRunId ?? undefined);
  const infra = results?.infrastructure;

  const handleCloseProject = () => {
    setActiveProject(null);
    setActiveRunId(null);
    setActiveScenarioId(null);
    setLastgangProfile(null);
    navigate('/dashboard');
  };

  const handlePrintPDF = () => window.print();

  if (!projectId || !activeRunId) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-light text-[#001141]">Ladevorgang</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ladeinfrastruktur, Lastgang und SOC-Verlauf der Flotte
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded" />)}
        </div>
      ) : results ? (
        <>
          <EVLastgangChart
            routeResults={results.route_results ?? []}
            vehicleResults={results.vehicle_results ?? []}
            chargingPowerKw={infra?.avg_charging_power_kw ?? wizard.step4?.charging_power_kw ?? 22}
            chargingEfficiency={wizard.step4?.charging_efficiency ?? 0.92}
            socTarget={wizard.step4?.soc_target ?? 80}
            lastgangProfile={lastgangProfile}
          />
        </>
      ) : (
        <Alert variant="info">
          <AlertDescription>Keine Daten verfügbar. Starten Sie zunächst eine Simulation.</AlertDescription>
        </Alert>
      )}

      {/* Projekt abschließen */}
      <Card className="border-[#043F2E] bg-[#e8f5f0]">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-normal text-[#043F2E]">Simulation abgeschlossen</h3>
              <p className="text-sm text-[#043F2E]/80 mt-0.5">
                Laden Sie einen PDF-Bericht herunter oder schließen Sie das Projekt.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handlePrintPDF}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white border border-green-300 text-green-800 hover:bg-green-100 transition-colors"
              >
                <FileDown className="h-4 w-4" />
                PDF-Bericht
              </button>
              <button
                onClick={handleCloseProject}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
              >
                <Home className="h-4 w-4" />
                Projekt abschließen
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Inject print styles once
if (typeof document !== 'undefined' && !document.getElementById('ladevorgang-print-styles')) {
  const style = document.createElement('style');
  style.id = 'ladevorgang-print-styles';
  style.textContent = `@media print { aside, nav, button, .no-print { display: none !important; } body { background: white; } }`;
  document.head.appendChild(style);
}
