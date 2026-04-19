import { Gauge, Zap, Settings2, ArrowLeftRight, BatteryCharging } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WizardModule } from '@/store/projectStore';

interface Module {
  id: WizardModule;
  title: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  tag?: string;
  iconColor?: string;
}

const MODULES: Module[] = [
  {
    id: 'reichweiten',
    title: 'Reichweite',
    description: 'Simulation der Reichweite und Elektrifizierbarkeit auf Basis von Tagesstrecken und verfügbaren EV-Modellen.',
    icon: Gauge,
    enabled: true,
  },
  {
    id: 'ladeprozess',
    title: 'Ladeprozess',
    description: 'Simulation von Ladezeiten, Infrastrukturbedarf, TCO und CO₂-Emissionen im Vergleich ICE vs. EV.',
    icon: Zap,
    enabled: true,
  },
  {
    id: 'ladeprozess_optimierung',
    title: 'Ladeprozessoptimierung (V1X)',
    description: 'Simulation von Ladekosten und CO₂-Emissionen auf Basis externer Signale. LP-basierte Optimierung.',
    icon: Zap,
    enabled: true,
    iconColor: 'green',
  },
  {
    id: 'ladeprozess_bidirektional',
    title: 'Ladeprozessoptimierung (V2X)',
    description: 'Simulation von Erlösen, Ladekosten und CO₂-Emissionen mit bidirektionalem Laden auf Basis externer Signale. MILP-basierte Optimierung.',
    icon: BatteryCharging,
    enabled: true,
    iconColor: 'purple',
  },
];

interface ModuleSelectorProps {
  onSelect: (module: WizardModule) => void;
}

export default function ModuleSelector({ onSelect }: ModuleSelectorProps) {
  return (
    <div className="min-h-[60vh] flex flex-col justify-center py-12 px-4 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-light text-[#001141]">Simulationsmodul auswählen</h1>
        <p className="text-sm text-slate-500 mt-2">
          Wählen Sie ein Modul, um die Simulation zu starten.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto w-full">
        {MODULES.map((mod, idx) => (
          <button
            key={idx}
            disabled={!mod.enabled}
            onClick={() => mod.enabled && onSelect(mod.id)}
            className={cn(
              'relative flex flex-col items-start text-left p-6 rounded border transition-all',
              mod.enabled
                ? 'border-slate-200 bg-white hover:border-[#0079C0] hover:shadow-md cursor-pointer group'
                : 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
            )}
          >
            {mod.tag && (
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                {mod.tag}
              </span>
            )}

            <div className={cn(
              'flex items-center justify-center w-10 h-10 rounded mb-4',
              !mod.enabled ? 'bg-slate-100 text-slate-400'
              : mod.iconColor === 'green' ? 'bg-[#e8f5f0] text-[#043F2E] group-hover:bg-[#d0ebdf]'
              : mod.iconColor === 'purple' ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
              : 'bg-[#e6f3fc] text-[#0079C0] group-hover:bg-[#cce6f8]'
            )}>
              <mod.icon className="w-5 h-5" />
            </div>

            <p className={cn(
              'font-normal text-sm leading-snug',
              mod.enabled ? 'text-[#001141]' : 'text-slate-400'
            )}>
              {mod.title}
            </p>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {mod.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
