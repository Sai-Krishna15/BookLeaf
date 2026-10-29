import * as React from 'react';
import { cn } from '@/lib/utils';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface PriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority: Priority | string;
}

const priorityConfig: Record<
  Priority,
  { label: string; className: string; dotClass: string }
> = {
  CRITICAL: {
    label: 'Critical',
    className:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-600 dark:bg-rose-400',
  },
  HIGH: {
    label: 'High',
    className:
      'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    dotClass: 'bg-orange-600 dark:bg-orange-400',
  },
  MEDIUM: {
    label: 'Medium',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-600 dark:bg-amber-400',
  },
  LOW: {
    label: 'Low',
    className:
      'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
    dotClass: 'bg-stone-400 dark:bg-stone-500',
  },
};

export function PriorityBadge({ priority, className, ...props }: PriorityBadgeProps) {
  const normalized = (priority?.toUpperCase?.() || 'LOW') as Priority;
  const config = priorityConfig[normalized] || priorityConfig.LOW;

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
