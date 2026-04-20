/**
 * EVLastgangChart — reusable EV charging load profile (dumb charging, no optimisation).
 * Used in both FleetResults and InfrastructureResults.
 */
import { useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
} from 'recharts';
import { Activity, BatteryFull, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKWh, formatKW } from '@/lib/utils';

const SLOT_MIN   = 15;
const TOTAL_SLOTS = 96;

const TOUR_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316',
  '#6366f1','#14b8a6',
];

function slotToTime(slot: number) {
  const m = slot * SLOT_MIN;
  return `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
}

function timeToSlot(time: string | null | undefined, fallback = 72): number {
  if (!time) return fallback;
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return fallback;
  return Math.min(TOTAL_SLOTS - 1, Math.floor((h * 60 + m) / SLOT_MIN));
}

function simulateTourCharging(
  energyKwh: number,
  arrivalSlot: number,
  powerKw: number,
  efficiency: number,
  departureSlot: number = TOTAL_SLOTS,
): number[] {
  const energyPerSlot = powerKw * (SLOT_MIN / 60) * efficiency;
  let remaining = energyKwh;
  const slots = new Array<number>(TOTAL_SLOTS).fill(0);
  const windowEnd = departureSlot <= arrivalSlot ? departureSlot + TOTAL_SLOTS : departureSlot;
  for (let s = arrivalSlot; s < windowEnd && remaining > 1e-6; s++) {
    const slot = s % TOTAL_SLOTS;
    if (remaining >= energyPerSlot) {
      slots[slot] = powerKw;
      remaining -= energyPerSlot;
    } else {
      slots[slot] = Math.round((remaining / (SLOT_MIN / 60) / efficiency) * 10) / 10;
      remaining = 0;
    }
  }
  return slots;
}

function computeSoCProfile(
  powerSlots: number[],
  arrivalSlot: number,
  efficiency: number,
  socAtArrivalPct: number,
  socTargetPct: number,
  batteryUsableKwh: number,
  departureSlot: number = TOTAL_SLOTS,
): number[] {
  const socs = new Array<number>(TOTAL_SLOTS).fill(NaN);
  let soc = socAtArrivalPct;
  const windowEnd = departureSlot <= arrivalSlot ? departureSlot + TOTAL_SLOTS : departureSlot;
  for (let s = arrivalSlot; s < windowEnd; s++) {
    const slot = s % TOTAL_SLOTS;
    socs[slot] = +Math.min(socTargetPct, soc).toFixed(2);
    if (soc >= socTargetPct - 0.01) {
      for (let ss = s + 1; ss < windowEnd; ss++) socs[ss % TOTAL_SLOTS] = socTargetPct;
      break;
    }
    const energyIn = powerSlots[slot] * (SLOT_MIN / 60) * efficiency;
    soc = Math.min(100, soc + (energyIn / batteryUsableKwh) * 100);
  }
  return socs;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RouteResult {
  route_id?: string;
  vehicle_id?: string;
  vehicle_count?: number | string;
  ev_energy_kwh?: number | string;
  distance_km?: number | string;
  end_time?: string | null;
  start_time?: string | null;
  date?: string | null;
  [key: string]: unknown;
}

interface VehicleResult {
  vehicle_id: string;
  recommended_ev_model?: {
    battery_usable_kwh?: number;
    nominal_consumption_kwh_100km?: number;
  } | null;
}

interface LastgangProfile {
  intervals: { time: string; power_kw: number | string }[];
  max_grid_connection_kw: number;
  peak_kw: number;
  resolution_min: number;
  rows_total: number;
}

interface Props {
  routeResults: RouteResult[];
  vehicleResults?: VehicleResult[];
  chargingPowerKw: number;
  chargingEfficiency: number;
  socTarget: number;
  lastgangProfile?: LastgangProfile | null;
  /** Optional card title override */
  title?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EVLastgangChart({
  routeResults,
  vehicleResults = [],
  chargingPowerKw,
  chargingEfficiency,
  socTarget,
  lastgangProfile,
  title,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const hasLastgang  = !!(lastgangProfile && lastgangProfile.intervals.length > 0);
  const gridLimit    = lastgangProfile?.max_grid_connection_kw ?? 200;

  // ── Dates ────────────────────────────────────────────────────────────────
  const availableDates = [...new Set(
    routeResults.map(r => r.date as string | undefined).filter((d): d is string => !!d)
  )].sort();
  const effectiveDate = selectedDate ?? (availableDates[0] ?? null);

  // ── Tours ────────────────────────────────────────────────────────────────
  // Expand routes by vehicle_count: a route with 3 vehicles → 3 tour entries
  const allEvTours = routeResults
    .filter(r => Number(r.ev_energy_kwh) > 0)
    .flatMap((r, i) => {
      const count = Math.max(1, Number(r.vehicle_count) || 1);
      return Array.from({ length: count }, (_, vi) => ({
        id:         `${r.route_id || `tour_${i}`}_v${vi}`,
        vehicleId:  r.vehicle_id ?? '',
        distanceKm: Number(r.distance_km),
        endTime:    r.end_time   ?? null,
        startTime:  r.start_time ?? null,
        date:       r.date ?? null,
      }));
    });

  const evTours = availableDates.length > 0 && effectiveDate
    ? allEvTours.filter(t => t.date === effectiveDate)
    : allEvTours;

  // Next departure slot per tour (for charging deadline)
  const nextDepartureSlotMap = new Map<string, number>();
  if (availableDates.length > 0) {
    const sorted = [...allEvTours].sort((a, b) => {
      const da = (a.date ?? '') + 'T' + (a.startTime ?? '00:00');
      const db = (b.date ?? '') + 'T' + (b.startTime ?? '00:00');
      return da < db ? -1 : da > db ? 1 : 0;
    });
    evTours.forEach(tour => {
      const next = sorted.find(
        t => t.vehicleId === tour.vehicleId && t.date !== null && tour.date !== null && t.date > tour.date
      );
      if (next?.startTime) nextDepartureSlotMap.set(tour.id, timeToSlot(next.startTime));
    });
  }

  // ── EV specs ─────────────────────────────────────────────────────────────
  const DEFAULT_BATTERY      = 75;
  const DEFAULT_CONSUMPTION  = 28;
  const vehicleEVMap = new Map<string, { batteryKwh: number; consumptionKwh100km: number }>(
    vehicleResults
      .filter(vr => vr.recommended_ev_model)
      .map(vr => [vr.vehicle_id, {
        batteryKwh:          vr.recommended_ev_model!.battery_usable_kwh ?? DEFAULT_BATTERY,
        consumptionKwh100km: vr.recommended_ev_model!.nominal_consumption_kwh_100km ?? DEFAULT_CONSUMPTION,
      }])
  );
  const allSpecs = [...vehicleEVMap.values()];
  const median = (arr: number[]) => arr.length ? [...arr].sort((a,b)=>a-b)[Math.floor(arr.length/2)] : 0;
  const medianBattery     = allSpecs.length > 0 ? median(allSpecs.map(s => s.batteryKwh))          : DEFAULT_BATTERY;
  const medianConsumption = allSpecs.length > 0 ? median(allSpecs.map(s => s.consumptionKwh100km)) : DEFAULT_CONSUMPTION;

  // ── Simulate each tour ───────────────────────────────────────────────────
  // Group vehicleIds to assign consistent colors + dash patterns per vehicle type
  const uniqueVehicleIds = [...new Set(evTours.map(t => t.vehicleId).filter(Boolean))];
  const vehicleGroupMap = new Map(uniqueVehicleIds.map((vid, gi) => [vid, gi]));
  // Dash patterns per vehicle group: solid, dashed, dotted, dash-dot…
  const GROUP_DASHES = ['0', '6 3', '2 2', '8 3 2 3'];
  // Color palettes per group (each group gets its own hue family)
  const GROUP_COLOR_PALETTES = [
    ['#3b82f6','#1d4ed8','#60a5fa','#93c5fd','#2563eb','#1e40af','#bfdbfe','#dbeafe'],
    ['#10b981','#065f46','#34d399','#6ee7b7','#059669','#047857','#a7f3d0','#d1fae5'],
    ['#f59e0b','#92400e','#fbbf24','#fde68a','#d97706','#b45309','#fef3c7','#fffbeb'],
    ['#8b5cf6','#4c1d95','#a78bfa','#c4b5fd','#7c3aed','#5b21b6','#ede9fe','#f5f3ff'],
  ];
  const vehicleCounterMap = new Map<string, number>();

  const tourProfiles = evTours.map((tour, i) => {
    const arrival      = timeToSlot(tour.endTime);
    const specs        = vehicleEVMap.get(tour.vehicleId);
    const batteryKwh   = specs?.batteryKwh ?? medianBattery;
    const consumption  = specs?.consumptionKwh100km ?? medianConsumption;
    const energyKwh    = (tour.distanceKm / 100) * consumption;
    const socAtArrival = Math.max(0, socTarget - (energyKwh / batteryKwh) * 100);
    const toCharge     = Math.max(0, (socTarget - socAtArrival) / 100 * batteryKwh);
    const deptSlot     = nextDepartureSlotMap.get(tour.id) ?? TOTAL_SLOTS;
    const powerSlots   = simulateTourCharging(toCharge, arrival, chargingPowerKw, chargingEfficiency, deptSlot);
    const socSlots     = computeSoCProfile(powerSlots, arrival, chargingEfficiency, socAtArrival, socTarget, batteryKwh, deptSlot);

    // Assign color + dash based on vehicle type group
    const groupIdx = vehicleGroupMap.get(tour.vehicleId) ?? (i % GROUP_COLOR_PALETTES.length);
    const withinGroup = vehicleCounterMap.get(tour.vehicleId) ?? 0;
    vehicleCounterMap.set(tour.vehicleId, withinGroup + 1);
    const palette = GROUP_COLOR_PALETTES[groupIdx % GROUP_COLOR_PALETTES.length];
    const color = uniqueVehicleIds.length > 1
      ? palette[withinGroup % palette.length]
      : TOUR_COLORS[i % TOUR_COLORS.length];
    const dash = uniqueVehicleIds.length > 1
      ? GROUP_DASHES[groupIdx % GROUP_DASHES.length]
      : '0';
    // Label: if multiple vehicle types, prefix with "Typ A/B/…"
    const typePrefix = uniqueVehicleIds.length > 1
      ? `Typ ${String.fromCharCode(65 + groupIdx)} – `
      : '';
    const tourNum = withinGroup + 1;

    return {
      id: tour.id,
      label: `${typePrefix}Tour ${tourNum}`,
      color,
      strokeDash: dash,
      groupIdx,
      slots: powerSlots, socs: socSlots, batteryKwh, socAtArrival,
    };
  });

  // ── Build chart arrays ────────────────────────────────────────────────────
  const depotMap = hasLastgang
    ? new Map(lastgangProfile!.intervals.map(({ time, power_kw }) => [time, Number(power_kw)]))
    : new Map<string, number>();

  const chartData = Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
    const time = slotToTime(slot);
    const point: Record<string, number | string> = { time };
    tourProfiles.forEach((p, i) => { point[`t${i}`] = p.slots[slot]; });
    point.total_kw = tourProfiles.reduce((s, p) => s + (Number(p.slots[slot]) || 0), 0);
    point.total_kw_fill = point.total_kw; // mirror for Area fill (keeps Line tooltip as plain number)
    if (hasLastgang) point.depot_kw = depotMap.get(time) ?? 0;
    return point;
  });

  const socChartData = Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
    const point: Record<string, number | string | null> = { time: slotToTime(slot) };
    tourProfiles.forEach((p, i) => {
      const v = p.socs[slot];
      point[`soc_t${i}`] = isNaN(v) ? null : v;
    });
    return point;
  });

  const evPeak       = Math.max(0, ...chartData.map(d => d.total_kw as number));
  const depotPeak    = hasLastgang ? lastgangProfile!.peak_kw : 0;
  const combinedPeak = hasLastgang
    ? Math.max(0, ...chartData.map(d => (d.depot_kw as number) + (d.total_kw as number)))
    : evPeak;
  const overLimit    = combinedPeak > gridLimit;
  const totalEvKwh   = evTours.reduce((s, t) => {
    const c = vehicleEVMap.get(t.vehicleId)?.consumptionKwh100km ?? medianConsumption;
    return s + (t.distanceKm / 100) * c;
  }, 0);

  // Check if all tours are using the fallback arrival time (no real end_time data)
  const hasRealArrivalTimes = allEvTours.some(t => t.endTime !== null);

  if (evTours.length === 0 && !hasLastgang) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" />
            {title ?? 'EV-Ladevorgang – Lastverlauf'}
            {effectiveDate ? ` (${effectiveDate})` : ' (typischer Tag)'}
          </CardTitle>
          {availableDates.length > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-slate-400" />
              <select
                className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0079C0]"
                value={effectiveDate ?? ''}
                onChange={e => setSelectedDate(e.target.value || null)}
              >
                {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <span className="text-xs text-slate-400">{availableDates.length} Tage</span>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Ungesteuertes Laden — Ladestart sofort ab Ankunft, Ende bei Erreichen SoC-Ziel ({socTarget} %).
          {!hasRealArrivalTimes && <span className="text-[#C45600]"> Ankunftszeit geschätzt (18:00 Uhr), da keine Tourdaten mit Zeitstempeln vorhanden.</span>}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {overLimit && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Die kombinierte Last überschreitet den Netzanschluss von <strong>{gridLimit} kW</strong>.
              Spitzenwert: <strong>{combinedPeak.toFixed(0)} kW</strong>. Lastmanagement empfohlen.
            </AlertDescription>
          </Alert>
        )}

        {/* Power chart */}
        <div>
          {/* Manual legend */}
          <div className="flex flex-wrap items-center gap-4 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-[#94a3b8]" style={{ background: 'repeating-linear-gradient(to right,#94a3b8 0,#94a3b8 4px,transparent 4px,transparent 8px)' }} />
              <div className="w-3 h-3 rounded-sm bg-[#94a3b8] opacity-20 border border-[#94a3b8]" />
              <span className="text-slate-500">Einzelnes Fahrzeug (Ladeleistung)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5" style={{ background: '#f97316' }} />
              <span className="text-slate-700 font-medium">Gesamtlast Flotte am Netzanschluss</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 border-t-2 border-dashed border-red-500" />
              <span className="text-red-600 font-medium">Max. Anschlussleistung ({gridLimit} kW)</span>
            </div>
            {hasLastgang && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-400" />
                <span className="text-slate-500">Bestandslast Depot</span>
              </div>
            )}
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={3} tickFormatter={t => t.endsWith(':00') ? t : ''} />
              <YAxis unit=" kW" tick={{ fontSize: 10 }} width={52}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15) || 10]} />
              <Tooltip
                content={({ active, label, payload }) => {
                  if (!active || !payload) return null;
                  const total = payload.find(p => p.dataKey === 'total_kw');
                  const tours = payload.filter(p => String(p.dataKey).startsWith('t') && !p.dataKey.toString().startsWith('to'));
                  const activeTours = tours.filter(t => (t.value as number) > 0);
                  return (
                    <div className="bg-white border border-slate-200 rounded p-2.5 text-xs shadow-md min-w-[180px]">
                      <p className="font-semibold text-slate-700 mb-1.5">{label} Uhr</p>
                      {total && (
                        <div className="flex justify-between gap-3 font-semibold text-orange-600 mb-1">
                          <span>Gesamtlast Flotte:</span>
                          <span>{Number(total.value).toFixed(1)} kW</span>
                        </div>
                      )}
                      {activeTours.length > 0 && (
                        <div className="border-t border-slate-100 pt-1 mt-1 space-y-0.5">
                          <p className="text-slate-400 text-[10px] mb-1">Einzelne Fahrzeuge:</p>
                          {activeTours.map(t => (
                            <div key={t.dataKey as string} className="flex justify-between gap-3 text-slate-500">
                              <span>{tourProfiles[Number(String(t.dataKey).slice(1))]?.label}:</span>
                              <span>{Number(t.value).toFixed(1)} kW</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {Number(total?.value) > gridLimit && (
                        <div className="border-t border-red-100 pt-1 mt-1 text-red-600 text-[10px]">
                          ⚠ Überschreitet Netzlimit um {(Number(total?.value) - gridLimit).toFixed(0)} kW
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {/* Red zone above grid limit */}
              {overLimit && <ReferenceArea y1={gridLimit} fill="#ef4444" fillOpacity={0.06} />}
              {/* Individual vehicle areas — light, behind total */}
              {tourProfiles.map((_, i) => (
                <Area key={`t${i}`} type="stepAfter" dataKey={`t${i}`}
                  stroke="#94a3b8" strokeWidth={0.5} fill="#94a3b8" fillOpacity={0.12}
                  dot={false} legendType="none" isAnimationActive={false} />
              ))}
              {/* Orange fill for total — uses separate key so tooltip payload stays a plain number */}
              <Area type="stepAfter" dataKey="total_kw_fill" stroke="none" strokeWidth={0}
                fill="#f97316" fillOpacity={0.1} dot={false} legendType="none" isAnimationActive={false} />
              {/* Fleet total line — bold orange, on top */}
              <Line type="stepAfter" dataKey="total_kw" stroke="#f97316" strokeWidth={2.5}
                dot={false} legendType="none" isAnimationActive={false} />
              {/* Max Anschlussleistung */}
              <ReferenceLine y={gridLimit} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3"
                label={{ value: `${gridLimit} kW`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444', fontWeight: 700 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* SoC chart */}
        {tourProfiles.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <BatteryFull className="h-3 w-3" />
                SOC-Verlauf je Tour (ab Ankunftszeit)
              </p>
              {uniqueVehicleIds.length > 1 && (
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  {uniqueVehicleIds.map((_, gi) => (
                    <span key={gi} className="flex items-center gap-1">
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4"
                        stroke={GROUP_COLOR_PALETTES[gi % GROUP_COLOR_PALETTES.length][0]}
                        strokeWidth="2"
                        strokeDasharray={GROUP_DASHES[gi % GROUP_DASHES.length]} /></svg>
                      Typ {String.fromCharCode(65 + gi)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={socChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={3} tickFormatter={t => t.endsWith(':00') ? t : ''} />
                <YAxis unit=" %" domain={[0, Math.min(100, socTarget + 5)]} tick={{ fontSize: 10 }} width={42} />
                <Tooltip
                  content={({ active, label, payload }) => {
                    if (!active || !payload?.length) return null;
                    const active_tours = payload.filter(p => p.value != null);
                    if (!active_tours.length) return null;
                    return (
                      <div className="bg-white border border-slate-200 rounded p-2 text-xs shadow-md">
                        <p className="font-semibold mb-1">{label} Uhr</p>
                        {active_tours.map((p, j) => (
                          <p key={j} style={{ color: p.stroke as string }}>
                            {tourProfiles[Number(String(p.dataKey).replace('soc_t', ''))]?.label}: {Number(p.value).toFixed(1)} %
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={socTarget} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: `SoC-Ziel ${socTarget} %`, position: 'insideTopRight', fontSize: 10, fill: '#10b981' }} />
                {tourProfiles.map((p, i) => (
                  <Line key={`soc_t${i}`} type="monotone" dataKey={`soc_t${i}`}
                    stroke={p.color} strokeWidth={1.8} dot={false} connectNulls={false}
                    strokeDasharray={p.strokeDash} name={p.label} isAnimationActive={false} />
                ))}
                {tourProfiles.length <= 8 && <Legend wrapperStyle={{ fontSize: 10 }} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Depot overlay (only if lastgang provided) */}
        {hasLastgang && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">
              Depot-Bestandslast + EV-Laden (Überlagerung am GCP)
            </p>
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(1, Math.round(60 / lastgangProfile!.resolution_min)) - 1}
                  tickFormatter={t => t.endsWith(':00') ? t : ''} />
                <YAxis unit=" kW" tick={{ fontSize: 10 }} width={52} />
                <Tooltip formatter={(val: number, name: string) => [`${Number(val).toFixed(1)} kW`, name === 'depot_kw' ? 'Bestandslast Depot' : 'EV-Laden (Flotte)']} labelFormatter={l => `${l} Uhr`} />
                <Area type="monotone" dataKey="depot_kw" stackId="load" fill="#dbeafe" stroke="#3b82f6" strokeWidth={1.5} name="depot_kw" />
                <Area type="stepAfter" dataKey="total_kw" stackId="load" fill="#fed7aa" stroke="#f97316" strokeWidth={1.5} name="total_kw" />
                <ReferenceLine y={gridLimit} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: `Netzlimit ${gridLimit} kW`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
                <Legend formatter={v => v === 'depot_kw' ? 'Bestandslast Depot' : 'EV-Laden (Flotte)'} wrapperStyle={{ fontSize: 11 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {hasLastgang && (
            <div className="text-center p-2 bg-[#e6f3fc] rounded">
              <p className="font-semibold text-[#001141]">{Number(depotPeak).toFixed(0)} kW</p>
              <p className="text-slate-500">Depot-Spitze</p>
            </div>
          )}
          <div className="text-center p-2 bg-orange-50 rounded">
            <p className="font-semibold text-[#C45600]">{evPeak.toFixed(0)} kW</p>
            <p className="text-slate-500">EV-Peak (GCP)</p>
          </div>
          {hasLastgang && (
            <div className={`text-center p-2 rounded ${overLimit ? 'bg-red-50' : 'bg-[#e8f5f0]'}`}>
              <p className={`font-semibold ${overLimit ? 'text-red-900' : 'text-[#043F2E]'}`}>{combinedPeak.toFixed(0)} kW</p>
              <p className="text-slate-500">Kombiniert Peak</p>
            </div>
          )}
          <div className="text-center p-2 bg-slate-50 rounded">
            <p className="font-semibold text-[#001141]">{totalEvKwh.toFixed(0)} kWh</p>
            <p className="text-slate-500">Energie/Tag</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded">
            <p className="font-semibold text-[#001141]">{evTours.length}</p>
            <p className="text-slate-500">Touren mit Ladebedarf</p>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Simulation: ungesteuertes Laden ab Ankunftszeit, max. {formatKW(chargingPowerKw)} (η = {chargingEfficiency}).
          SoC-Ziel: {socTarget} %. SoC bei Ankunft aus Energieverbrauch + Batteriekapazität (EV-Modell).
          {hasLastgang && ` Bestandslast: Tagesdurchschnitt aus ${lastgangProfile!.rows_total.toLocaleString('de-DE')} Messwerten.`}
        </p>
      </CardContent>
    </Card>
  );
}
