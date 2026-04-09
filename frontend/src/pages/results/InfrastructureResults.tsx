import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Zap, AlertTriangle, BatteryCharging, Activity, BatteryFull, FileDown, Home, Calendar } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useProjectStore } from '@/store/projectStore';
import { useSimulationResults } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import KPICard from '@/components/shared/KPICard';
import { formatKWh, formatKW, formatNumber } from '@/lib/utils';

const SLOT_MIN = 15;
const TOTAL_SLOTS = 96;

const TOUR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#6366f1', '#14b8a6',
];

function slotToTime(slot: number) {
  const totalMin = slot * SLOT_MIN;
  return `${Math.floor(totalMin / 60).toString().padStart(2, '0')}:${(totalMin % 60).toString().padStart(2, '0')}`;
}

/** Converts a "HH:MM" time string to a 15-min slot index (0–95). */
function timeToSlot(time: string | null | undefined, fallbackSlot = 72): number {
  if (!time) return fallbackSlot; // default: 18:00
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return fallbackSlot;
  return Math.min(TOTAL_SLOTS - 1, Math.floor((parts[0] * 60 + parts[1]) / SLOT_MIN));
}

/**
 * Simulates the charging profile for a single tour/vehicle.
 *
 * From the arrival slot onwards the vehicle charges at max power each 15-min slot.
 * In the last slot the power is reduced proportionally so that the SoC target is
 * hit exactly without overshoot.
 *
 * Returns an array of 96 power values (kW) indexed by slot.
 */
/**
 * departureSlot: the slot by which the vehicle must depart (hard deadline).
 * Supports overnight charging: if departureSlot < arrivalSlot the window wraps
 * around midnight (e.g. arrival=72=18:00, departure=24=06:00 next day → 12h window).
 * Default TOTAL_SLOTS means "no deadline, charge until battery full or end of day".
 */
function simulateTourCharging(
  energyKwh: number,
  arrivalSlot: number,
  chargingPowerKw: number,
  chargingEfficiency: number,
  departureSlot: number = TOTAL_SLOTS,
): number[] {
  const energyPerSlot = chargingPowerKw * (SLOT_MIN / 60) * chargingEfficiency;
  let remaining = energyKwh;
  const slots = new Array<number>(TOTAL_SLOTS).fill(0);

  // Effective window end (handle overnight wrap)
  const windowEnd = departureSlot <= arrivalSlot
    ? departureSlot + TOTAL_SLOTS   // e.g. depart 06:00 = slot 24+96 = 120
    : departureSlot;

  for (let s = arrivalSlot; s < windowEnd && remaining > 1e-6; s++) {
    const slot = s % TOTAL_SLOTS;
    if (remaining >= energyPerSlot) {
      slots[slot] = chargingPowerKw;
      remaining -= energyPerSlot;
    } else {
      slots[slot] = Math.round((remaining / (SLOT_MIN / 60) / chargingEfficiency) * 10) / 10;
      remaining = 0;
    }
  }

  return slots;
}

/**
 * Derives the SoC (%) profile from a pre-computed power-slot array.
 *
 * Uses the actual battery capacity from the EV model so the SoC scale is
 * absolute (0 % = empty, 100 % = full battery_usable_kwh).
 *
 * Returns NaN for slots before arrival (Recharts renders these as gaps).
 */
function computeSoCProfile(
  powerSlots: number[],
  arrivalSlot: number,
  chargingEfficiency: number,
  socAtArrivalPct: number,
  socTargetPct: number,
  batteryUsableKwh: number,
  departureSlot: number = TOTAL_SLOTS,
): number[] {
  const socs = new Array<number>(TOTAL_SLOTS).fill(NaN);
  let soc = socAtArrivalPct;

  const windowEnd = departureSlot <= arrivalSlot
    ? departureSlot + TOTAL_SLOTS
    : departureSlot;

  for (let s = arrivalSlot; s < windowEnd; s++) {
    const slot = s % TOTAL_SLOTS;
    socs[slot] = +Math.min(socTargetPct, soc).toFixed(2);
    if (soc >= socTargetPct - 0.01) {
      // Fill remaining slots in window with socTargetPct
      for (let ss = s + 1; ss < windowEnd; ss++) socs[ss % TOTAL_SLOTS] = socTargetPct;
      break;
    }
    const energyIn = powerSlots[slot] * (SLOT_MIN / 60) * chargingEfficiency;
    soc = Math.min(100, soc + (energyIn / batteryUsableKwh) * 100);
  }

  return socs;
}

