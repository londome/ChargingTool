import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FormulaLine {
  label: string;
  value?: string;
}

interface FormulaTooltipProps {
  title: string;
  formula?: string;
  description?: string;
  assumptions?: FormulaLine[];
  factors?: FormulaLine[];
  className?: string;
  iconSize?: 'sm' | 'md';
}

export default function FormulaTooltip({
  title,
  formula,
  description,
  assumptions,
  factors,
  className,
  iconSize = 'sm',
}: FormulaTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-help',
            className
          )}
          tabIndex={-1}
        >
          <Info className={cn(iconSize === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-80 p-0 bg-slate-900 border-slate-700 text-white shadow-xl"
      >
        <div className="p-3">
          <p className="font-semibold text-sm mb-1.5 text-white">{title}</p>

          {description && (
            <p className="text-xs text-slate-300 mb-2 leading-relaxed">{description}</p>
          )}

          {formula && (
            <div className="bg-slate-800 rounded px-2.5 py-1.5 mb-2">
              <code className="text-xs font-mono text-blue-300 whitespace-pre-wrap break-all">
                {formula}
              </code>
            </div>
          )}

          {assumptions && assumptions.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Annahmen
              </p>
              <div className="space-y-0.5">
                {assumptions.map((a, i) => (
                  <div key={i} className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-300">{a.label}</span>
                    {a.value && (
                      <span className="text-slate-100 font-mono shrink-0">{a.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {factors && factors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                Faktoren
              </p>
              <div className="space-y-0.5">
                {factors.map((f, i) => (
                  <div key={i} className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-300">{f.label}</span>
                    {f.value && (
                      <span className="text-slate-100 font-mono shrink-0">{f.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
