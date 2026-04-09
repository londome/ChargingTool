import { cn } from '@/lib/utils';
import { FeasibilityStatus } from '@shared/types';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: FeasibilityStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<FeasibilityStatus, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  [FeasibilityStatus.FEASIBLE]: {
    label: 'Machbar',
    className: 'bg-[#e8f5f0] text-[#043F2E] border-green-200',
    icon: CheckCircle2,
  },
  [FeasibilityStatus.FEASIBLE_WITH_CHARGING]: {
    label: 'Mit Zwischenladen',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: AlertCircle,
  },
  [FeasibilityStatus.NOT_FEASIBLE]: {
    label: 'Nicht machbar',
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle,
  },
  [FeasibilityStatus.UNKNOWN]: {
    label: 'Unbekannt',
    className: 'bg-slate-50 text-slate-500 border-slate-200',
    icon: AlertCircle,
  },
};

export default function StatusBadge({ status, showIcon = true, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const IconComponent = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        config.className
      )}
    >
      {showIcon && (
        <IconComponent className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      )}
      {config.label}
    </span>
  );
}
