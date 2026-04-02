import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScenarioMetric {
  name: string;
  electrifiable_pct: number;
  co2_savings_pct: number;
  tco_savings_pct: number;
  payback_score: number;
}

interface Props {
  scenarios: ScenarioMetric[];
}

const COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#a855f7'];

export default function ScenarioComparisonChart({ scenarios }: Props) {
  if (scenarios.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400 text-sm">
          Keine Szenarien zum Vergleichen verfügbar
        </CardContent>
      </Card>
    );
  }

  const metrics = ['Elektrifizierbarkeit', 'CO₂-Einsparung', 'TCO-Einsparung', 'Amortisation'];

  const data = metrics.map(metric => {
    const entry: Record<string, string | number> = { metric };
    scenarios.forEach((s, i) => {
      const key = s.name;
      if (metric === 'Elektrifizierbarkeit') entry[key] = s.electrifiable_pct;
      if (metric === 'CO₂-Einsparung') entry[key] = s.co2_savings_pct;
      if (metric === 'TCO-Einsparung') entry[key] = s.tco_savings_pct;
      if (metric === 'Amortisation') entry[key] = s.payback_score;
    });
    return entry;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Szenarien-Vergleich</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {scenarios.map((s, i) => (
              <Radar
                key={s.name}
                name={s.name}
                dataKey={s.name}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.15}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
