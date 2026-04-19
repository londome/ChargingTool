import { useState } from 'react';
import { Upload, Edit, BarChart3, Plus, Trash2, CheckCircle, Loader2, Clock, Truck, Thermometer, Wind, ChevronDown, ChevronUp, Gauge } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useAddManualRoutes, useClearRoutes, uploadRoutes, useCreateFleet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileDropzone from '@/components/shared/FileDropzone';
import { VehicleSegment, FuelType, AcquisitionType, Fleet, FleetVehicle } from '@shared/types';
import { getSegmentLabel, getFuelTypeLabel, cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface VehicleType {
  segment: VehicleSegment;
  fuel_type: FuelType;
  count: number;
  consumption_l_100km: number;
  annual_km: number;
  payload_kg: number;
  capex: number;
  maintenance_cost_annual: number;
}

interface ManualRoute {
  route_id: string;
  distance_km: number;
  stops: number;
  departure_time: string;
  arrival_time: string;
  avg_speed_kmh: number;
  vehicle_count: number;
  vehicle_type_idx: number;
  trips_per_year: number;
  // Per-route driving conditions (Reichweiten module)
  sim_temperature_c: number;
  sim_hvac_on: boolean;
  sim_city_share: number;
  sim_rural_share: number;
  sim_hwy_share: number;
}

interface FleetEntry {
  segment: VehicleSegment;
  fuel_type: FuelType;
  vehicle_count: number;
  consumption_l_100km: number;
  annual_km: number;
  trips_per_year: number;
  payload_kg: number;
  capex: number;
  maintenance_cost_annual: number;
  departure_time: string;
  arrival_time: string;
  stops: number;
}


// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_VEHICLE: VehicleType = {
  segment: VehicleSegment.LARGE_VAN,
  fuel_type: FuelType.DIESEL,
  count: 1,
  consumption_l_100km: 9.5,
  annual_km: 30000,
  payload_kg: 900,
  capex: 55000,
  maintenance_cost_annual: 4000,
};

const DEFAULT_ROUTE: ManualRoute = {
  route_id: '',
  distance_km: 120,
  stops: 5,
  departure_time: '06:00',
  arrival_time: '18:00',
  avg_speed_kmh: 55,
  vehicle_count: 1,
  vehicle_type_idx: 0,
  trips_per_year: 250,
  sim_temperature_c: 15,
  sim_hvac_on: false,
  sim_city_share: 0.5,
  sim_rural_share: 0.3,
  sim_hwy_share: 0.2,
};

const SEGMENTS = Object.values(VehicleSegment);
const FUEL_TYPES = [FuelType.DIESEL, FuelType.PETROL, FuelType.CNG, FuelType.HEV, FuelType.PHEV];

function computeChargingWindowMin(departure: string, arrival: string): number {
  if (!departure || !arrival) return 60;
  const [dh, dm] = departure.split(':').map(Number);
  const [ah, am] = arrival.split(':').map(Number);
  if ([dh, dm, ah, am].some(isNaN)) return 60;
  const window = (dh * 60 + dm - (ah * 60 + am) + 1440) % 1440;
  return window === 0 ? 1440 : window;
}

