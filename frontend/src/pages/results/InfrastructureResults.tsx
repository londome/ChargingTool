import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Zap, AlertTriangle, BatteryCharging, FileDown, Home } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useSimulationResults } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import KPICard from '@/components/shared/KPICard';
import { formatKWh, formatKW, formatNumber } from '@/lib/utils';


export default function InfrastructureResults() {
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

  const handlePrintPDF = () => {
    window.print();
  };


  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-light text-[#001141]">Ladeinfrastruktur</h1>
        <p className="text-sm text-slate-500 mt-1">
          Infrastrukturbedarf für die Elektrifizierung Ihrer Flotte
        </p>
      </div>

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
              icon={BatteryCharging}
              color="blue"
              tooltip="N = ceil(Σ Ladezeit_i / (Ladefenster × Auslastungsziel))"
            />
            <KPICard
              title="Depot-Ladepunkte"
              value={formatNumber(infra.depot_chargers)}
              subtitle="AC-Lader im Depot"
              icon={Building2}
              color="blue"
            />
            <KPICard
              title="Täglicher Energiebedarf"
              value={formatKWh(infra.daily_energy_demand_kwh)}
              subtitle="Gesamtflotte"
              icon={Zap}
              color="amber"
            />
            <KPICard
              title="Ø Ladeleistung"
              value={formatKW(infra.avg_charging_power_kw)}
              subtitle={`${infra.charging_window_hours}h Ladefenster`}
              icon={Zap}
              color="green"
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
        </>
      ) : (
        <Alert variant="info">
          <AlertDescription>Keine Infrastrukturdaten verfügbar. Starten Sie zunächst eine Simulation.</AlertDescription>
        </Alert>
      )}

      {/* ── Projekt abschließen ─────────────────────────────────────────────── */}
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
if (typeof document !== 'undefined' && !document.getElementById('infra-print-styles')) {
  const style = document.createElement('style');
  style.id = 'infra-print-styles';
  style.textContent = `@media print { aside, nav, button, .no-print { display: none !important; } body { background: white; } }`;
  document.head.appendChild(style);
}
