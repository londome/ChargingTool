import { useState } from 'react';
import { Check, Zap, Package, Battery } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useEVModels } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EVModel, VehicleSegment } from '@shared/types';
import { getSegmentLabel, formatCurrency } from '@/lib/utils';

export default function Step5EVSelection() {
  const { wizard, setWizardSelectedEVs, setWizardStep } = useProjectStore();
  const { data: evModels, isLoading } = useEVModels();
  const [selectedIds, setSelectedIds] = useState<string[]>(wizard.step5SelectedEVIds);
  const [filterSegment, setFilterSegment] = useState<string>('all');
  const [filterManufacturer, setFilterManufacturer] = useState('');

  const modelList = Array.isArray(evModels) ? evModels : [];

  const filteredModels = modelList.filter(ev => {
    if (filterSegment !== 'all' && ev.segment !== filterSegment) return false;
    if (filterManufacturer && !ev.manufacturer.toLowerCase().includes(filterManufacturer.toLowerCase())) return false;
    return true;
  });

  // Get relevant segments from fleet
  const fleetSegments = [...new Set(wizard.step2Vehicles.map(v => v.segment))];

  const toggleEV = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setWizardSelectedEVs(selectedIds);
    setWizardStep(6);
  };

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">EV-Modell-Auswahl</h2>
        <p className="text-sm text-slate-500 mt-1">
          Wählen Sie EV-Modelle für den Vergleich aus. Die Simulation findet automatisch die besten Matches.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Recommended segments */}
        {fleetSegments.length > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-1">Empfohlene Segmente für Ihre Flotte:</p>
            <div className="flex flex-wrap gap-1">
              {fleetSegments.map(s => (
                <Badge key={s} variant="info" className="cursor-pointer text-xs" onClick={() => setFilterSegment(s)}>
                  {getSegmentLabel(s)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={filterSegment} onValueChange={setFilterSegment}>
            <SelectTrigger className="w-48">
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
            className="w-48"
          />

          {selectedIds.length > 0 && (
            <Badge variant="success" className="self-center px-3">
              {selectedIds.length} ausgewählt
            </Badge>
          )}
        </div>

        {/* EV Model grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {filteredModels.map(ev => {
              const isSelected = selectedIds.includes(ev.id);
              return (
                <div
                  key={ev.id}
                  onClick={() => toggleEV(ev.id)}
                  className={`relative cursor-pointer rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 rounded bg-slate-100 shrink-0">
                      <Zap className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{ev.manufacturer} {ev.model}</p>
                      <p className="text-xs text-slate-500">{getSegmentLabel(ev.segment as VehicleSegment)}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-0.5 text-xs text-slate-600">
                          <Battery className="h-3 w-3" /> {ev.battery_usable_kwh} kWh
                        </span>
                        <span className="flex items-center gap-0.5 text-xs text-slate-600">
                          <Package className="h-3 w-3" /> {ev.payload_kg?.toLocaleString('de-DE')} kg
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          {ev.nominal_consumption_kwh_100km} kWh/100km
                        </span>
                      </div>
                      {ev.purchase_price && (
                        <p className="text-xs text-blue-700 font-medium mt-0.5">
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
          Die Simulation berücksichtigt automatisch alle verfügbaren EV-Modelle.
          Ihre Auswahl priorisiert bestimmte Modelle für den Vergleich.
        </p>
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" onClick={() => setWizardStep(4)}>← Zurück</Button>
        <Button onClick={handleNext}>Weiter zu Szenarien →</Button>
      </div>
    </div>
  );
}
