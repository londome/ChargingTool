import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  feasible: number;
  notFeasible: number;
  feasibleWithCharging?: number;
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

export default function FeasibilityPieChart({ feasible, notFeasible, feasibleWithCharging = 0 }: Props) {
  // If no breakdown between feasible and feasibleWithCharging, show simpler version
  const actualFeasible = feasible - feasibleWithCharging;
  const data = [
    { name: 'Machbar (ohne Laden)', value: actualFeasible > 0 ? actualFeasible : feasible, color: COLORS[0] },
    { name: 'Machbar mit Zwischenladen', value: feasibleWithCharging, color: COLORS[1] },
    { name: 'Nicht machbar', value: notFeasible, color: COLORS[2] },
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
          <p className="font-semibold text-slate-800">{payload[0].name}</p>
          <p className="text-slate-600">{payload[0].value} Fahrzeuge ({total > 0 ? ((payload[0].value / total) * 100).toFixed(1) : 0}%)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Elektrifizierungs-Machbarkeit</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span className="text-slate-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex justify-center gap-4 mt-1">
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{feasible}</p>
            <p className="text-xs text-slate-500">Elektrifizierbar</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-red-500">{notFeasible}</p>
            <p className="text-xs text-slate-500">Nicht machbar</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-blue-600">{total}</p>
            <p className="text-xs text-slate-500">Gesamt</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
