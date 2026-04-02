import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCO2, formatPercent } from '@/lib/utils';

interface Props {
  iceT: number;
  evT: number;
}

export default function CO2ComparisonChart({ iceT, evT }: Props) {
  const savings = iceT - evT;
  const savingsPct = iceT > 0 ? (savings / iceT) * 100 : 0;

  const data = [
    { name: 'Diesel (IST)', co2: iceT, fill: '#ef4444' },
    { name: 'Elektro (SOLL)', co2: evT, fill: '#22c55e' },
    { name: 'Einsparung', co2: savings, fill: '#3b82f6' },
  ];

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
          <p className="font-semibold text-slate-800 mb-1">{label}</p>
          <p className="text-slate-600">{formatCO2(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">CO₂-Emissionen – Vergleich pro Jahr</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)} t`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="co2" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="text-center mt-2 text-xs text-slate-500">
          CO₂-Reduktion:{' '}
          <span className="font-bold text-green-600">{formatCO2(savings)}/Jahr</span>
          {' '}({formatPercent(savingsPct)} weniger)
        </div>
      </CardContent>
    </Card>
  );
}
