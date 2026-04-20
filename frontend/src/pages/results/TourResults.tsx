import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowUpDown, Filter, Download } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useSimulationResults, downloadExport } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/shared/StatusBadge';
import { RouteResult } from '@shared/types';
import { formatCurrency, formatKWh, formatDistance } from '@/lib/utils';
import { FeasibilityStatus } from '@shared/types';
import TourDistributionChart from '@/components/charts/TourDistributionChart';

type SortKey = 'distance_km' | 'fuel_cost' | 'ev_energy_kwh' | 'annual_cost_delta' | 'annual_co2e_delta_kg';
type SortDir = 'asc' | 'desc';

export default function TourResults() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeRunId } = useProjectStore();
  const { data: results, isLoading } = useSimulationResults(activeRunId ?? undefined);
  if (!activeRunId) return null;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'feasible' | 'charging' | 'not_feasible'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('distance_km');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const routes = results?.route_results || [];

  const getFeasibility = (r: RouteResult) =>
    r.feasible_without_charging ? FeasibilityStatus.FEASIBLE
    : r.feasible_with_charging ? FeasibilityStatus.FEASIBLE_WITH_CHARGING
    : FeasibilityStatus.NOT_FEASIBLE;

  const filtered = routes.filter(r => {
    const feas = getFeasibility(r);
    if (filter === 'feasible' && feas !== FeasibilityStatus.FEASIBLE) return false;
    if (filter === 'charging' && feas !== FeasibilityStatus.FEASIBLE_WITH_CHARGING) return false;
    if (filter === 'not_feasible' && feas !== FeasibilityStatus.NOT_FEASIBLE) return false;
    if (search && !r.route_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const aVal = a[sortKey] as number;
    const bVal = b[sortKey] as number;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ArrowUpDown className={`h-3 w-3 ml-1 inline ${sortKey === k ? 'text-[#0079C0]' : 'text-slate-300'}`} />
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-[#001141]">Tourenanalyse</h1>
          <p className="text-sm text-slate-500 mt-1">
            {routes.length} Touren analysiert
          </p>
        </div>
        {activeRunId && (
          <Button variant="outline" size="sm" onClick={() => downloadExport(activeRunId, 'xlsx')}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        )}
      </div>

      {/* Distribution chart */}
      {routes.length > 0 && (
        <TourDistributionChart routes={routes} />
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Tour-ID suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Touren</SelectItem>
            <SelectItem value="feasible">Machbar (ohne Laden)</SelectItem>
            <SelectItem value="charging">Machbar mit Zwischenladen</SelectItem>
            <SelectItem value="not_feasible">Nicht machbar</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">
          {filtered.length} Touren
        </Badge>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded" />
      ) : (
        <div className="bg-white border rounded overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tour-ID</TableHead>
                <TableHead>Machbarkeit</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('distance_km')}>
                  Distanz <SortIcon k="distance_km" />
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('fuel_cost')}>
                  Kraftstoffkosten <SortIcon k="fuel_cost" />
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('ev_energy_kwh')}>
                  EV-Energie <SortIcon k="ev_energy_kwh" />
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('annual_cost_delta')}>
                  Kostendelta/Jahr <SortIcon k="annual_cost_delta" />
                </TableHead>
                <TableHead className="text-right">CO₂-Delta/Jahr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.route_id}</TableCell>
                  <TableCell>
                    <StatusBadge status={getFeasibility(r)} />
                  </TableCell>
                  <TableCell>{formatDistance(r.distance_km)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.fuel_cost)}</TableCell>
                  <TableCell className="text-right">{formatKWh(r.ev_energy_kwh)}</TableCell>
                  <TableCell className={`text-right font-medium ${r.annual_cost_delta < 0 ? 'text-[#043F2E]' : 'text-red-600'}`}>
                    {r.annual_cost_delta < 0 ? '' : '+'}{formatCurrency(r.annual_cost_delta)}
                  </TableCell>
                  <TableCell className={`text-right ${r.annual_co2e_delta_kg < 0 ? 'text-[#043F2E]' : 'text-red-600'}`}>
                    {r.annual_co2e_delta_kg < 0 ? '' : '+'}{(r.annual_co2e_delta_kg / 1000).toFixed(1)} t
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 100 && (
            <p className="text-xs text-slate-400 p-3 text-center">
              Zeige 100 von {filtered.length} Touren. Exportieren Sie für vollständige Daten.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
