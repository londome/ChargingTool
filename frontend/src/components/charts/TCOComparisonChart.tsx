import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

const LIFETIME = 8;

const COLORS = {
  fuel:     '#ef4444',
  maintIce: '#fca5a5',
  elec:     '#22c55e',
  maintEv:  '#86efac',
  capexIce: '#fbbf24',
  capexEv:  '#34d399',
  infra:    '#60a5fa',
};

interface Props {
  tcoIce: number;
  tcoEv: number;
  opexIce: number;
  opexEv: number;
  fuelCostIce: number;
  elecCostEv: number;
  infraCapex: number;
}

export default function TCOComparisonChart({
  tcoIce, tcoEv, opexIce, opexEv, fuelCostIce, elecCostEv, infraCapex,
}: Props) {
  const savings    = tcoIce - tcoEv;
  const savingsPct = tcoIce > 0 ? (savings / tcoIce) * 100 : 0;

  const maintIceAnnual = opexIce - fuelCostIce;
  const maintEvAnnual  = opexEv  - elecCostEv;

  // Total vehicle CapEx (all vehicles, full lifetime)
  const iceVehicleCapex = Math.max(0, tcoIce - opexIce * LIFETIME);
  const evVehicleCapex  = Math.max(0, tcoEv - infraCapex - opexEv * LIFETIME);

  // ── Chart 1: OpEx kumuliert ───────────────────────────────────────────────
  const opexData = Array.from({ length: LIFETIME }, (_, i) => {
    const y = i + 1;
    return {
      year: `J${y}`,
      'Kraftstoff (ICE)': Math.round(fuelCostIce * y),
      'Wartung (ICE)':    Math.round(maintIceAnnual * y),
      'Strom (EV)':       Math.round(elecCostEv * y),
      'Wartung (EV)':     Math.round(maintEvAnnual * y),
    };
  });

  const OpexTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; fill: string }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const iceTotal = payload.filter(p => p.name.includes('ICE')).reduce((s, p) => s + p.value, 0);
    const evTotal  = payload.filter(p => p.name.includes('EV')).reduce((s,  p) => s + p.value, 0);
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[190px]">
        <p className="font-semibold text-slate-800 mb-1.5">{label} – kumuliert</p>
        {payload.map(p => p.value > 0 && (
          <div key={p.name} className="flex items-center justify-between gap-3 mb-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
              <span className="text-slate-600">{p.name}</span>
            </div>
            <span className="font-medium">{formatCurrency(p.value)}</span>
          </div>
        ))}
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5">
          <div className="flex justify-between"><span className="text-red-500">Diesel OpEx:</span><span className="font-semibold text-red-600">{formatCurrency(iceTotal)}</span></div>
          <div className="flex justify-between"><span className="text-green-600">Elektro OpEx:</span><span className="font-semibold text-green-600">{formatCurrency(evTotal)}</span></div>
          <div className="flex justify-between font-semibold text-blue-600"><span>Δ Einsparung:</span><span>{formatCurrency(iceTotal - evTotal)}</span></div>
        </div>
      </div>
    );
  };

  // ── Chart 2: CapEx einmalig ───────────────────────────────────────────────
  const capexData = [
    {
      name: 'Diesel',
      'Fahrzeuganschaffung (ICE)': Math.round(iceVehicleCapex),
    },
    {
      name: 'Elektro',
      'Fahrzeuganschaffung (EV)': Math.round(evVehicleCapex),
      'Ladeinfrastruktur':        Math.round(infraCapex),
    },
  ];

  const CapexTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { name: string; value: number; fill: string }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, p) => s + (p.value || 0), 0);
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs min-w-[190px]">
        <p className="font-semibold text-slate-800 mb-1.5">{label} – Einmalinvestition</p>
        {payload.map(p => p.value > 0 && (
          <div key={p.name} className="flex items-center justify-between gap-3 mb-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
              <span className="text-slate-600">{p.name}</span>
            </div>
            <span className="font-medium">{formatCurrency(p.value)}</span>
          </div>
        ))}
        {payload.length > 1 && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex justify-between font-semibold text-slate-700">
            <span>Gesamt:</span><span>{formatCurrency(total)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">TCO-Übersicht – {LIFETIME} Jahre</CardTitle>
        <p className="text-xs text-slate-400">
          Gesamteinsparung: <span className="font-semibold text-blue-600">{formatCurrency(savings)}</span>
          {' '}({savingsPct.toFixed(0)} % weniger als Diesel)
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* OpEx kumuliert */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Betriebskosten – kumuliert
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={opexData} margin={{ top: 4, right: 6, left: 6, bottom: 4 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={32} />
                <Tooltip content={<OpexTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="Kraftstoff (ICE)" stackId="ice" fill={COLORS.fuel}     radius={[0,0,0,0]} />
                <Bar dataKey="Wartung (ICE)"    stackId="ice" fill={COLORS.maintIce} radius={[3,3,0,0]} />
                <Bar dataKey="Strom (EV)"       stackId="ev"  fill={COLORS.elec}     radius={[0,0,0,0]} />
                <Bar dataKey="Wartung (EV)"     stackId="ev"  fill={COLORS.maintEv}  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* CapEx einmalig */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Einmalinvestition (CapEx)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={capexData} margin={{ top: 4, right: 6, left: 6, bottom: 4 }} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={32} />
                <Tooltip content={<CapexTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="Fahrzeuganschaffung (ICE)" stackId="s" fill={COLORS.capexIce} radius={[3,3,0,0]} />
                <Bar dataKey="Fahrzeuganschaffung (EV)"  stackId="s" fill={COLORS.capexEv}  radius={[0,0,0,0]} />
                <Bar dataKey="Ladeinfrastruktur"         stackId="s" fill={COLORS.infra}    radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            {iceVehicleCapex === 0 && (
              <p className="text-[10px] text-[#C45600] text-center mt-2 leading-relaxed">
                Kein Fahrzeug-CapEx für Diesel hinterlegt —<br />
                im Mobilitätsprofil unter „Anschaffungskosten" ergänzen
              </p>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
