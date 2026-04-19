import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Gauge, Battery, Zap,
  ChevronDown, ChevronUp, AlertTriangle, Star, Info, LayoutDashboard, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReichweitenLatest, ReichweitenEVResult, ReichweitenRouteResult } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import KPICard from '@/components/shared/KPICard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function socColor(soc: number, socMin: number) {
  if (soc >= socMin + 20) return 'text-[#043F2E]';
  if (soc >= socMin) return 'text-[#C45600]';
  return 'text-red-600';
}

function feasibilityBarColor(pct: number) {
  if (pct === 100) return 'bg-green-500';
  if (pct >= 75) return 'bg-emerald-400';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

function feasibilityTextColor(pct: number) {
  if (pct === 100) return 'text-[#043F2E]';
  if (pct >= 75) return 'text-[#043F2E]';
  if (pct >= 50) return 'text-[#C45600]';
  return 'text-red-600';
}

function FeasibilityBadge({ status }: { status: string }) {
  return status === 'feasible' ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#e8f5f0] text-[#043F2E] border border-[#043F2E]/20">
      <CheckCircle2 className="h-3 w-3" /> Machbar
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      <XCircle className="h-3 w-3" /> Nicht machbar
    </span>
  );
}

// ── EV Panel ──────────────────────────────────────────────────────────────────

