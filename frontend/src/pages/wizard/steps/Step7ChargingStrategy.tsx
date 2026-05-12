import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Calendar, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/projectStore';
import { useRunOptimization, useCreateScenario, useRunSimulation } from '@/lib/api';
import { ScenarioType, InstallationType } from '@shared/types';

const BIDDING_ZONES: Record<string, string> = {
  DE_LU: 'Deutschland / Luxemburg (DE-LU)',
  NL: 'Niederlande (NL)',
  FR: 'Frankreich (FR)',
  ES: 'Spanien (ES)',
  GB: 'Großbritannien (GB)',
  DE_AT_LU: 'DE-AT-LU (historisch)',
};

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function Step7ChargingStrategy() {
  const navigate = useNavigate();
  const { wizard, activeProject, lastgangProfile, lastgangProjectId, setActiveScenarioId, setActiveRunId } = useProjectStore();
  const activeLastgang = lastgangProfile && lastgangProjectId === wizard.projectId ? lastgangProfile : null;
  const runOptimization = useRunOptimization();
  const createScenario = useCreateScenario();
  const runSimulation = useRunSimulation();

  // Read directly from wizard — no local overrides
  const gcpKw     = wizard.step3Depot.max_grid_connection_kw ?? 100;
  const wallboxKw = wizard.step4.charging_power_kw ?? 22;
  const socTarget = wizard.step4.soc_target ?? 80;
  const socMin    = wizard.step4.soc_min ?? 20;

  const [dateFrom, setDateFrom] = useState<string>(todayISO());
  const [dateTo, setDateTo] = useState<string>(todayISO());
  const [biddingZone, setBiddingZone] = useState<string>('DE_LU');
  const [error, setError] = useState<string | null>(null);

  const dayCount = (() => {
    const d1 = new Date(dateFrom);
    const d2 = new Date(dateTo);
    const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
    return Math.max(1, diff + 1);
  })();

  // Wizard state is not persisted — fall back to activeProject if wizard was reset (e.g. page reload)
  const projectId = (wizard.projectId && !wizard.projectId.startsWith('local_'))
    ? wizard.projectId
    : activeProject?.id ?? null;

  const handleStart = async () => {
    if (!projectId) {
      setError('Kein gültiges Projekt gefunden. Bitte Schritt 1 abschließen.');
      return;
    }
    setError(null);
    try {
      const multiDay = dateTo > dateFrom;

      // ── 1. Base simulation (Kosten & Emissionen / Tourenanalyse / Ladevorgang) ──
      // Create a default Basis scenario and run the simulation so those result pages
      // have data — exactly what Step6Scenarios does in the base Ladeprozess module.
      try {
        await fetch(`/api/scenarios/project/${projectId}`, { method: 'DELETE' });
        const depot = wizard.step3Depot;
        const scenario = await createScenario.mutateAsync({
          project_id: projectId,
          name: 'Basis-Szenario',
          type: ScenarioType.BASELINE,
          notes: 'Automatisch erstellt durch Ladeprozess Optimierung (V1X)',
          electricity_price: wizard.step4?.electricity_price ?? 0.28,
          diesel_price: 1.75,
          grid_emission_factor: wizard.step4?.grid_emission_factor ?? 0.380,
          charging_power_kw: wallboxKw,
          charging_efficiency: wizard.step4?.charging_efficiency ?? 0.92,
          electrification_pct: 100,
          allow_public_charging: false,
          wallbox_price_eur: depot?.wallbox_price_eur ?? 1200,
          installation_type: (depot?.installation_type ?? InstallationType.STANDARD) as InstallationType,
          winter_surcharge: 0,
          temperature_factor: 1.0,
          soc_start: wizard.step4?.soc_start ?? 90,
          soc_min: socMin,
          soc_target: socTarget,
        });
        const simRun = await runSimulation.mutateAsync({
          project_id: projectId,
          scenario_id: scenario.id,
        });
        setActiveScenarioId(scenario.id);
        setActiveRunId(simRun.run_id);
      } catch (simErr) {
        console.warn('Basis-Simulation konnte nicht gestartet werden:', simErr);
        // Non-fatal — optimization continues regardless
      }

      // ── 2. LP Charging optimization ──────────────────────────────────────────
      // Pass depot background load profile so LP solver reserves headroom per slot
      const depotProfileKw = activeLastgang?.intervals?.length === 96
        ? activeLastgang.intervals.map(i => i.power_kw)
        : undefined;
      await runOptimization.mutateAsync({
        project_id: projectId,
        date: dateFrom,
        ...(multiDay ? { date_to: dateTo } : {}),
        bidding_zone: biddingZone,
        gcp_max_kw: gcpKw,
        wallbox_power_kw: wallboxKw,
        soc_target_pct: socTarget,
        soc_min_pct: socMin,
        selected_ev_ids: wizard.step5SelectedEVIds,
        ...(depotProfileKw ? { depot_profile_kw: depotProfileKw } : {}),
      });
      navigate(`/projekte/${projectId}/ergebnisse/optimierung`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setError(`Optimierung fehlgeschlagen: ${msg}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#e8f5f0] rounded flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-[#043F2E]" />
        </div>
        <div>
          <h2 className="text-lg font-normal text-[#001141]">Ladestrategie & Optimierung</h2>
          <p className="text-sm text-slate-500">
            Wähle Datum und Strategie – alle weiteren Parameter werden aus dem Wizard übernommen.
          </p>
        </div>
      </div>

      {/* Strategy selector (currently only one option) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Ladestrategie</Label>
        <div className="flex items-center gap-3 p-4 rounded border border-green-200 bg-[#e8f5f0]">
          <Zap className="w-5 h-5 text-[#043F2E] shrink-0" />
          <div>
            <p className="text-sm font-normal text-[#043F2E]">Day-Ahead Optimiert</p>
            <p className="text-xs text-[#043F2E]/80">
              Minimiert Ladekosten basierend auf ENTSO-E Day-Ahead Strompreisen (15-min-Intervalle, LP-Optimierung)
            </p>
          </div>
        </div>
      </div>

      {/* Date range */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          Analysezeitraum
        </Label>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Von (Startdatum)</p>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                if (e.target.value > dateTo) setDateTo(e.target.value);
              }}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Bis (Enddatum)</p>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={e => setDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="pt-4">
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
              {dayCount} {dayCount === 1 ? 'Tag' : 'Tage'}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Day-Ahead Preise werden für diesen Zeitraum von der ENTSO-E Transparenzplattform abgerufen.
        </p>
      </div>

      {/* Bidding Zone */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Globe className="w-4 h-4 text-slate-400" />
          Gebotzone (Strommarkt)
        </Label>
        <Select value={biddingZone} onValueChange={setBiddingZone}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BIDDING_ZONES).map(([code, label]) => (
              <SelectItem key={code} value={code}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleStart}
          disabled={runOptimization.isPending || !dateFrom}
          className="bg-[#043F2E] hover:bg-[#032d20] text-white px-6"
        >
          {runOptimization.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Optimierung wird gestartet…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Optimierung starten
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
