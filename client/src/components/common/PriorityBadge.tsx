import * as React from 'react';
import { cn } from '@/lib/utils';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface PriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority: Priority | string;
}

const priorityConfig: Record<
  Priority,
  { label: string; className: string }
> = {
  CRITICAL: {
    label: 'Critical',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
  },
  HIGH: {
    label: 'High',
    className:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  },
  MEDIUM: {
    label: 'Medium',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  LOW: {
    label: 'Low',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export function PriorityBadge({ priority, className, ...props }: PriorityBadgeProps) {
  const normalized = (priority?.toUpperCase?.() || 'LOW') as Priority;
  const config = priorityConfig[normalized] || priorityConfig.LOW;

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
