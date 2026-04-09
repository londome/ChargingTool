import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Truck } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useCreateFleet } from '@/lib/api';
import { fleetVehicleSchema, FleetVehicleFormData } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VehicleSegment, FuelType, AcquisitionType } from '@shared/types';
import { getSegmentLabel, getFuelTypeLabel } from '@/lib/utils';
import type { WizardVehicleRow } from '@/store/projectStore';

const SEGMENTS = Object.values(VehicleSegment);
const FUEL_TYPES = [FuelType.DIESEL, FuelType.PETROL, FuelType.CNG, FuelType.HEV, FuelType.PHEV];

const DEFAULT_VEHICLE: FleetVehicleFormData = {
  segment: VehicleSegment.LARGE_VAN,
  fuel_type: FuelType.DIESEL,
  count: 1,
  consumption_l_100km: 9.5,
  annual_km: 30000,
  payload_kg: 900,
  maintenance_cost_annual: 4000,
  acquisition_type: AcquisitionType.PURCHASE,
  capex: 55000,
  lease_monthly: null,
};

export default function Step2Fleet() {
  const { wizard, updateWizardStep2, setWizardStep, setWizardFleetId } = useProjectStore();
  const createFleet = useCreateFleet();
  const [vehicles, setVehicles] = useState<WizardVehicleRow[]>(
    wizard.step2Vehicles.length > 0 ? wizard.step2Vehicles : []
  );
  const [showForm, setShowForm] = useState(vehicles.length === 0);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<FleetVehicleFormData>({
    resolver: zodResolver(fleetVehicleSchema),
    defaultValues: DEFAULT_VEHICLE,
  });

  const acquisitionType = watch('acquisition_type');

  const onAddVehicle = (data: FleetVehicleFormData) => {
    const row: WizardVehicleRow = {
      ...data,
      capex: data.capex ?? null,
      lease_monthly: data.lease_monthly ?? null,
    };
    if (editIndex !== null) {
      const updated = [...vehicles];
      updated[editIndex] = row;
      setVehicles(updated);
      setEditIndex(null);
    } else {
      setVehicles([...vehicles, row]);
    }
    reset(DEFAULT_VEHICLE);
    setShowForm(false);
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    reset(vehicles[index]);
    setShowForm(true);
  };

  const handleDelete = (index: number) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (vehicles.length === 0) return;
    updateWizardStep2(vehicles);

    const projectId = wizard.projectId;
    if (projectId && !projectId.startsWith('local_')) {
      try {
        const fleet = await createFleet.mutateAsync({
          project_id: projectId,
          vehicle_count: vehicles.reduce((s, v) => s + v.count, 0),
          vehicles,
        });
        if (fleet?.id) {
          setWizardFleetId(fleet.id);
        }
      } catch (e) {
        console.error('Fleet creation error:', e);
      }
    }
    setWizardStep(3);
  };

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Flottenerfassung</h2>
        <p className="text-sm text-slate-500 mt-1">
          Erfassen Sie Ihre aktuellen Fahrzeuge mit Verbrauch, Laufleistung und Kosten.
        </p>
      </div>

      <div className="p-6 space-y-5">
        {/* Existing vehicles table */}
        {vehicles.length > 0 && (
          <div>
            <h3 className="text-sm font-normal text-[#001141] mb-2">
              Erfasste Fahrzeuge ({vehicles.reduce((s, v) => s + v.count, 0)} gesamt)
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead>Kraftstoff</TableHead>
                    <TableHead className="text-right">Anzahl</TableHead>
                    <TableHead className="text-right">L/100km</TableHead>
                    <TableHead className="text-right">km/Jahr</TableHead>
                    <TableHead className="text-right">Nutzlast</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{getSegmentLabel(v.segment)}</TableCell>
                      <TableCell>{getFuelTypeLabel(v.fuel_type)}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right">{v.consumption_l_100km.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{v.annual_km.toLocaleString('de-DE')}</TableCell>
                      <TableCell className="text-right">{v.payload_kg.toLocaleString('de-DE')} kg</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(i)}>Bearb.</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(i)}>
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Add vehicle form */}
        {showForm ? (
          <form onSubmit={handleSubmit(onAddVehicle)} className="border rounded-lg p-4 bg-slate-50 space-y-4">
            <h4 className="font-normal text-[#001141] text-sm">
              {editIndex !== null ? 'Fahrzeug bearbeiten' : 'Fahrzeug hinzufügen'}
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Segment *</Label>
                <Controller
                  name="segment"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEGMENTS.map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{getSegmentLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kraftstoff *</Label>
                <Controller
                  name="fuel_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUEL_TYPES.map(f => (
                          <SelectItem key={f} value={f} className="text-xs">{getFuelTypeLabel(f)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Anzahl *</Label>
                <Input className="h-8 text-xs" type="number" {...register('count', { valueAsNumber: true })} />
                {errors.count && <p className="text-xs text-red-500">{errors.count.message}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Verbrauch (L/100km) *</Label>
                <Input className="h-8 text-xs" type="number" step="0.1" {...register('consumption_l_100km', { valueAsNumber: true })} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">km/Jahr *</Label>
                <Input className="h-8 text-xs" type="number" {...register('annual_km', { valueAsNumber: true })} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nutzlast (kg)</Label>
                <Input className="h-8 text-xs" type="number" {...register('payload_kg', { valueAsNumber: true })} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Wartung/Jahr (€)</Label>
                <Input className="h-8 text-xs" type="number" {...register('maintenance_cost_annual', { valueAsNumber: true })} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Beschaffung</Label>
                <Controller
                  name="acquisition_type"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase" className="text-xs">Kauf</SelectItem>
                        <SelectItem value="lease" className="text-xs">Leasing</SelectItem>
                        <SelectItem value="rental" className="text-xs">Miete</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {acquisitionType === 'purchase' && (
                <div className="space-y-1">
                  <Label className="text-xs">Kaufpreis (€)</Label>
                  <Input className="h-8 text-xs" type="number" {...register('capex', { valueAsNumber: true })} />
                </div>
              )}

              {acquisitionType === 'lease' && (
                <div className="space-y-1">
                  <Label className="text-xs">Leasingrate/Monat (€)</Label>
                  <Input className="h-8 text-xs" type="number" {...register('lease_monthly', { valueAsNumber: true })} />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {editIndex !== null ? 'Änderungen speichern' : 'Fahrzeug hinzufügen'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setEditIndex(null); reset(DEFAULT_VEHICLE); }}>
                Abbrechen
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4" />
            Fahrzeug hinzufügen
          </Button>
        )}

        {vehicles.length === 0 && !showForm && (
          <div className="text-center py-8 text-slate-400">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Fahrzeuge erfasst. Klicken Sie auf "Fahrzeug hinzufügen".</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" onClick={() => setWizardStep(1)}>← Zurück</Button>
        <Button onClick={handleNext} disabled={vehicles.length === 0 || createFleet.isPending}>
          {createFleet.isPending ? 'Wird gespeichert...' : 'Weiter zu Mobilität →'}
        </Button>
      </div>
    </div>
  );
}