export default function InfrastructureResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeRunId, lastgangProfile, wizard, setActiveProject, setActiveRunId, setActiveScenarioId, setLastgangProfile } = useProjectStore();
  const navigate = useNavigate();
  const { data: results, isLoading } = useSimulationResults(activeRunId ?? undefined);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // ── Charging simulation ───────────────────────────────────────────────────
  // NOTE: r.ev_energy_kwh in route_results is annualised (× annual_trips).
  // For the per-trip SoC simulation we derive per-trip energy from distance_km
  // × nominal EV consumption (kWh/100km) from vehicle_results.

  // Extract unique sorted dates from route_results (only for CSV/manual uploads that carry date)
  const availableDates = [...new Set(
    (results?.route_results ?? [])
      .map(r => (r as unknown as { date?: string }).date)
      .filter((d): d is string => !!d)
  )].sort();

  // Effective date: use selectedDate if valid, else first available, else null (show all)
  const effectiveDate = selectedDate ?? (availableDates[0] ?? null);

  const allEvTours = (results?.route_results ?? [])
    .filter(r => Number(r.ev_energy_kwh) > 0)
    .map((r, i) => ({
      id:         r.route_id || `tour_${i}`,
      vehicleId:  r.vehicle_id ?? '',
      distanceKm: Number(r.distance_km),
      endTime:    r.end_time   ?? null,   // Ankunftszeit im Depot
      startTime:  r.start_time ?? null,   // Abfahrtszeit (für nächste Tour desselben Fahrzeugs)
      date:       (r as unknown as { date?: string }).date ?? null,
    }));

  // Filter by selected date if dates are available
  const evTours = availableDates.length > 0 && effectiveDate
    ? allEvTours.filter(t => t.date === effectiveDate)
    : allEvTours;

  // For each tour of the selected day, find the next tour of the SAME vehicle
  // (next calendar day or later) to determine the hard charging deadline.
  // nextDepartureSlot: the slot by which charging must be complete.
  const nextDepartureSlotMap = new Map<string, number>();
  if (availableDates.length > 0) {
    // Sort all tours chronologically per vehicle
    const toursChron = [...allEvTours].sort((a, b) => {
      const dateA = (a.date ?? '') + 'T' + (a.startTime ?? '00:00');
      const dateB = (b.date ?? '') + 'T' + (b.startTime ?? '00:00');
      return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
    });
    evTours.forEach(tour => {
      // Find the next tour for this vehicle after the current day
      const next = toursChron.find(
        t => t.vehicleId === tour.vehicleId &&
             t.date !== null && tour.date !== null &&
             t.date > tour.date
      );
      if (next?.startTime) {
        nextDepartureSlotMap.set(tour.id, timeToSlot(next.startTime));
      }
    });
  }

  const powerKw      = Number(infra?.avg_charging_power_kw ?? wizard.step4?.charging_power_kw ?? 22);
  const efficiency   = wizard.step4?.charging_efficiency ?? 0.92;
  const socTarget    = wizard.step4?.soc_target ?? 80;
  const gridLimit    = lastgangProfile?.max_grid_connection_kw ?? 200;
  const hasLastgang  = !!(lastgangProfile && lastgangProfile.intervals.length > 0);

  // vehicle_id → EV model specs (battery + nominal consumption)
  const DEFAULT_BATTERY_KWH     = 75;
  const DEFAULT_CONSUMPTION_KWH = 28; // kWh/100km
  const vehicleEVMap = new Map<string, { batteryKwh: number; consumptionKwh100km: number }>(
    (results?.vehicle_results ?? [])
      .filter(vr => vr.recommended_ev_model)
      .map(vr => [vr.vehicle_id, {
        batteryKwh:          vr.recommended_ev_model!.battery_usable_kwh   ?? DEFAULT_BATTERY_KWH,
        consumptionKwh100km: vr.recommended_ev_model!.nominal_consumption_kwh_100km ?? DEFAULT_CONSUMPTION_KWH,
      }])
  );

  // Fallback: median battery + median consumption across all vehicle results
  const allSpecs = [...vehicleEVMap.values()];
  const medianBattery = allSpecs.length > 0
    ? [...allSpecs.map(s => s.batteryKwh)].sort((a, b) => a - b)[Math.floor(allSpecs.length / 2)]
    : DEFAULT_BATTERY_KWH;
  const medianConsumption = allSpecs.length > 0
    ? [...allSpecs.map(s => s.consumptionKwh100km)].sort((a, b) => a - b)[Math.floor(allSpecs.length / 2)]
    : DEFAULT_CONSUMPTION_KWH;

  const tourProfiles = evTours.map((tour, i) => {
    const arrival    = timeToSlot(tour.endTime);
    const specs      = vehicleEVMap.get(tour.vehicleId);
    const batteryKwh = specs?.batteryKwh ?? medianBattery;
    const consumption = specs?.consumptionKwh100km ?? medianConsumption;

    // Per-trip energy consumed from battery (derived from distance × nominal consumption)
    const energyConsumedKwh = (tour.distanceKm / 100) * consumption;

    // Actual SoC at depot arrival = soc_target (departure) − energy consumed during tour
    // soc_min is only used for feasibility check in the backend — NOT as arrival SoC
    const socAtArrival = Math.max(0, socTarget - (energyConsumedKwh / batteryKwh) * 100);

    // Energy needed to recharge from arrival SoC back to soc_target
    const energyToCharge = Math.max(0, (socTarget - socAtArrival) / 100 * batteryKwh);
    const departureSlot  = nextDepartureSlotMap.get(tour.id) ?? TOTAL_SLOTS;
    const powerSlots = simulateTourCharging(energyToCharge, arrival, powerKw, efficiency, departureSlot);
    const socSlots   = computeSoCProfile(powerSlots, arrival, efficiency, socAtArrival, socTarget, batteryKwh, departureSlot);
    return {
      id:        tour.id,
      label:     `Tour ${i + 1}`,
      color:     TOUR_COLORS[i % TOUR_COLORS.length],
      slots:     powerSlots,
      socs:      socSlots,
      batteryKwh,
      socAtArrival,
    };
  });

  // Depot lastgang map for O(1) lookup by time string
  const depotMap = hasLastgang
    ? new Map(lastgangProfile!.intervals.map(({ time, power_kw }) => [time, Number(power_kw)]))
    : new Map<string, number>();

  // Build 96-point chart data — power chart
  const chartData = Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
    const time = slotToTime(slot);
    const point: Record<string, number | string> = { time };
    tourProfiles.forEach((p, i) => { point[`t${i}`] = p.slots[slot]; });
    point.total_kw = tourProfiles.reduce((sum, p) => sum + p.slots[slot], 0);
    if (hasLastgang) point.depot_kw = depotMap.get(time) ?? 0;
    return point;
  });

  // Build 96-point chart data — SoC chart (null = no line before arrival)
  const socChartData = Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
    const time = slotToTime(slot);
    const point: Record<string, number | string | null> = { time };
    tourProfiles.forEach((p, i) => {
      const v = p.socs[slot];
      point[`soc_t${i}`] = isNaN(v) ? null : v;
    });
    return point;
  });

  const evPeak       = Math.max(0, ...chartData.map(d => d.total_kw as number));
  const depotPeak    = hasLastgang ? (lastgangProfile!.peak_kw) : 0;
  const combinedPeak = hasLastgang
    ? Math.max(0, ...chartData.map(d => (d.depot_kw as number) + (d.total_kw as number)))
    : evPeak;
  const overLimit    = combinedPeak > gridLimit;
  // Total per-trip energy across all tours (for display)
  const totalEvKwh = evTours.reduce((s, t) => {
    const specs = vehicleEVMap.get(t.vehicleId);
    const consumption = specs?.consumptionKwh100km ?? medianConsumption;
    return s + (t.distanceKm / 100) * consumption;
  }, 0);

  const showChart = evTours.length > 0 || hasLastgang;

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

      {/* ── EV Charging profile chart ─────────────────────────────────────── */}
      {showChart && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />
                EV-Ladevorgang – Lastverlauf
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
                    {availableDates.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">{availableDates.length} Tage</span>
                </div>
              )}
            </div>
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

            {/* ── Per-tour + aggregated chart ──────────────────────────── */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                Ladeleistung je Tour & Flotte gesamt am GCP
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    interval={3}
                    tickFormatter={t => t.endsWith(':00') ? t : ''}
                  />
                  <YAxis unit=" kW" tick={{ fontSize: 10 }} width={58} />
                  <Tooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload) return null;
                      const total = payload.find(p => p.dataKey === 'total_kw');
                      const tours = payload.filter(p => String(p.dataKey).startsWith('t'));
                      return (
                        <div className="bg-white border border-slate-200 rounded p-2 text-xs shadow-md">
                          <p className="font-semibold mb-1">{label} Uhr</p>
                          {total && (
                            <p className="text-[#C45600] font-semibold">
                              Flotte gesamt: {Number(total.value).toFixed(1)} kW
                            </p>
                          )}
                          {tours.filter(t => (t.value as number) > 0).map(t => (
                            <p key={t.dataKey as string} className="text-slate-500">
                              {tourProfiles[Number(String(t.dataKey).slice(1))]?.label}: {Number(t.value).toFixed(1)} kW
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {/* Individual tour lines — thin, slate */}
                  {tourProfiles.map((_, i) => (
                    <Line
                      key={`t${i}`}
                      type="stepAfter"
                      dataKey={`t${i}`}
                      stroke="#94a3b8"
                      strokeWidth={1}
                      dot={false}
                      legendType="none"
                      isAnimationActive={false}
                    />
                  ))}
                  {/* Fleet aggregate — bold orange */}
                  <Line
                    type="stepAfter"
                    dataKey="total_kw"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={false}
                    name="Flotte gesamt (GCP)"
                  />
                  <ReferenceLine
                    y={gridLimit}
                    stroke="#ef4444"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: `Netzlimit ${gridLimit} kW`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
                  />
                  <Legend
                    formatter={v => v}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* ── SoC chart per tour ───────────────────────────────────── */}
            {tourProfiles.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <BatteryFull className="h-3 w-3" />
                  SOC-Verlauf je Tour (Ladevorgang ab Ankunftszeit)
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={socChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      interval={3}
                      tickFormatter={t => t.endsWith(':00') ? t : ''}
                    />
                    <YAxis
                      unit=" %"
                      domain={[0, Math.min(100, socTarget + 5)]}
                      tick={{ fontSize: 10 }}
                      width={48}
                    />
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
                                {tourProfiles[Number(String(p.dataKey).replace('soc_t', ''))]?.label}:{' '}
                                {Number(p.value).toFixed(1)} %
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {/* Reference line at SoC target */}
                    <ReferenceLine
                      y={socTarget}
                      stroke="#10b981"
                      strokeDasharray="5 3"
                      strokeWidth={1.5}
                      label={{ value: `SoC-Ziel ${socTarget} %`, position: 'insideTopRight', fontSize: 10, fill: '#10b981' }}
                    />
                    {/* One line per tour */}
                    {tourProfiles.map((p, i) => (
                      <Line
                        key={`soc_t${i}`}
                        type="monotone"
                        dataKey={`soc_t${i}`}
                        stroke={p.color}
                        strokeWidth={1.8}
                        dot={false}
                        connectNulls={false}
                        name={p.label}
                        isAnimationActive={false}
                      />
                    ))}
                    {tourProfiles.length <= 6 && (
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Depot + EV overlay chart (only if lastgang available) ── */}
            {hasLastgang && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Depot-Bestandslast + EV-Laden (Überlagerung am GCP)
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(1, Math.round(60 / lastgangProfile!.resolution_min)) - 1}
                      tickFormatter={t => t.endsWith(':00') ? t : ''}
                    />
                    <YAxis unit=" kW" tick={{ fontSize: 10 }} width={58} />
                    <Tooltip
                      formatter={(val: number, name: string) => [
                        `${Number(val).toFixed(1)} kW`,
                        name === 'depot_kw' ? 'Bestandslast Depot' : 'EV-Laden (Flotte)',
                      ]}
                      labelFormatter={l => `${l} Uhr`}
                    />
                    <Area
                      type="monotone"
                      dataKey="depot_kw"
                      stackId="load"
                      fill="#dbeafe"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      name="depot_kw"
                    />
                    <Area
                      type="stepAfter"
                      dataKey="total_kw"
                      stackId="load"
                      fill="#fed7aa"
                      stroke="#f97316"
                      strokeWidth={1.5}
                      name="total_kw"
                    />
                    <ReferenceLine
                      y={gridLimit}
                      stroke="#ef4444"
                      strokeDasharray="6 3"
                      strokeWidth={1.5}
                      label={{ value: `Netzlimit ${gridLimit} kW`, position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
                    />
                    <Legend
                      formatter={v => v === 'depot_kw' ? 'Bestandslast Depot' : 'EV-Laden (Flotte)'}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── KPI bar ──────────────────────────────────────────────── */}
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
                  <p className={`font-semibold ${overLimit ? 'text-red-900' : 'text-[#043F2E]'}`}>
                    {combinedPeak.toFixed(0)} kW
                  </p>
                  <p className="text-slate-500">Kombiniert Peak</p>
                </div>
              )}
              <div className="text-center p-2 bg-slate-50 rounded">
                <p className="font-semibold text-[#001141]">{totalEvKwh.toFixed(0)} kWh</p>
                <p className="text-slate-500">Energie/Tag</p>
              </div>
              <div className="text-center p-2 bg-slate-50 rounded">
                <p className="font-semibold text-[#001141]">{evTours.length} Touren</p>
                <p className="text-slate-500">mit Ladebedarf</p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Simulation: jede Tour lädt ab Ankunftszeit mit max. {powerKw} kW (η={efficiency}).
              SoC-Ziel: {socTarget} %. SoC bei Ankunft wird je Tour aus Energieverbrauch + Batteriekapazität (EV-Modell) berechnet.
              Ladestart = tatsächliche Ankunftszeit je Tour (aus end_time). Letzter Slot anteilig reduziert.
              {hasLastgang && ` Bestandslast: Tagesdurchschnitt aus ${lastgangProfile!.rows_total.toLocaleString('de-DE')} Messwerten.`}
            </p>
          </CardContent>
        </Card>
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
