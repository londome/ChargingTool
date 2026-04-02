import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface Props {
  tcoIce: number;
  tcoEv: number;
}

export default function TCOComparisonChart({ tcoIce, tcoEv }: Props) {
  const savings = tcoIce - tcoEv;
  const savingsPct = tcoIce > 0 ? (savings / tcoIce) * 100 : 0;

  // Yearly TCO comparison (assuming 8 year lifetime)
  const years = [1, 2, 3, 4, 5, 6, 7, 8];
  const icePerYear = tcoIce / 8;
  const evPerYear = tcoEv / 8;

  const data = years.map(y => ({
    year: `Jahr ${y}`,
    'TCO Diesel (kumuliert)': Math.round(icePerYear * y),
    'TCO Elektro (kumuliert)': Math.round(evPerYear * y),
  }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
          <p className="font-semibold text-slate-800 mb-1">{label}</p>
          {payload.map(p => (
            <div key={p.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
              <span className="text-slate-600 text-xs">{p.name}:</span>
              <span className="font-medium text-xs">{formatCurrency(p.value)}</span>
            </div>
          ))}
          {payload.length === 2 && (
            <div className="mt-1 pt-1 border-t border-slate-100 text-xs text-green-600 font-medium">
              Δ {formatCurrency(payload[0].value - payload[1].value)}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">TCO-Entwicklung – Kumuliert über 8 Jahre</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k €`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="TCO Diesel (kumuliert)" fill="#ef4444" opacity={0.8} radius={[2, 2, 0, 0]} />
            <Bar dataKey="TCO Elektro (kumuliert)" fill="#22c55e" opacity={0.8} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2 text-xs">
          <div><span className="text-slate-500">TCO Diesel:</span> <span className="font-semibold text-red-600">{formatCurrency(tcoIce)}</span></div>
          <div><span className="text-slate-500">TCO Elektro:</span> <span className="font-semibold text-green-600">{formatCurrency(tcoEv)}</span></div>
          <div><span className="text-slate-500">Einsparung:</span> <span className="font-semibold text-blue-600">{formatCurrency(savings)} ({savingsPct.toFixed(0)}%)</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
