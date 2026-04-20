import { useState, useEffect } from 'react';
import {
  Check, Zap, Package, Battery, Gauge, CheckCircle2, XCircle,
  AlertTriangle, Loader2,
} from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useEVModels, useRunReichweitenSimulation, useReichweitenLatest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleSegment } from '@shared/types';
import { getSegmentLabel, formatCurrency, cn } from '@/lib/utils';

type Phase = 'select' | 'running' | 'results';

interface Props {
  onFinish: () => void;
}

export default function Step3LadeprozessEV({ onFinish }: Props) {
  const {
    wizard, setWizardStep, setWizardSelectedEVs,
    setLadeprozessReichweitenRunId,
  } = useProjectStore();

  const { data: evModels, isLoading } = useEVModels();
  const runSim = useRunReichweitenSimulation();

  const [selectedIds, setSelectedIds] = useState<string[]>(wizard.step5SelectedEVIds ?? []);
  const [filterSegment, setFilterSegment] = useState<string>('all');
  const [filterManufacturer, setFilterManufacturer] = useState('');
  const [phase, setPhase] = useState<Phase>('select');
  const [runId, setRunId] = useState<string | null>(wizard.ladeprozessReichweitenRunId ?? null);

  // Poll results when we have a run ID
  const { data: latestRun } = useReichweitenLatest(
    phase === 'running' || (phase === 'results' && runId) ? wizard.projectId ?? undefined : undefined
  );

  const modelList = Array.isArray(evModels) ? evModels : [];
  const fleetSegments = [...new Set(wizard.step2Vehicles.map(v => v.segment))];

  const filteredModels = modelList.filter(ev => {
    if (filterSegment !== 'all' && ev.segment !== filterSegment) return false;
    if (filterManufacturer && !ev.manufacturer.toLowerCase().includes(filterManufacturer.toLowerCase())) return false;
    return true;
  });

  const toggleEV = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleStartAnalyse = async () => {
    const pid = wizard.projectId;
    if (!pid || pid.startsWith('local_')) {
      // No backend — skip to next step
      onFinish();
      return;
    }
    setWizardSelectedEVs(selectedIds);
    setPhase('running');
    try {
      const res = await runSim.mutateAsync({ project_id: pid, selected_ev_ids: selectedIds });
      setRunId(res.run_id);
      setLadeprozessReichweitenRunId(res.run_id);
    } catch {
      setPhase('select');
    }
  };

  const status = latestRun?.status;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const results = latestRun?.results;
  const selectedEVResult = results
    ? (selectedIds.length > 0
        ? results.ev_results.find(r => selectedIds.includes(r.ev_model_id))
        : null)
      ?? results.ev_results[0]
    : null;

  // Transition running → results via effect (never during render)
  useEffect(() => {
    if (phase === 'running' && (status === 'completed' || status === 'failed')) {
      setPhase('results');
    }
  }, [phase, status]);

  const feasiblePct = selectedEVResult?.summary.feasible_pct ?? 0;
  const feasibleCount = selectedEVResult?.summary.feasible_routes ?? 0;
  const totalCount = selectedEVResult?.summary.total_routes ?? 0;
  const infeasibleCount = totalCount - feasibleCount;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">EV-Auswahl & Elektrifizierbarkeit</h2>
        <p className="text-sm text-slate-500 mt-1">
          Wähle ein oder mehrere EV-Modelle, starte die Analyse und prüfe, welche Touren elektrifizierbar sind.
        </p>
      </div>

      {/* ── Phase: SELECT ── */}
      {(phase === 'select' || phase === 'running') && (
        <div className="p-6 space-y-4">
          {/* Fleet segment hint */}
          {fleetSegments.length > 0 && (
            <div className="p-3 bg-[#e6f3fc] rounded border border-[#0079C0]/20">
              <p className="text-xs font-normal text-[#001141] mb-1.5">Empfohlene Segmente:</p>
              <div className="flex flex-wrap gap-1.5">
                {fleetSegments.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterSegment(filterSegment === s ? 'all' : s)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      filterSegment === s
                        ? 'bg-[#0079C0] text-white border-[#0079C0]'
                        : 'bg-white text-[#0079C0] border-[#0079C0]/40 hover:border-[#0079C0]'
                    )}
                  >
                    {getSegmentLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filterSegment} onValueChange={setFilterSegment}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue placeholder="Segment filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Segmente</SelectItem>
                {Object.values(VehicleSegment).map(s => (
                  <SelectItem key={s} value={s}>{getSegmentLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Hersteller suchen..."
              value={filterManufacturer}
              onChange={e => setFilterManufacturer(e.target.value)}
              className="w-44 h-8 text-sm"
            />

            {selectedIds.length > 0 && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#e6f3fc] text-[#0079C0] border border-[#0079C0]/30">
                {selectedIds.length} ausgewählt
              </span>
            )}
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          {/* EV Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : filteredModels.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Keine Modelle gefunden.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredModels.map(ev => {
                const isSelected = selectedIds.includes(ev.id);
                const usable_soc = 0.70;
                const est_range = Math.round(
                  (ev.battery_usable_kwh * usable_soc) / (ev.nominal_consumption_kwh_100km / 100)
                );
                return (
                  <div
                    key={ev.id}
                    onClick={() => toggleEV(ev.id)}
                    className={cn(
                      'relative cursor-pointer rounded border p-3 transition-all select-none',
                      isSelected
                        ? 'border-[#0079C0] bg-[#e6f3fc] shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0079C0] flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <div className={cn('p-1.5 rounded shrink-0', isSelected ? 'bg-[#cce6f8]' : 'bg-slate-100')}>
                        <Zap className={cn('h-3.5 w-3.5', isSelected ? 'text-[#0079C0]' : 'text-slate-500')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-normal text-[#001141] text-sm leading-tight pr-5">
                          {ev.manufacturer} {ev.model}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{getSegmentLabel(ev.segment as VehicleSegment)}</p>
                        <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                          <span className="flex items-center gap-0.5 text-xs text-slate-600">
                            <Battery className="h-3 w-3" /> {ev.battery_usable_kwh} kWh
                          </span>
                          <span className="flex items-center gap-0.5 text-xs text-slate-600">
                            <Gauge className="h-3 w-3" /> ~{est_range} km
                          </span>
                          {ev.payload_kg && (
                            <span className="flex items-center gap-0.5 text-xs text-slate-600">
                              <Package className="h-3 w-3" /> {ev.payload_kg.toLocaleString('de-DE')} kg
                            </span>
                          )}
                        </div>
                        {ev.purchase_price && (
                          <p className="text-xs text-[#0079C0] font-medium mt-1">
                            ab {formatCurrency(ev.purchase_price)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-slate-400">
            Keine Auswahl nötig — alle verfügbaren Modelle werden analysiert.
          </p>
        </div>
      )}

      {/* ── Phase: RUNNING ── */}
      {phase === 'running' && (
        <div className="px-6 pb-6 flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-[#0079C0] animate-spin" />
          <p className="text-sm text-slate-600">Elektrifizierbarkeit wird analysiert…</p>
        </div>
      )}

      {/* ── Phase: RESULTS — Zwischenergebnisse ── */}
      {phase === 'results' && (
        <div className="p-6 space-y-5">
          {status === 'failed' || !results ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded border border-red-200 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Analyse fehlgeschlagen. Bitte erneut versuchen.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded border border-slate-200 p-3 text-center">
                  <p className={cn('text-2xl font-bold', feasiblePct === 100 ? 'text-[#043F2E]' : feasiblePct >= 50 ? 'text-[#C45600]' : 'text-red-600')}>
                    {feasiblePct}%
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Elektrifizierbar</p>
                </div>
                <div className="rounded border border-[#e8f5f0] bg-[#f4fbf8] p-3 text-center">
                  <p className="text-2xl font-bold text-[#043F2E]">{feasibleCount}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <CheckCircle2 className="h-3 w-3 inline mr-0.5 text-[#043F2E]" />
                    Elektrifizierbar
                  </p>
                </div>
                <div className="rounded border border-red-100 bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{infeasibleCount}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <XCircle className="h-3 w-3 inline mr-0.5 text-red-600" />
                    Nicht elektrifizierbar
                  </p>
                </div>
              </div>

              {/* EV model used */}
              {selectedEVResult && (
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Zap className="h-3 w-3 text-[#0079C0]" />
                  Analyse basiert auf: <span className="font-medium text-[#001141]">{selectedEVResult.ev_model_name}</span>
                </div>
              )}

              {/* Route list (max 10 shown) */}
              {selectedEVResult && selectedEVResult.route_results.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedEVResult.route_results.slice(0, 20).map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded border border-slate-100 bg-slate-50">
                      <span className="text-slate-600 font-medium">{r.route_id}</span>
                      <span className="text-slate-500">{r.distance_km} km</span>
                      {r.feasibility_status === 'feasible' ? (
                        <span className="flex items-center gap-1 text-[#043F2E]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Elektrifizierbar
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3.5 w-3.5" /> Nicht elektrifizierbar
                        </span>
                      )}
                    </div>
                  ))}
                  {selectedEVResult.route_results.length > 20 && (
                    <p className="text-xs text-slate-400 text-center pt-1">
                      + {selectedEVResult.route_results.length - 20} weitere Touren
                    </p>
                  )}
                </div>
              )}

              {/* Warning if not all feasible */}
              {infeasibleCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{infeasibleCount} Tour{infeasibleCount > 1 ? 'en sind' : ' ist'} nicht elektrifizierbar</strong> mit dem gewählten EV-Modell.
                    Du kannst trotzdem fortfahren — die Simulation berücksichtigt nur die elektrofizierbaren Touren.
                    Oder geh zurück und wähle ein anderes Modell.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button
          variant="outline"
          onClick={() => phase === 'results' ? setPhase('select') : setWizardStep(2)}
        >
          {phase === 'results' ? '← EV anpassen' : '← Zurück'}
        </Button>

        {phase === 'select' && (
          <Button onClick={handleStartAnalyse} disabled={runSim.isPending}>
            {runSim.isPending ? 'Wird gestartet…' : 'Analyse starten →'}
          </Button>
        )}

        {phase === 'running' && (
          <Button disabled>
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Analysiert…
          </Button>
        )}

        {phase === 'results' && (
          <Button onClick={onFinish} className="bg-[#043F2E] hover:bg-[#032e21]">
            Weiter zu Depot →
          </Button>
        )}
      </div>
    </div>
  );
}
