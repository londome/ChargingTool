import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RankedItem {
  name: string;
  score: number;
  rank: number;
}

interface Props {
  candidates: RankedItem[];
  title?: string;
}

export default function RankingChart({ candidates, title = 'Priorisierung für Erstlektrifizierung' }: Props) {
  const data = candidates
    .slice(0, 10)
    .map(c => ({ ...c, label: `#${c.rank} ${c.name.substring(0, 20)}` }));

  const getColor = (score: number) => {
    if (score >= 70) return '#22c55e';
    if (score >= 45) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Keine Ranking-Daten verfügbar</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={140} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)} Punkte`, 'Score']}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={getColor(entry.score)} />
                ))}
                <LabelList
                  dataKey="score"
                  position="right"
                  formatter={(v: number) => `${v.toFixed(0)}`}
                  style={{ fontSize: 10, fill: '#64748b' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-slate-400 mt-2">
          Score: 35% Machbarkeit · 20% Reichweitenpuffer · 20% TCO-Einsparung · 15% Ladekompatibilität · 10% CO₂
        </p>
      </CardContent>
    </Card>
  );
}
