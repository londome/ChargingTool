import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface Props {
  iceOpex: number;
  evOpex: number;
  iceFuelCost: number;
  evElecCost: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-slate-800 mb-1">{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-slate-600">{p.name}:</span>
            <span className="font-medium">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function CostComparisonChart({ iceOpex, evOpex, iceFuelCost, evElecCost }: Props) {
  const data = [
    {
      name: 'Jährliche Kosten',
      'Kraftstoff (ICE)': Math.round(iceFuelCost),
      'Strom (EV)': Math.round(evElecCost),
      'Sonstige OpEx (ICE)': Math.round(iceOpex - iceFuelCost),
      'Sonstige OpEx (EV)': Math.round(evOpex - evElecCost),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Kostenvergleich – Jährliche Betriebskosten</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k €`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Kraftstoff (ICE)" stackId="ice" fill="#ef4444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Sonstige OpEx (ICE)" stackId="ice" fill="#fca5a5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Strom (EV)" stackId="ev" fill="#22c55e" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Sonstige OpEx (EV)" stackId="ev" fill="#86efac" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2 text-xs">
          <div>
            <span className="text-slate-500">ICE OpEx:</span>
            <span className="font-semibold text-red-600 ml-1">{formatCurrency(iceOpex)}/Jahr</span>
          </div>
          <div>
            <span className="text-slate-500">EV OpEx:</span>
            <span className="font-semibold text-green-600 ml-1">{formatCurrency(evOpex)}/Jahr</span>
          </div>
          <div>
            <span className="text-slate-500">Einsparung:</span>
            <span className="font-semibold text-blue-600 ml-1">{formatCurrency(iceOpex - evOpex)}/Jahr</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
