import { useState } from 'react';
import { Check, Zap, Package, Battery, Gauge } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useEVModels } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleSegment } from '@shared/types';
import { getSegmentLabel, formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  onFinish: (selectedEVIds: string[]) => void;
  isFinishing?: boolean;
}

export default function Step3ReichweitenEVSelection({ onFinish, isFinishing }: Props) {
  const { wizard, setWizardSelectedEVs, setWizardStep } = useProjectStore();
  const { data: evModels, isLoading } = useEVModels();

  const [selectedIds, setSelectedIds] = useState<string[]>(wizard.step5SelectedEVIds ?? []);
  const [filterSegment, setFilterSegment] = useState<string>('all');
  const [filterManufacturer, setFilterManufacturer] = useState('');

  const modelList = Array.isArray(evModels) ? evModels : [];

  // Segments from fleet definition (step 2)
  const fleetSegments = [...new Set(wizard.step2Vehicles.map(v => v.segment))];

  const filteredModels = modelList.filter(ev => {
    if (filterSegment !== 'all' && ev.segment !== filterSegment) return false;
    if (filterManufacturer && !ev.manufacturer.toLowerCase().includes(filterManufacturer.toLowerCase())) return false;
    return true;
  });

  const toggleEV = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setWizardSelectedEVs(selectedIds);
    onFinish(selectedIds);
  };

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">EV-Modelle für die Analyse</h2>
        <p className="text-sm text-slate-500 mt-1">
          Wähle ein oder mehrere EV-Modelle, die du analysieren möchtest.
          Zusätzlich empfehlen wir dir automatisch passende Alternativen.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Fleet segment hint */}
        {fleetSegments.length > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-1.5">
              Empfohlene Segmente für deine Flotte:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {fleetSegments.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSegment(filterSegment === s ? 'all' : s)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    filterSegment === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-700 border-blue-200 hover:border-blue-400'
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
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {selectedIds.length} ausgewählt
            </span>
          )}

          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              Auswahl zurücksetzen
            </button>
          )}
        </div>

        {/* EV Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : filteredModels.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Keine EV-Modelle für diesen Filter gefunden.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredModels.map(ev => {
              const isSelected = selectedIds.includes(ev.id);
              // Estimated range (90→20% SOC)
              const usable_soc = 0.70;
              const est_range = Math.round(
                (ev.battery_usable_kwh * usable_soc) / (ev.nominal_consumption_kwh_100km / 100)
              );

              return (
                <div
                  key={ev.id}
                  onClick={() => toggleEV(ev.id)}
                  className={cn(
                    'relative cursor-pointer rounded-lg border p-3 transition-all select-none',
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      'p-1.5 rounded shrink-0',
                      isSelected ? 'bg-blue-100' : 'bg-slate-100'
                    )}>
                      <Zap className={cn('h-3.5 w-3.5', isSelected ? 'text-blue-600' : 'text-slate-500')} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm leading-tight pr-5">
                        {ev.manufacturer} {ev.model}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {getSegmentLabel(ev.segment as VehicleSegment)}
                      </p>
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
                        <p className="text-xs text-blue-700 font-medium mt-1">
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
          Keine Auswahl nötig — wir analysieren dann alle verfügbaren Modelle und geben Empfehlungen.
        </p>
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" onClick={() => setWizardStep(2)}>← Zurück</Button>
        <Button onClick={handleNext} disabled={isFinishing} className="flex items-center gap-2">
          {isFinishing
            ? 'Analyse wird gestartet...'
            : selectedIds.length > 0
            ? `Analyse starten (${selectedIds.length} Modell${selectedIds.length > 1 ? 'e' : ''}) →`
            : 'Analyse starten →'}
        </Button>
      </div>
    </div>
  );
}
