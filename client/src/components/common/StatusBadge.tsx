import * as React from 'react';
import { cn } from '@/lib/utils';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: TicketStatus | string;
}

const statusConfig: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  OPEN: {
    label: 'Open',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  },
  RESOLVED: {
    label: 'Resolved',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  CLOSED: {
    label: 'Closed',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const normalized = (status?.toUpperCase?.() || 'OPEN') as TicketStatus;
  const config = statusConfig[normalized] || statusConfig.OPEN;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        config.className,
        className,
      )}
      {...props}
    >
      {config.label}
    </span>
  );
}
