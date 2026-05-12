import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BatteryCharging, Loader2, Info } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useRunArbitrage, useCreateScenario, useRunSimulation } from '@/lib/api';
import { ScenarioType, InstallationType } from '@shared/types';

const BIDDING_ZONES: Record<string, string> = {
  DE_LU: 'Deutschland/Luxemburg (DE-LU)',
  GB: 'Großbritannien (GB)',
  NL: 'Niederlande (NL)',
  DE_AT_LU: 'DE-AT-LU (historisch)',
  FR: 'Frankreich (FR)',
  ES: 'Spanien (ES)',
};

export default function Step4ArbitrageStrategy() {
  const navigate = useNavigate();
  const { wizard, activeProject, lastgangProfile, lastgangProjectId, setActiveScenarioId, setActiveRunId } = useProjectStore();
  const activeLastgang = lastgangProfile && lastgangProjectId === wizard.projectId ? lastgangProfile : null;
  const runArbitrage = useRunArbitrage();
  const createScenario = useCreateScenario();
  const runSimulation = useRunSimulation();

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [biddingZone, setBiddingZone] = useState('DE_LU');

  const dayCount = (() => {
    const d1 = new Date(dateFrom);
    const d2 = new Date(dateTo);
    const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
    return Math.max(1, diff + 1);
  })();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = (wizard.projectId && !wizard.projectId.startsWith('local_'))
    ? wizard.projectId
    : activeProject?.id ?? null;
  const gcpMaxKw = wizard.step3Depot.max_grid_connection_kw;
  const wallboxPowerKw = wizard.step4.charging_power_kw;
  const socTarget = wizard.step4.soc_target;
  const socMin = wizard.step4.soc_min;
  const selectedEvIds = wizard.step5SelectedEVIds;

  const handleStart = async () => {
    if (!projectId) return;
    setIsRunning(true);
    setError(null);
    try {
      const multiDay = dateTo > dateFrom;

      // ── 1. Base simulation (Kosten & Emissionen / Tourenanalyse / Ladevorgang) ──
      try {
        await fetch(`/api/scenarios/project/${projectId}`, { method: 'DELETE' });
        const depot = wizard.step3Depot;
        const scenario = await createScenario.mutateAsync({
          project_id: projectId,
          name: 'Basis-Szenario',
          type: ScenarioType.BASELINE,
          notes: 'Automatisch erstellt durch Ladeprozess Bidirektional (V2X)',
          electricity_price: wizard.step4?.electricity_price ?? 0.28,
          diesel_price: 1.75,
          grid_emission_factor: wizard.step4?.grid_emission_factor ?? 0.380,
          charging_power_kw: wallboxPowerKw,
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
        // Non-fatal — arbitrage continues regardless
      }

      // ── 2. V2G Arbitrage optimization ────────────────────────────────────────
      const depotProfileKw = activeLastgang?.intervals?.length === 96
        ? activeLastgang.intervals.map(i => i.power_kw)
        : undefined;
      await runArbitrage.mutateAsync({
        project_id: projectId,
        date: dateFrom,
        ...(multiDay ? { date_to: dateTo } : {}),
        bidding_zone: biddingZone,
        gcp_max_kw: gcpMaxKw,
        wallbox_power_kw: wallboxPowerKw,
        soc_target_pct: socTarget,
        soc_min_pct: socMin,
        selected_ev_ids: selectedEvIds,
        ...(depotProfileKw ? { depot_profile_kw: depotProfileKw } : {}),
      });
      navigate(`/projekte/${projectId}/ergebnisse/arbitrage`);
    } catch (e) {
      console.error('Arbitrage failed:', e);
      setError('Die Arbitrage-Berechnung konnte nicht gestartet werden.');
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 text-purple-600">
          <BatteryCharging className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-normal text-[#001141]">V2G Arbitrage-Strategie</h2>
          <p className="text-xs text-slate-500">
            MILP-basierte bidirektionale Ladeoptimierung der EV-Flotte mit ENTSO-E Day-Ahead Preisen
          </p>
        </div>
      </div>

      {/* Read-only fleet summary */}
      <div className="bg-purple-50 border border-purple-100 rounded p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-purple-500 shrink-0" />
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
            Flottenparameter aus dem Wizard
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Max. Netzanschluss (GCP)</p>
            <p className="text-sm font-semibold text-slate-900">{gcpMaxKw} kW</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Wallbox-Leistung</p>
            <p className="text-sm font-semibold text-slate-900">{wallboxPowerKw} kW</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">SOC-Ziel (vor Abfahrt)</p>
            <p className="text-sm font-semibold text-slate-900">{socTarget}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">SOC Minimum</p>
            <p className="text-sm font-semibold text-slate-900">{socMin}%</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 italic">
          Batteriespezifikationen werden aus der EV-Auswahl (Schritt 3) übernommen.
        </p>
      </div>

      {/* Arbitrage-specific parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date from */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Von (Startdatum)</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              if (e.target.value > dateTo) setDateTo(e.target.value);
            }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Bis (Enddatum)
            <span className="ml-2 text-purple-600 font-semibold">
              {dayCount} {dayCount === 1 ? 'Tag' : 'Tage'}
            </span>
          </label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Bidding zone */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Strommarktzone</label>
          <select
            value={biddingZone}
            onChange={(e) => setBiddingZone(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {Object.entries(BIDDING_ZONES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleStart}
          disabled={isRunning || !projectId}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-sm font-medium rounded transition-colors"
        >
          {isRunning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Arbitrage läuft...</>
          ) : (
            <><BatteryCharging className="w-4 h-4" /> Arbitrage starten</>
          )}
        </button>
      </div>
    </div>
  );
}