function EVPanel({
  ev,
  socMin,
  highlight,
  rank,
}: {
  ev: ReichweitenEVResult;
  socMin: number;
  highlight?: boolean;
  rank?: number;
}) {
  const [expanded, setExpanded] = useState(highlight ?? false);
  const pct = ev.summary.feasible_pct;

  return (
    <div className={cn(
      'border rounded overflow-hidden transition-shadow',
      highlight ? 'border-[#0079C0] shadow-md' : 'border-slate-200',
    )}>
      {/* Header */}
      <button
        className={cn(
          'w-full flex items-center justify-between p-4 transition-colors',
          highlight ? 'bg-[#e6f3fc] hover:bg-[#d0eaf8]' : 'bg-white hover:bg-slate-50'
        )}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-4">
          {/* Rank badge for recommendations */}
          {rank !== undefined && (
            <div className={cn(
              'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0',
              rank === 0 ? 'bg-amber-100 text-amber-700' :
              rank === 1 ? 'bg-slate-100 text-slate-600' :
              'bg-orange-50 text-orange-600'
            )}>
              #{rank + 1}
            </div>
          )}

          {/* Feasibility % */}
          <div className="w-12 text-center shrink-0">
            <p className={cn('text-lg font-bold', feasibilityTextColor(pct))}>
              {pct}%
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">machbar</p>
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="font-normal text-[#001141] text-sm">{ev.ev_model_name}</p>
              {pct === 100 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                  100% ✓
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Battery className="h-3 w-3" /> {ev.battery_kwh} kWh
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Zap className="h-3 w-3" /> {ev.consumption_kwh_100km} kWh/100km
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Gauge className="h-3 w-3" /> bis {ev.max_range_km} km
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Mini progress bar */}
          <div className="hidden sm:block">
            <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', feasibilityBarColor(pct))}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 text-right">
              {ev.summary.feasible}/{ev.summary.total_routes} Routen
            </p>
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Route detail table */}
      {expanded && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="text-left px-4 py-2 font-medium">Route</th>
                <th className="text-right px-4 py-2 font-medium">Distanz</th>
                <th className="text-right px-4 py-2 font-medium">Energie</th>
                <th className="text-right px-4 py-2 font-medium">SOC Ankunft</th>
                <th className="text-right px-4 py-2 font-medium">Puffer</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ev.route_results.map((r: ReichweitenRouteResult, idx) => (
                <tr
                  key={idx}
                  className={r.feasibility !== 'feasible' ? 'bg-red-50/40' : 'bg-white'}
                >
                  <td className="px-4 py-2 text-slate-700 font-medium">
                    {r.route_name ?? r.route_id}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">{r.distance_km} km</td>
                  <td className="px-4 py-2 text-right text-slate-600">{r.energy_needed_kwh} kWh</td>
                  <td className={cn('px-4 py-2 text-right font-semibold', socColor(r.soc_arrival_pct, socMin))}>
                    {r.soc_arrival_pct}%
                  </td>
                  <td className={cn('px-4 py-2 text-right', r.range_margin_km > 0 ? 'text-slate-500' : 'text-red-600 font-medium')}>
                    {r.range_margin_km > 0 ? `+${r.range_margin_km} km` : `–${Math.abs(r.range_margin_km)} km`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <FeasibilityBadge status={r.feasibility} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: 'blue' | 'amber';
}) {
  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 rounded border',
      accent === 'blue' ? 'bg-[#e6f3fc] border-[#0079C0]/30' : 'bg-amber-50 border-amber-200'
    )}>
      <div className={cn(
        'mt-0.5 shrink-0',
        accent === 'blue' ? 'text-[#0079C0]' : 'text-[#C45600]'
      )}>
        {icon}
      </div>
      <div>
        <p className={cn('font-normal text-sm', accent === 'blue' ? 'text-[#001141]' : 'text-[#001141]')}>
          {title}
        </p>
        <p className={cn('text-xs mt-0.5', accent === 'blue' ? 'text-[#0079C0]' : 'text-[#C45600]')}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReichweitenResults() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [segmentFilter, setSegmentFilter] = useState<string>('all');

  const { data, isLoading, error } = useReichweitenLatest(projectId);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded" />)}
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded" />)}
      </div>
    );
  }

  if (error || !data || data.status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
        <h2 className="text-lg font-normal text-[#001141]">Keine Ergebnisse</h2>
        <p className="text-sm text-slate-400 mt-1">
          {data?.status === 'failed'
            ? 'Die Simulation ist fehlgeschlagen. Bitte versuche es erneut.'
            : 'Für dieses Projekt wurden noch keine Reichweiten-Simulationen durchgeführt.'}
        </p>
      </div>
    );
  }

  if (data.status === 'pending' || data.status === 'running') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-10 w-10 rounded-full border-4 border-[#e6f3fc] border-t-[#0079C0] animate-spin mb-3" />
        <h2 className="text-lg font-normal text-[#001141]">Analyse läuft...</h2>
        <p className="text-sm text-slate-400 mt-1">Die Reichweitenanalyse wird durchgeführt.</p>
      </div>
    );
  }

  const results = data.results;
  if (!results) return null;

  const { selected_ev_results, recommended_ev_results, has_selection, soc_min, soc_start } = results;

  // KPI stats
  const allEVs = [...selected_ev_results, ...recommended_ev_results];
  const shortestRoute = allEVs[0]?.route_results.length
    ? Math.min(...allEVs[0].route_results.map(r => r.distance_km))
    : 0;
  const longestRoute = Math.max(...(allEVs[0]?.route_results.map(r => r.distance_km) ?? [0]));
  const selectedPct = has_selection && selected_ev_results.length > 0
    ? selected_ev_results[0].summary.feasible_pct
    : null;
  const bestPct = allEVs.length > 0 ? Math.max(...allEVs.map(ev => ev.summary.feasible_pct)) : 0;
  const displayPct = selectedPct !== null ? selectedPct : bestPct;

  // Unique segments from recommendations
  const segments = ['all', ...Array.from(new Set(recommended_ev_results.map(ev => ev.segment)))];

  const filteredRecommendations = segmentFilter === 'all'
    ? recommended_ev_results
    : recommended_ev_results.filter(ev => ev.segment === segmentFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-[#001141]">Reichweiten Analyse</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            Elektrifizierbar / Nicht elektrifizierbar ·{' '}
            Nutzbare Batteriekapazität: {soc_start - soc_min}%
            <span className="relative group cursor-pointer">
              <Info className="h-3.5 w-3.5 text-slate-400 hover:text-[#0079C0] transition-colors" />
              <span className="absolute left-5 top-0 z-20 hidden group-hover:block w-64 bg-[#001141] text-white text-xs rounded p-3 shadow-lg leading-relaxed">
                Bewertet, ob Touren elektrisch durchführbar sind. Das Fahrzeug startet mit <strong>{soc_start}%</strong> Ladestand und muss mit mindestens <strong>{soc_min}%</strong> Reserve ankommen. Nutzbar sind damit <strong>{soc_start - soc_min}%</strong> der Batteriekapazität pro Tour.
              </span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            PDF exportieren
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Zum Dashboard
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-[#e6f3fc] rounded border border-[#0079C0]/20">
        <Info className="h-3.5 w-3.5 text-[#0079C0] shrink-0" />
        <p className="text-xs text-[#001141]">
          Fahrbedingungen (Temperatur, HVAC, Nutzungsmix) wurden pro Tour individuell definiert.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Elektrifizierbarkeit"
          value={`${displayPct}%`}
          unit={selectedPct !== null ? "der Routen — gewähltes Modell" : "der Routen — bestes Modell"}
          icon={CheckCircle2}
          color={displayPct === 100 ? "green" : displayPct >= 50 ? "amber" : "red"}
          tooltip={selectedPct !== null ? "Anteil elektifizierbarer Routen für das gewählte EV-Modell" : "Kein Modell gewählt — zeigt bestes Ergebnis aller analysierten Modelle"}
        />
        <KPICard
          title="Kürzeste Tour"
          value={String(shortestRoute)}
          unit="km"
          icon={Gauge}
          color="blue"
          tooltip="Kürzeste Tour im Projekt"
        />
        <KPICard
          title="Längste Tour"
          value={String(longestRoute)}
          unit="km (maßgeblich)"
          icon={Gauge}
          color="amber"
          tooltip="Längste Tour im Projekt – bestimmt die erforderliche Mindestreichweite"
        />
      </div>

      {/* ── Deine Auswahl ──────────────────────────────────────────────────── */}
      {has_selection && selected_ev_results.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            accent="blue"
            icon={<Zap className="h-4 w-4" />}
            title="Deine Auswahl"
            subtitle={`${selected_ev_results.length} Modell${selected_ev_results.length > 1 ? 'e' : ''} die du gewählt hast – detaillierte Analyse jeder Route`}
          />
          <div className="space-y-2">
            {selected_ev_results.map(ev => (
              <EVPanel key={ev.ev_model_id} ev={ev} socMin={soc_min} highlight />
            ))}
          </div>
        </div>
      )}

      {/* ── Empfehlungen ───────────────────────────────────────────────────── */}
      {recommended_ev_results.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            accent="amber"
            icon={<Star className="h-4 w-4" />}
            title={has_selection ? 'Empfehlungen — Beste Alternativen' : 'Beste EV-Modelle für deine Routen'}
            subtitle={
              has_selection
                ? 'Top-5 EV-Modelle aus der Bibliothek, sortiert nach Routenabdeckung'
                : 'Top-5 EV-Modelle aus der Bibliothek, sortiert nach Machbarkeit'
            }
          />

          {/* Segment filter */}
          {segments.length > 2 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">Segment:</span>
              {segments.map(seg => (
                <button
                  key={seg}
                  onClick={() => setSegmentFilter(seg)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    segmentFilter === seg
                      ? 'bg-[#0079C0] text-white border-[#0079C0]'
                      : 'border-slate-200 text-slate-600 hover:border-[#0079C0]/50'
                  )}
                >
                  {seg === 'all' ? 'Alle' : seg.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {filteredRecommendations.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Keine Empfehlungen für dieses Segment.
              </p>
            ) : (
              filteredRecommendations.map((ev, idx) => (
                <EVPanel key={ev.ev_model_id} ev={ev} socMin={soc_min} rank={idx} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 px-4 py-3 bg-slate-50 rounded border border-slate-200">
        <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500">
          Die Analyse berücksichtigt Nutzlast, Durchschnittsgeschwindigkeit und Streckenprofil.
          SOC-Reserve von {soc_min}% schützt die Batterie und deckt unvorhergesehene Umwege ab.
          Berechnet am {new Date(results.created_at).toLocaleDateString('de-DE')}.
        </p>
      </div>

      {/* Bottom finish button */}
      <div className="flex justify-end pt-2 pb-4">
        <Button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Fertig – Zum Dashboard
        </Button>
      </div>
    </div>
  );
}
