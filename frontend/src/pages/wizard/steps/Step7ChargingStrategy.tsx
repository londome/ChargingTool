import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Calendar, Globe, Settings, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/projectStore';
import { useRunOptimization } from '@/lib/api';

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
  const { wizard } = useProjectStore();
  const runOptimization = useRunOptimization();

  // Pre-filled from wizard
  const gcpDefault = wizard.step3Depot.max_grid_connection_kw ?? 100;
  const wallboxDefault = wizard.step4.charging_power_kw ?? 22;
  const socTargetDefault = wizard.step4.soc_target ?? 80;
  const socMinDefault = wizard.step4.soc_min ?? 20;

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

  const projectId = wizard.projectId;

  const handleStart = async () => {
    if (!projectId || projectId.startsWith('local_')) {
      setError('Kein gültiges Projekt gefunden. Bitte Schritt 1 abschließen.');
      return;
    }
    setError(null);
    try {
      const multiDay = dateTo > dateFrom;
      await runOptimization.mutateAsync({
        project_id: projectId,
        date: dateFrom,
        ...(multiDay ? { date_to: dateTo } : {}),
        bidding_zone: biddingZone,
        gcp_max_kw: gcpDefault,
        wallbox_power_kw: wallboxDefault,
        soc_target_pct: socTargetDefault,
        soc_min_pct: socMinDefault,
        // times and EV specs resolved on the backend from routes + ev_models
        selected_ev_ids: wizard.step5SelectedEVIds,
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
        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ladestrategie & Optimierung</h2>
          <p className="text-sm text-slate-500">
            Wähle Datum und Strategie – alle weiteren Parameter werden aus dem Wizard übernommen.
          </p>
        </div>
      </div>

      {/* Strategy selector (currently only one option) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Ladestrategie</Label>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50">
          <Zap className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-900">Day-Ahead Optimiert</p>
            <p className="text-xs text-green-700">
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

      {/* Wizard params summary (read-only) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Settings className="w-4 h-4 text-slate-400" />
          Parameter aus Wizard (Schritt 3 &amp; 4)
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Max. Netzanschluss (GCP)</span>
            <span className="font-medium text-slate-800">{gcpDefault} kW</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Wallbox-Leistung</span>
            <span className="font-medium text-slate-800">{wallboxDefault} kW</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">SOC-Ziel</span>
            <span className="font-medium text-slate-800">{socTargetDefault} %</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Min. SOC bei Ankunft</span>
            <span className="font-medium text-slate-800">{socMinDefault} %</span>
          </div>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-500 pt-1 border-t border-slate-200">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Diese Werte stammen aus den vorherigen Wizard-Schritten und können dort angepasst werden.</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleStart}
          disabled={runOptimization.isPending || !dateFrom}
          className="bg-green-600 hover:bg-green-700 text-white px-6"
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