function formatHours(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Step3MobilityProps {
  onFinish?: () => void;
  isFinishing?: boolean;
}

export default function Step3Mobility({ onFinish, isFinishing }: Step3MobilityProps = {}) {
  const { wizard, updateWizardStep2, setWizardFleetId, setWizardMobilityMode, setWizardStep } = useProjectStore();
  const addRoutes = useAddManualRoutes();
  const clearRoutes = useClearRoutes();
  const createFleet = useCreateFleet();

  const isReichweitenMode = wizard.wizardModule === 'reichweiten';
  const [tab, setTab] = useState<string>(wizard.step3MobilityMode ?? 'manual');

  // ── Manual tab state ─────────────────────────────────────────────────────
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([{ ...DEFAULT_VEHICLE }]);
  const [manualRoutes, setManualRoutes] = useState<ManualRoute[]>([
    { ...DEFAULT_ROUTE, route_id: 'TOUR_001' },
  ]);
  const [expandedConditions, setExpandedConditions] = useState<Set<number>>(new Set());

  // ── Fleet level tab state ────────────────────────────────────────────────
  const [fleetEntries, setFleetEntries] = useState<FleetEntry[]>([{
    segment: VehicleSegment.LARGE_VAN,
    fuel_type: FuelType.DIESEL,
    vehicle_count: 10,
    consumption_l_100km: 9.5,
    annual_km: 30000,
    trips_per_year: 250,
    payload_kg: 900,
    capex: 55000,
    maintenance_cost_annual: 4000,
    departure_time: '06:00',
    arrival_time: '18:00',
    stops: 5,
  }]);

  // ── CSV tab state ────────────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<{ imported: number; errors: string[] } | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleTabChange = (v: string) => {
    setTab(v);
    setWizardMobilityMode(v as 'upload' | 'manual' | 'fleet_level');
  };

  // ── Manual tab handlers ──────────────────────────────────────────────────

  const updateVehicleType = (idx: number, field: keyof VehicleType, value: string | number) => {
    const updated = [...vehicleTypes];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setVehicleTypes(updated);
  };

  const addVehicleType = () => setVehicleTypes([...vehicleTypes, { ...DEFAULT_VEHICLE }]);
  const removeVehicleType = (idx: number) => {
    if (vehicleTypes.length <= 1) return;
    setVehicleTypes(vehicleTypes.filter((_, i) => i !== idx));
    // Reset routes that referenced removed type
    setManualRoutes(manualRoutes.map(r => ({
      ...r,
      vehicle_type_idx: Math.min(r.vehicle_type_idx, vehicleTypes.length - 2),
    })));
  };

  const updateRoute = (idx: number, field: keyof ManualRoute, value: string | number) => {
    const updated = [...manualRoutes];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setManualRoutes(updated);
  };

  const addRoute = () => setManualRoutes([
    ...manualRoutes,
    { ...DEFAULT_ROUTE, route_id: `TOUR_${String(manualRoutes.length + 1).padStart(3, '0')}` },
  ]);

  const removeRoute = (idx: number) => setManualRoutes(manualRoutes.filter((_, i) => i !== idx));

  // ── Driving conditions helpers (Reichweiten mode) ────────────────────────
  const toggleConditions = (idx: number) =>
    setExpandedConditions(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const updateRouteCond = (idx: number, field: keyof ManualRoute, value: number | boolean) => {
    const updated = [...manualRoutes];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setManualRoutes(updated);
  };

  const updateRouteCondMix = (idx: number, city: number, rural: number, hwy: number) => {
    const updated = [...manualRoutes];
    updated[idx].sim_city_share = city;
    updated[idx].sim_rural_share = rural;
    updated[idx].sim_hwy_share = hwy;
    setManualRoutes(updated);
  };

  const handleManualSubmit = async () => {
    const projectId = wizard.projectId;
    // vehicleIds[i] = the DB id of fleet_vehicle for vehicleTypes[i]
    let vehicleIds: string[] = [];

    if (projectId && !projectId.startsWith('local_')) {
      try {
        const fleet = await createFleet.mutateAsync({
          project_id: projectId,
          vehicle_count: vehicleTypes.reduce((s, v) => s + v.count, 0),
          vehicles: vehicleTypes.map(v => ({
            segment: v.segment,
            fuel_type: v.fuel_type,
            count: v.count,
            consumption_l_100km: v.consumption_l_100km,
            annual_km: v.annual_km,
            payload_kg: v.payload_kg,
            capex: v.capex,
            maintenance_cost_annual: v.maintenance_cost_annual,
            acquisition_type: AcquisitionType.PURCHASE,
          })),
        }) as Fleet & { vehicles: FleetVehicle[] };
        if (fleet?.id) setWizardFleetId(fleet.id);
        vehicleIds = (fleet.vehicles ?? []).map(v => v.id);
      } catch (e) { console.error('Fleet error:', e); }
    }
    updateWizardStep2(vehicleTypes.map(v => ({ ...v, acquisition_type: AcquisitionType.PURCHASE, lease_monthly: null })));

    if (projectId) {
      // Clear existing routes first (replace semantics — prevents accumulation across wizard runs)
      await clearRoutes.mutateAsync(projectId).catch(console.warn);
      addRoutes.mutateAsync({
        project_id: projectId,
        routes: manualRoutes.map(r => {
          const vt = vehicleTypes[r.vehicle_type_idx] ?? vehicleTypes[0];
          const vehicleId = vehicleIds[r.vehicle_type_idx] ?? vehicleIds[0] ?? null;
          return {
            route_id: r.route_id,
            vehicle_id: vehicleId,
            distance_km: r.distance_km,
            stops: r.stops,
            dwell_time_min: computeChargingWindowMin(r.departure_time, r.arrival_time),
            avg_speed_kmh: r.avg_speed_kmh,
            payload_kg: vt.payload_kg,
            vehicle_count: r.vehicle_count,
            trips_per_year: r.trips_per_year,
            start_time: r.departure_time,
            end_time: r.arrival_time,
            source_type: 'manual' as const,
            sim_temperature_c: r.sim_temperature_c,
            sim_hvac_on: r.sim_hvac_on,
            sim_city_share: r.sim_city_share,
            sim_rural_share: r.sim_rural_share,
            sim_hwy_share: r.sim_hwy_share,
          };
        }),
      }).catch(console.warn);
    }
    onFinish ? onFinish() : setWizardStep(3);
  };

  // ── Fleet level handlers ─────────────────────────────────────────────────

  const updateFleetEntry = (idx: number, field: keyof FleetEntry, value: string | number) => {
    const updated = [...fleetEntries];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setFleetEntries(updated);
  };

  const addFleetEntry = () => setFleetEntries([...fleetEntries, {
    segment: VehicleSegment.MEDIUM_VAN,
    fuel_type: FuelType.DIESEL,
    vehicle_count: 5,
    consumption_l_100km: 8.5,
    annual_km: 25000,
    trips_per_year: 250,
    payload_kg: 800,
    capex: 45000,
    maintenance_cost_annual: 3500,
    departure_time: '06:00',
    arrival_time: '18:00',
    stops: 5,
  }]);

  const removeFleetEntry = (idx: number) => {
    if (fleetEntries.length <= 1) return;
    setFleetEntries(fleetEntries.filter((_, i) => i !== idx));
  };

  const handleFleetLevelNext = async () => {
    const projectId = wizard.projectId;
    let vehicleIds: string[] = [];

    if (projectId && !projectId.startsWith('local_')) {
      try {
        const fleet = await createFleet.mutateAsync({
          project_id: projectId,
          vehicle_count: fleetEntries.reduce((s, e) => s + e.vehicle_count, 0),
          vehicles: fleetEntries.map(e => ({
            segment: e.segment,
            fuel_type: e.fuel_type,
            count: e.vehicle_count,
            consumption_l_100km: e.consumption_l_100km,
            annual_km: e.annual_km,
            payload_kg: e.payload_kg,
            capex: e.capex,
            maintenance_cost_annual: e.maintenance_cost_annual,
            acquisition_type: AcquisitionType.PURCHASE,
          })),
        }) as Fleet & { vehicles: FleetVehicle[] };
        if (fleet?.id) setWizardFleetId(fleet.id);
        vehicleIds = (fleet.vehicles ?? []).map(v => v.id);
      } catch (e) { console.error('Fleet error:', e); }
    }
    updateWizardStep2(fleetEntries.map(e => ({
      segment: e.segment, fuel_type: e.fuel_type, count: e.vehicle_count,
      consumption_l_100km: e.consumption_l_100km, annual_km: e.annual_km,
      payload_kg: e.payload_kg, capex: e.capex, maintenance_cost_annual: e.maintenance_cost_annual,
      acquisition_type: AcquisitionType.PURCHASE, lease_monthly: null,
    })));

    if (projectId) {
      // Clear existing routes first (replace semantics)
      await clearRoutes.mutateAsync(projectId).catch(console.warn);
      addRoutes.mutateAsync({
        project_id: projectId,
        routes: fleetEntries.map((e, i) => ({
          route_id: `FLEET_${i + 1}`,
          vehicle_id: vehicleIds[i] ?? null,
          distance_km: Math.max(1, Math.round(e.annual_km / e.trips_per_year)),
          stops: e.stops,
          dwell_time_min: computeChargingWindowMin(e.departure_time, e.arrival_time),
          avg_speed_kmh: 55,
          payload_kg: e.payload_kg * 0.6,
          vehicle_count: e.vehicle_count,
          trips_per_year: e.trips_per_year,
          start_time: e.departure_time,
          end_time: e.arrival_time,
          source_type: 'fleet_level' as const,
        })),
      }).catch(console.warn);
    }
    onFinish ? onFinish() : setWizardStep(3);
  };

  // ── CSV handlers ─────────────────────────────────────────────────────────

  const handleFileSelect = async (file: File) => {
    const projectId = wizard.projectId;
    if (!projectId || projectId.startsWith('local_')) {
      setUploadState('done');
      setUploadResult({ imported: 0, errors: ['Projekt noch nicht gespeichert.'] });
      return;
    }
    setUploadState('uploading');
    try {
      const result = await uploadRoutes(file, projectId, {});
      setUploadResult(result);
      setUploadState('done');
    } catch {
      setUploadState('error');
      setUploadResult({ imported: 0, errors: ['Upload fehlgeschlagen.'] });
    }
  };

  const handleUploadNext = () => {
    if (uploadState !== 'done' || !uploadResult || uploadResult.imported === 0) return;
    onFinish ? onFinish() : setWizardStep(3);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Mobilitätsprofil</h2>
        <p className="text-sm text-slate-500 mt-1">
          Erfassen Sie das Mobilitätsprofil Ihrer <strong>aktuellen Verbrennungsflotte</strong> — also der Fahrzeuge, die elektrifiziert werden sollen.
        </p>
      </div>

      <div className="p-6">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" /> Tour-Upload (CSV)
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 text-xs">
              <Edit className="h-3.5 w-3.5" /> Manuelle Eingabe
            </TabsTrigger>
            <TabsTrigger value="fleet_level" className="flex items-center gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Flottenebene
            </TabsTrigger>
          </TabsList>

          {/* ── CSV Tab ──────────────────────────────────────────────────── */}
          <TabsContent value="upload" className="mt-4 space-y-4">

            {/* Feldbeschreibung */}
            <div className="rounded border border-slate-200 bg-slate-50 divide-y divide-slate-100">
              {/* Pflichtfelder */}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-[#001141] mb-2">Pflichtfelder</p>
                <div className="space-y-1.5">
                  {[
                    { field: 'date', desc: 'Datum der Tour', ex: '2024-03-15' },
                    { field: 'distance_km', desc: 'Streckenlänge in Kilometern', ex: '120' },
                    { field: 'departure_time', desc: 'Abfahrtszeit (HH:MM)', ex: '06:00' },
                    { field: 'arrival_time', desc: 'Ankunftszeit am Depot (HH:MM)', ex: '18:00' },
                  ].map(({ field, desc, ex }) => (
                    <div key={field} className="flex items-center gap-3">
                      <code className="text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5 text-[#0079C0] font-mono w-36 shrink-0">{field}</code>
                      <span className="text-xs text-slate-600 flex-1">{desc}</span>
                      <span className="text-xs text-slate-400 font-mono shrink-0">z.B. {ex}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optionale Felder */}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-[#001141] mb-2">Optionale Felder</p>
                <div className="space-y-1.5">
                  {[
                    { field: 'route_id', desc: 'Tour-Bezeichnung', ex: 'TOUR_001', used: true },
                    { field: 'vehicle_count', desc: 'Anzahl Fahrzeuge — multipliziert Kosten & CO₂', ex: '3', used: true },
                    { field: 'consumption_l_100km', desc: 'Kraftstoffverbrauch (überschreibt Fahrzeugtyp)', ex: '8.5', used: true },
                    { field: 'avg_speed_kmh', desc: 'Geschwindigkeit — beeinflusst EV-Verbrauch', ex: '55', used: true },
                    { field: 'payload_kg', desc: 'Nutzlast — beeinflusst Verbrauch (+20% bei Vollast)', ex: '800', used: true },
                    { field: 'stops', desc: 'Anzahl Zwischenstopps', ex: '5', used: true },
                  ].map(({ field, desc, ex, used }) => (
                    <div key={field} className="flex items-center gap-3">
                      <code className={`text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5 font-mono w-44 shrink-0 ${used ? 'text-slate-600' : 'text-slate-300'}`}>{field}</code>
                      <span className={`text-xs flex-1 ${used ? 'text-slate-500' : 'text-slate-300'}`}>{desc}</span>
                      <span className="text-xs text-slate-300 font-mono shrink-0">z.B. {ex}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Beispiel-CSV Download */}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Vorlage herunterladen und befüllen</span>
                <button
                  type="button"
                  onClick={() => {
                    const csv = [
                      'route_id,date,distance_km,departure_time,arrival_time,vehicle_count,stops,consumption_l_100km,avg_speed_kmh,payload_kg',
                      'TOUR_001,2024-03-15,120,06:00,18:00,1,5,8.5,55,800',
                      'TOUR_002,2024-03-15,85,07:30,15:30,2,3,9.0,50,600',
                      'TOUR_003,2024-03-15,200,05:00,20:00,1,8,8.0,60,1000',
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'touren_vorlage.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#0079C0] text-[#0079C0] rounded hover:bg-[#e6f3fc] transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" /> Vorlage (CSV)
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <FileDropzone accept={['.csv', '.xlsx']} onFileSelect={handleFileSelect}
              label="CSV oder XLSX-Datei hier ablegen oder auswählen" />

            {uploadState === 'uploading' && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Wird verarbeitet…
              </div>
            )}
            {uploadState === 'done' && uploadResult && (
              <Alert variant={uploadResult.imported > 0 ? 'success' : 'destructive'}>
                <AlertDescription>
                  {uploadResult.imported > 0
                    ? <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" />{uploadResult.imported} Touren importiert.</span>
                    : uploadResult.errors.join(', ')}
                </AlertDescription>
              </Alert>
            )}
            {uploadState === 'error' && (
              <Alert variant="destructive"><AlertDescription>Upload fehlgeschlagen.</AlertDescription></Alert>
            )}
          </TabsContent>

          {/* ── Manual Tab ───────────────────────────────────────────────── */}
          <TabsContent value="manual" className="mt-4 space-y-5">
            {/* Vehicle types section */}
            <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-normal text-[#001141] flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Fahrzeugtypen
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Definieren Sie die Fahrzeugkategorien Ihrer aktuellen Flotte — z.B. Segment, Kraftstoff, Anzahl und Verbrauch.</p>
                </div>
                <Button variant="outline" size="sm" onClick={addVehicleType} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Fahrzeugtyp hinzufügen
                </Button>
              </div>
              <div className="space-y-3">
                {vehicleTypes.map((vt, vi) => (
                  <div key={vi} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-normal text-[#0079C0]">Fahrzeugtyp {vi + 1}</span>
                      {vehicleTypes.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeVehicleType(vi)}>
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Segment</Label>
                        <Select value={vt.segment} onValueChange={v => updateVehicleType(vi, 'segment', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{SEGMENTS.map(s => <SelectItem key={s} value={s}>{getSegmentLabel(s)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Kraftstoff</Label>
                        <Select value={vt.fuel_type} onValueChange={v => updateVehicleType(vi, 'fuel_type', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FUEL_TYPES.map(f => <SelectItem key={f} value={f}>{getFuelTypeLabel(f)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Verbrauch (l/100km)</Label>
                        <Input className="h-8 text-xs" type="number" step="0.1" value={vt.consumption_l_100km}
                          onChange={e => updateVehicleType(vi, 'consumption_l_100km', parseFloat(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nutzlast (kg)</Label>
                        <Input className="h-8 text-xs" type="number" value={vt.payload_kg}
                          onChange={e => updateVehicleType(vi, 'payload_kg', parseInt(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fahrzeugwert (€)</Label>
                        <Input className="h-8 text-xs" type="number" value={vt.capex}
                          onChange={e => updateVehicleType(vi, 'capex', parseInt(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Wartung/Jahr (€)</Label>
                        <Input className="h-8 text-xs" type="number" value={vt.maintenance_cost_annual}
                          onChange={e => updateVehicleType(vi, 'maintenance_cost_annual', parseInt(e.target.value))} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tours section */}
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-normal text-[#001141]">Touren</h4>
                <p className="text-xs text-slate-400 mt-0.5">Eine Tour entspricht einer typischen Tagesroute eines Fahrzeugs — mit Abfahrtszeit, Ankunftszeit und zurückgelegter Distanz.</p>
              </div>
              {manualRoutes.map((route, ri) => (
                <div key={ri} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Tour {ri + 1}</span>
                    {manualRoutes.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeRoute(ri)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    )}
                  </div>
                  {/* Reihe 1 */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tour-ID</Label>
                      <Input className="h-8 text-xs" placeholder="TOUR_001" value={route.route_id}
                        onChange={e => updateRoute(ri, 'route_id', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Distanz (km)</Label>
                      <Input className="h-8 text-xs" type="number" value={route.distance_km}
                        onChange={e => updateRoute(ri, 'distance_km', parseFloat(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stopps</Label>
                      <Input className="h-8 text-xs" type="number" value={route.stops}
                        onChange={e => updateRoute(ri, 'stops', parseInt(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fahrzeugtyp</Label>
                      <Select value={String(route.vehicle_type_idx)}
                        onValueChange={v => updateRoute(ri, 'vehicle_type_idx', parseInt(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {vehicleTypes.map((vt, vi) => (
                            <SelectItem key={vi} value={String(vi)}>Fahrzeugtyp {vi + 1}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Reihe 2 */}
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Trips/Jahr</Label>
                      <Input className="h-8 text-xs" type="number" min="1" max="365" value={route.trips_per_year}
                        onChange={e => updateRoute(ri, 'trips_per_year', parseInt(e.target.value) || 250)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Abfahrtszeit</Label>
                      <Input className="h-8 text-xs" type="time" value={route.departure_time}
                        onChange={e => updateRoute(ri, 'departure_time', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Ankunftszeit</Label>
                      <Input className="h-8 text-xs" type="time" value={route.arrival_time}
                        onChange={e => updateRoute(ri, 'arrival_time', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ø-Tempo (km/h)</Label>
                      <Input className="h-8 text-xs" type="number" value={route.avg_speed_kmh}
                        onChange={e => updateRoute(ri, 'avg_speed_kmh', parseFloat(e.target.value))} />
                    </div>
                  </div>
                  {route.departure_time && route.arrival_time && (
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Ladefenster: {formatHours(computeChargingWindowMin(route.departure_time, route.arrival_time))}
                    </p>
                  )}

                  {/* Mehrere Fahrzeuge */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`multi-${ri}`}
                      checked={route.vehicle_count > 1}
                      onChange={(e) => updateRoute(ri, 'vehicle_count', e.target.checked ? 2 : 1)}
                      className="h-3.5 w-3.5 accent-[#0079C0] cursor-pointer"
                    />
                    <label htmlFor={`multi-${ri}`} className="text-xs text-slate-500 cursor-pointer">
                      Führen mehrere Fahrzeuge dieses Typs diese Tour durch?
                    </label>
                    {route.vehicle_count > 1 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Anzahl:</span>
                        <Input
                          className="h-7 text-xs w-16"
                          type="number" min="2"
                          value={route.vehicle_count}
                          onChange={e => updateRoute(ri, 'vehicle_count', parseInt(e.target.value) || 2)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Fahrbedingungen — only shown in Reichweiten mode */}
                  {isReichweitenMode && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => toggleConditions(ri)}
                        className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-[#001141] transition-colors group"
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <Thermometer className="h-3.5 w-3.5 text-[#0079C0]" />
                          Fahrbedingungen
                        </span>
                        <span className="flex items-center gap-2 text-slate-400">
                          <span>{route.sim_temperature_c > 0 ? '+' : ''}{route.sim_temperature_c}°C</span>
                          <span>·</span>
                          <span>HVAC {route.sim_hvac_on ? 'Ein' : 'Aus'}</span>
                          <span>·</span>
                          <span>Stadt {Math.round(route.sim_city_share * 100)}% · Land {Math.round(route.sim_rural_share * 100)}% · BAB {Math.round(route.sim_hwy_share * 100)}%</span>
                          {expandedConditions.has(ri) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </span>
                      </button>

                      {expandedConditions.has(ri) && (
                        <div className="mt-3 rounded border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                          {/* Temperature */}
                          <div className="flex items-center gap-4 px-4 py-3">
                            <span className="text-xs text-slate-500 w-28 shrink-0 flex items-center gap-1.5">
                              <Thermometer className="h-3.5 w-3.5 text-slate-400" /> Temperatur
                            </span>
                            <input
                              type="range" min={-20} max={40} step={1}
                              value={route.sim_temperature_c}
                              onChange={e => updateRouteCond(ri, 'sim_temperature_c', Number(e.target.value))}
                              className="flex-1 accent-[#0079C0] h-1.5"
                            />
                            <span className={cn(
                              'text-xs font-semibold tabular-nums w-12 text-right',
                              route.sim_temperature_c < 0 ? 'text-[#0079C0]' :
                              route.sim_temperature_c > 28 ? 'text-[#C45600]' : 'text-slate-700'
                            )}>
                              {route.sim_temperature_c > 0 ? '+' : ''}{route.sim_temperature_c}°C
                            </span>
                          </div>

                          {/* HVAC */}
                          <div className="flex items-center gap-4 px-4 py-3">
                            <span className="text-xs text-slate-500 w-28 shrink-0 flex items-center gap-1.5">
                              <Wind className="h-3.5 w-3.5 text-slate-400" /> HVAC
                            </span>
                            <div className="flex gap-2">
                              {([false, true] as const).map(val => (
                                <button
                                  key={String(val)}
                                  type="button"
                                  onClick={() => updateRouteCond(ri, 'sim_hvac_on', val)}
                                  className={cn(
                                    'px-4 py-1 rounded text-xs border transition-colors',
                                    route.sim_hvac_on === val
                                      ? 'bg-[#0079C0] text-white border-[#0079C0]'
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                  )}
                                >
                                  {val ? 'Ein' : 'Aus'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Usage mix */}
                          <div className="px-4 py-3 space-y-2.5">
                            <span className="text-xs text-slate-500 font-medium">Nutzungsmix</span>
                            {[
                              { key: 'sim_city_share' as const, label: 'Stadt', color: 'accent-[#0079C0]' },
                              { key: 'sim_rural_share' as const, label: 'Landstraße', color: 'accent-[#043F2E]' },
                              { key: 'sim_hwy_share' as const, label: 'Autobahn', color: 'accent-[#C45600]' },
                            ].map(({ key, label, color }) => {
                              const pct = Math.round((route[key] as number) * 100);
                              return (
                                <div key={key} className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
                                  <input
                                    type="range" min={0} max={100} step={5}
                                    value={pct}
                                    onChange={e => {
                                      const v = Number(e.target.value) / 100;
                                      const others = [
                                        { k: 'sim_city_share' as const, val: route.sim_city_share },
                                        { k: 'sim_rural_share' as const, val: route.sim_rural_share },
                                        { k: 'sim_hwy_share' as const, val: route.sim_hwy_share },
                                      ].filter(o => o.k !== key);
                                      const otherSum = others[0].val + others[1].val;
                                      const remaining = 1 - v;
                                      const r0 = otherSum > 0 ? Math.round(remaining * (others[0].val / otherSum) * 100) / 100 : remaining / 2;
                                      const r1 = Math.round((remaining - r0) * 100) / 100;
                                      const vals: Record<string, number> = { [key]: v, [others[0].k]: r0, [others[1].k]: r1 };
                                      updateRouteCondMix(ri, vals['sim_city_share'], vals['sim_rural_share'], vals['sim_hwy_share']);
                                    }}
                                    className={cn('flex-1 h-1.5', color)}
                                  />
                                  <span className="text-xs font-semibold text-slate-700 w-8 text-right tabular-nums">{pct}%</span>
                                </div>
                              );
                            })}
                            {(() => {
                              const sum = Math.round((route.sim_city_share + route.sim_rural_share + route.sim_hwy_share) * 100);
                              return sum !== 100 ? (
                                <p className="text-xs text-red-500 mt-1">Summe: {sum}% (muss 100% sein)</p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRoute} className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" /> Tour hinzufügen
              </Button>
            </div>
          </TabsContent>

          {/* ── Fleet Level Tab ───────────────────────────────────────────── */}
          <TabsContent value="fleet_level" className="mt-4 space-y-4">
            {/* Erklärung */}
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-[#001141]">Aggregiertes Flottenprofil</p>
              <p className="text-xs text-slate-500">
                Geben Sie pro Fahrzeugtyp die jährliche Fahrleistung an. Das System berechnet daraus eine repräsentative Tour
                (<strong>Distanz = km/Jahr ÷ Trips/Jahr</strong>) und verwendet denselben Simulationsmotor wie bei der manuellen Eingabe.
                Geeignet für eine schnelle Ersteinschätzung ohne Einzeltourdaten.
              </p>
            </div>
            <div className="space-y-3">
              {fleetEntries.map((entry, i) => (
                <div key={i} className="border rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-normal text-[#001141]">
                      Fahrzeugtyp {i + 1}
                    </span>
                    {fleetEntries.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeFleetEntry(i)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    )}
                  </div>
                  {/* Reihe 1 — Fahrzeugtyp */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Segment</Label>
                      <Select value={entry.segment} onValueChange={v => updateFleetEntry(i, 'segment', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{SEGMENTS.map(s => <SelectItem key={s} value={s}>{getSegmentLabel(s)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Kraftstoff</Label>
                      <Select value={entry.fuel_type} onValueChange={v => updateFleetEntry(i, 'fuel_type', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{FUEL_TYPES.map(f => <SelectItem key={f} value={f}>{getFuelTypeLabel(f)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Anzahl Fahrzeuge</Label>
                      <Input className="h-8 text-xs" type="number" min="1" value={entry.vehicle_count}
                        onChange={e => updateFleetEntry(i, 'vehicle_count', parseInt(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ø Verbrauch (l/100km)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.1" value={entry.consumption_l_100km}
                        onChange={e => updateFleetEntry(i, 'consumption_l_100km', parseFloat(e.target.value))} />
                    </div>
                  </div>
                  {/* Reihe 2 — Fahrleistung & Zeiten */}
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">km/Jahr</Label>
                      <Input className="h-8 text-xs" type="number" value={entry.annual_km}
                        onChange={e => updateFleetEntry(i, 'annual_km', parseInt(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Trips/Jahr</Label>
                      <Input className="h-8 text-xs" type="number" min="1" max="365" value={entry.trips_per_year}
                        onChange={e => updateFleetEntry(i, 'trips_per_year', parseInt(e.target.value) || 250)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Abfahrtszeit</Label>
                      <Input className="h-8 text-xs" type="time" value={entry.departure_time}
                        onChange={e => updateFleetEntry(i, 'departure_time', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Ankunftszeit</Label>
                      <Input className="h-8 text-xs" type="time" value={entry.arrival_time}
                        onChange={e => updateFleetEntry(i, 'arrival_time', e.target.value)} />
                    </div>
                  </div>
                  {/* Tour-Info */}
                  {(entry.departure_time && entry.arrival_time) || (entry.trips_per_year > 0 && entry.annual_km > 0) ? (
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                      {entry.trips_per_year > 0 && entry.annual_km > 0 && (
                        <span className="flex items-center gap-1 text-[#0079C0]">
                          <Gauge className="h-3 w-3" />
                          Repräsentative Tour: <strong>{Math.round(entry.annual_km / entry.trips_per_year)} km</strong>
                        </span>
                      )}
                      {entry.departure_time && entry.arrival_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Ladefenster: {formatHours(computeChargingWindowMin(entry.departure_time, entry.arrival_time))}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addFleetEntry} className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" /> Fahrzeugtyp hinzufügen
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" onClick={() => setWizardStep(1)}>← Zurück</Button>
        <Button
          onClick={
            tab === 'manual' ? handleManualSubmit :
            tab === 'upload' ? handleUploadNext :
            handleFleetLevelNext
          }
          disabled={
            addRoutes.isPending || createFleet.isPending || isFinishing ||
            (tab === 'upload' && (uploadState !== 'done' || !uploadResult || uploadResult.imported === 0))
          }
        >
          {isFinishing
            ? 'Simulation läuft...'
            : (addRoutes.isPending || createFleet.isPending)
            ? 'Wird gespeichert...'
            : onFinish
            ? 'Simulation starten →'
            : 'Weiter zu Annahmen →'}
        </Button>
      </div>
    </div>
  );
}
