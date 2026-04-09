import { useState } from 'react';
import { Battery, Package, Zap, Search } from 'lucide-react';
import { useEVModels } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { EVModel, VehicleSegment } from '@shared/types';
import { getSegmentLabel, formatCurrency, formatNumber } from '@/lib/utils';

export default function EVLibrary() {
  const [segment, setSegment] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data: evModels, isLoading } = useEVModels();

  const modelList = Array.isArray(evModels) ? evModels : [];

  const filtered = modelList.filter(ev => {
    if (segment !== 'all' && ev.segment !== segment) return false;
    if (search && !`${ev.manufacturer} ${ev.model}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const manufacturers = [...new Set(modelList.map(m => m.manufacturer))].sort();

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-light text-[#001141]">EV-Modell-Bibliothek</h1>
        <p className="text-sm text-slate-500 mt-1">
          {modelList.length} Elektrofahrzeuge für Nutzfahrzeugeinsatz
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 w-56"
            placeholder="Modell suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Segmente</SelectItem>
            {Object.values(VehicleSegment).map(s => (
              <SelectItem key={s} value={s}>{getSegmentLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">
          {filtered.length} Modelle
        </Badge>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52 rounded" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ev => (
            <Card key={ev.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-[#001141]">{ev.manufacturer}</p>
                    <p className="text-sm text-slate-700 font-medium">{ev.model}</p>
                  </div>
                  <div className="p-1.5 rounded bg-[#e6f3fc]">
                    <Zap className="h-4 w-4 text-[#0079C0]" />
                  </div>
                </div>

                <Badge variant="secondary" className="mb-3 text-xs">
                  {getSegmentLabel(ev.segment as VehicleSegment)}
                </Badge>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Battery className="h-3.5 w-3.5 text-green-500" />
                    <span>{ev.battery_usable_kwh} kWh</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>{ev.nominal_consumption_kwh_100km} kWh/100</span>
                  </div>
                  {ev.payload_kg && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Package className="h-3.5 w-3.5 text-blue-500" />
                      <span>{ev.payload_kg.toLocaleString('de-DE')} kg</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Zap className="h-3.5 w-3.5 text-slate-400" />
                    <span>AC: {ev.max_ac_kw} kW{ev.max_dc_kw ? ` / DC: ${ev.max_dc_kw} kW` : ''}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {ev.purchase_price ? (
                    <span className="text-sm font-semibold text-[#0079C0]">
                      ab {formatCurrency(ev.purchase_price)}
                    </span>
                  ) : ev.lease_monthly ? (
                    <span className="text-sm font-medium text-slate-600">
                      Leasing ab {formatCurrency(ev.lease_monthly)}/Monat
                    </span>
                  ) : null}

                  {/* Range estimate (WLTP approx) */}
                  <span className="text-xs text-slate-400">
                    ~{Math.round((ev.battery_usable_kwh / ev.nominal_consumption_kwh_100km) * 100)} km Reichweite
                  </span>
                </div>

                {ev.notes && (
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{ev.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12 text-slate-400">
          <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Keine Modelle gefunden. Passen Sie die Filter an.</p>
        </div>
      )}
    </div>
  );
}
