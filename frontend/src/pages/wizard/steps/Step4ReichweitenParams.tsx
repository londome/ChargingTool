import { useState } from 'react';
import { Thermometer, Wind, Gauge, Info } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Step4ReichweitenParamsProps {
  onFinish: (params: {
    temperature_c: number;
    hvac_on: boolean;
    city_share: number;
    rural_share: number;
    hwy_share: number;
  }) => void;
  isFinishing?: boolean;
}

function TempSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const color =
    value < 0   ? 'text-[#0079C0]' :
    value < 10  ? 'text-cyan-600' :
    value < 20  ? 'text-slate-600' :
    value < 30  ? 'text-[#C45600]' : 'text-red-600';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Thermometer className="h-4 w-4" /> Außentemperatur
        </label>
        <span className={cn('text-lg font-bold tabular-nums', color)}>
          {value > 0 ? '+' : ''}{value} °C
        </span>
      </div>
      <input
        type="range"
        min={-20}
        max={40}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>−20°C ❄️</span>
        <span>0°C</span>
        <span>20°C</span>
        <span>40°C 🔥</span>
      </div>
    </div>
  );
}

function UsageMixSliders({
  city, rural, hwy,
  onChange,
}: {
  city: number; rural: number; hwy: number;
  onChange: (city: number, rural: number, hwy: number) => void;
}) {
  const sum = Math.round((city + rural + hwy) * 100);
  const valid = sum === 100;

  const handleCity = (v: number) => {
    const remaining = 100 - v;
    const ratio = rural + hwy > 0 ? rural / (rural + hwy) : 0.6;
    onChange(v / 100, Math.round(remaining * ratio) / 100, Math.round(remaining * (1 - ratio)) / 100);
  };

  const handleRural = (v: number) => {
    const remaining = 100 - v;
    const ratio = city + hwy > 0 ? city / (city + hwy) : 0.7;
    onChange(Math.round(remaining * ratio) / 100, v / 100, Math.round(remaining * (1 - ratio)) / 100);
  };

  const handleHwy = (v: number) => {
    const remaining = 100 - v;
    const ratio = city + rural > 0 ? city / (city + rural) : 0.6;
    onChange(Math.round(remaining * ratio) / 100, Math.round(remaining * (1 - ratio)) / 100, v / 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Gauge className="h-4 w-4" /> Nutzungsmix
        </label>
        <span className={cn(
          'text-xs font-semibold px-2 py-0.5 rounded-full',
          valid ? 'bg-[#e8f5f0] text-[#043F2E]' : 'bg-red-50 text-red-600'
        )}>
          {sum}% {valid ? '✓' : '≠ 100%'}
        </span>
      </div>

      {/* City */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600 font-medium">🏙️ Stadtverkehr</span>
          <span className="text-sm font-bold text-slate-800 tabular-nums">{Math.round(city * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={Math.round(city * 100)}
          onChange={e => handleCity(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
      </div>

      {/* Rural */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600 font-medium">🌲 Landstraße</span>
          <span className="text-sm font-bold text-slate-800 tabular-nums">{Math.round(rural * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={Math.round(rural * 100)}
          onChange={e => handleRural(Number(e.target.value))}
          className="w-full accent-green-600"
        />
      </div>

      {/* Highway */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600 font-medium">🛣️ Autobahn</span>
          <span className="text-sm font-bold text-slate-800 tabular-nums">{Math.round(hwy * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={Math.round(hwy * 100)}
          onChange={e => handleHwy(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>

      {/* Visual bar */}
      <div className="h-3 rounded-full overflow-hidden flex">
        <div className="bg-[#0079C0] transition-all" style={{ width: `${Math.round(city * 100)}%` }} />
        <div className="bg-[#043F2E] transition-all" style={{ width: `${Math.round(rural * 100)}%` }} />
        <div className="bg-[#C45600] transition-all" style={{ width: `${Math.round(hwy * 100)}%` }} />
      </div>
    </div>
  );
}

export default function Step4ReichweitenParams({ onFinish, isFinishing }: Step4ReichweitenParamsProps) {
  const { wizard, setWizardStep, updateReichweitenSimParams } = useProjectStore();
  const saved = wizard.reichweitenSimParams;

  const [temperature_c, setTemperature] = useState(saved.temperature_c);
  const [hvac_on, setHvacOn] = useState(saved.hvac_on);
  const [city_share, setCityShare] = useState(saved.city_share);
  const [rural_share, setRuralShare] = useState(saved.rural_share);
  const [hwy_share, setHwyShare] = useState(saved.hwy_share);

  const sum = Math.round((city_share + rural_share + hwy_share) * 100);
  const mixValid = sum === 100;

  const handleUsageMix = (c: number, r: number, h: number) => {
    setCityShare(c); setRuralShare(r); setHwyShare(h);
  };

  const handleFinish = () => {
    const params = { temperature_c, hvac_on, city_share, rural_share, hwy_share };
    updateReichweitenSimParams(params);
    onFinish(params);
  };

  // Live range preview (simple estimate)
  const f_T = temperature_c < 20
    ? 1 + 0.003 * (20 - temperature_c)
    : temperature_c > 25 ? 1 + 0.001 * (temperature_c - 25) : 1.0;
  const hvac_factor = hvac_on ? (temperature_c < 10 ? 1.25 : temperature_c > 28 ? 1.15 : 1.08) : 1.0;
  const mix_factor = 1.0 + (hwy_share * 0.12) - (city_share * 0.05); // highway uses more, city less
  const condition_factor = f_T * hvac_factor * mix_factor;
  const conditionLabel =
    condition_factor < 1.05 ? { text: 'Optimale Bedingungen', color: 'text-[#043F2E]' } :
    condition_factor < 1.15 ? { text: 'Moderate Bedingungen', color: 'text-[#C45600]' } :
    condition_factor < 1.30 ? { text: 'Ungünstige Bedingungen', color: 'text-[#C45600]' } :
    { text: 'Sehr ungünstige Bedingungen', color: 'text-red-600' };

  return (
    <div>
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-normal text-[#001141]">Fahrbedingungen</h2>
        <p className="text-sm text-slate-500 mt-1">
          Diese Parameter bestimmen den Energieverbrauch physikalisch.
          Das Modell kalibriert sich automatisch auf den Nominalverbrauch jedes EV-Modells.
        </p>
      </div>

      <div className="p-6 space-y-8">
        {/* Temperature */}
        <TempSlider value={temperature_c} onChange={setTemperature} />

        {/* HVAC */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Wind className="h-4 w-4" /> Heizung / Klimaanlage
          </label>
          <div className="flex gap-3">
            {[
              { label: 'Ausgeschaltet', value: false, icon: '⬜' },
              { label: 'Eingeschaltet', value: true, icon: '🌡️' },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setHvacOn(opt.value)}
                className={cn(
                  'flex-1 py-3 rounded border text-sm font-medium transition-all',
                  hvac_on === opt.value
                    ? 'border-[#0079C0] bg-[#e6f3fc] text-[#0079C0]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          {hvac_on && temperature_c >= 20 && temperature_c <= 22 && (
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Bei 20–22°C ist kein aktiver HVAC-Betrieb nötig — kein Zusatzverbrauch.
            </p>
          )}
        </div>

        {/* Usage Mix */}
        <UsageMixSliders
          city={city_share}
          rural={rural_share}
          hwy={hwy_share}
          onChange={handleUsageMix}
        />

        {/* Live condition preview */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-200">
          <div className="text-2xl">
            {condition_factor < 1.05 ? '✅' : condition_factor < 1.15 ? '🟡' : condition_factor < 1.30 ? '🟠' : '🔴'}
          </div>
          <div>
            <p className={cn('text-sm font-semibold', conditionLabel.color)}>{conditionLabel.text}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Schätzfaktor gegenüber Standard (20°C, ohne HVAC, gemischt): ×{condition_factor.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 flex justify-between">
        <Button variant="outline" onClick={() => setWizardStep(3)}>← Zurück</Button>
        <Button
          onClick={handleFinish}
          disabled={!mixValid || isFinishing}
          className="flex items-center gap-2"
        >
          {isFinishing ? 'Analyse wird gestartet...' : 'Analyse starten →'}
        </Button>
      </div>
    </div>
  );
}
