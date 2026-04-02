import { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  unit?: string;
  icon?: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'slate';
  tooltip?: string;
  loading?: boolean;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    value: 'text-blue-700',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    value: 'text-green-700',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    value: 'text-red-700',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    value: 'text-amber-700',
  },
  slate: {
    bg: 'bg-slate-50',
    icon: 'text-slate-600',
    value: 'text-slate-700',
  },
};

export default function KPICard({
  title, value, subtitle, unit, icon: Icon, trend, trendLabel,
  color = 'slate', tooltip, loading = false,
}: KPICardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
        <div className="h-7 bg-slate-200 rounded w-16 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-20" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-slate-300 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {Icon && (
          <div className={cn('p-1.5 rounded-lg', colors.bg)}>
            <Icon className={cn('h-4 w-4', colors.icon)} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-1">
        <p className={cn('text-2xl font-bold', colors.value)}>
          {value}
        </p>
        {unit && (
          <span className="text-sm text-slate-400 mb-0.5 ml-1">{unit}</span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}

      {trend !== undefined && (
        <div className={cn(
          'flex items-center gap-0.5 text-xs font-medium mt-1.5',
          trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-slate-400'
        )}>
          <span>{trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}</span>
          <span>{Math.abs(trend).toFixed(1)}%{trendLabel ? ` ${trendLabel}` : ''}</span>
        </div>
      )}
    </div>
  );
}
