import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RouteResult, FeasibilityStatus } from '@shared/types';
import { getFeasibilityColor } from '@/lib/utils';

interface Props {
  routes: RouteResult[];
}

export default function TourDistributionChart({ routes }: Props) {
  // Bin tours by distance
  const bins = [
    { label: '0-50 km', min: 0, max: 50 },
    { label: '50-100 km', min: 50, max: 100 },
    { label: '100-150 km', min: 100, max: 150 },
    { label: '150-200 km', min: 150, max: 200 },
    { label: '200-300 km', min: 200, max: 300 },
    { label: '300+ km', min: 300, max: Infinity },
  ];

  const getFeasibilityStatus = (r: RouteResult): FeasibilityStatus =>
    r.feasible_without_charging ? FeasibilityStatus.FEASIBLE
    : r.feasible_with_charging ? FeasibilityStatus.FEASIBLE_WITH_CHARGING
    : FeasibilityStatus.NOT_FEASIBLE;

  const data = bins.map(bin => {
    const inBin = routes.filter(r => r.distance_km >= bin.min && r.distance_km < bin.max);
    const feasible = inBin.filter(r => getFeasibilityStatus(r) === FeasibilityStatus.FEASIBLE).length;
    const withCharging = inBin.filter(r => getFeasibilityStatus(r) === FeasibilityStatus.FEASIBLE_WITH_CHARGING).length;
    const notFeasible = inBin.filter(r => getFeasibilityStatus(r) === FeasibilityStatus.NOT_FEASIBLE).length;
    return {
      distance: bin.label,
      'Machbar': feasible,
      'Mit Zwischenladen': withCharging,
      'Nicht machbar': notFeasible,
      total: inBin.length,
    };
  }).filter(d => d.total > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tourenverteilung nach Distanz</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="distance" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="Machbar" stackId="a" fill="#22c55e" />
            <Bar dataKey="Mit Zwischenladen" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Nicht machbar" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
