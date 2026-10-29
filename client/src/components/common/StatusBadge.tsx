import * as React from 'react';
import { cn } from '@/lib/utils';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: TicketStatus | string;
}

const statusConfig: Record<
  TicketStatus,
  { label: string; className: string; dotClass: string }
> = {
  OPEN: {
    label: 'Open',
    className:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    dotClass: 'bg-sky-600 dark:bg-sky-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className:
      'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    dotClass: 'bg-indigo-600 dark:bg-indigo-400',
  },
  RESOLVED: {
    label: 'Resolved',
    className:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
  },
  CLOSED: {
    label: 'Closed',
    className:
      'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
    dotClass: 'bg-stone-400 dark:bg-stone-500',
  },
};

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const normalized = (status?.toUpperCase?.() || 'OPEN') as TicketStatus;
  const config = statusConfig[normalized] || statusConfig.OPEN;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs transition-colors',
        config.className,
        className,
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dotClass)} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
