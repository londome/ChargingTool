import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCO2, formatPercent } from '@/lib/utils';

interface Props {
  iceT: number;
  evT: number;
}

export default function CO2ComparisonChart({ iceT, evT }: Props) {
  const savings = iceT - evT;
  const savingsPct = iceT > 0 ? (savings / iceT) * 100 : 0;

  // Waterfall: EV bar = invisible base (offset) + visible EV portion
  // Base is evT (invisible), top portion = savings shown in blue
  const data = [
    { name: 'Diesel (IST)',    base: 0,    ice: iceT,    ev: 0,    delta: 0    },
    { name: 'Elektro (SOLL)',  base: 0,    ice: 0,       ev: evT,  delta: 0    },
    { name: 'Δ Einsparung',    base: evT,  ice: 0,       ev: 0,    delta: savings },
  ];

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; dataKey: string }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const entry = payload.find(p => p.value > 0 && p.dataKey !== 'base');
    if (!entry) return null;
    const labels: Record<string, string> = {
      ice: 'CO₂ Diesel (IST)',
      ev: 'CO₂ Elektro (SOLL)',
      delta: `Einsparung (${formatPercent(savingsPct)})`,
    };
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-slate-800 mb-1">{label}</p>
        <p className="text-slate-600">{labels[entry.dataKey] ?? entry.dataKey}: <strong>{formatCO2(entry.value)}</strong></p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">CO₂-Emissionen – Vergleich pro Jahr</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)} t`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            {/* invisible base for waterfall delta bar */}
            <Bar dataKey="base" stackId="wf" fill="transparent" />
            <Bar dataKey="ice" stackId="wf" fill="#ef4444" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="ice" position="top" formatter={(v: number) => v > 0 ? formatCO2(v) : ''} style={{ fontSize: 10, fill: '#ef4444' }} />
            </Bar>
            <Bar dataKey="ev" stackId="wf" fill="#22c55e" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="ev" position="top" formatter={(v: number) => v > 0 ? formatCO2(v) : ''} style={{ fontSize: 10, fill: '#22c55e' }} />
            </Bar>
            <Bar dataKey="delta" stackId="wf" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="delta" position="top" formatter={(v: number) => v > 0 ? `−${formatCO2(v)}` : ''} style={{ fontSize: 10, fill: '#3b82f6' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="text-center mt-2 text-xs text-slate-500">
          CO₂-Reduktion:{' '}
          <span className="font-bold text-green-600">{formatCO2(savings)}/Jahr</span>
          {' '}({formatPercent(savingsPct)} weniger als Diesel)
        </div>
      </CardContent>
    </Card>
  );
}
