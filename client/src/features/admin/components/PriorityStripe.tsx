import type { Priority } from '@/features/tickets/types';
import { cn } from '@/lib/utils';

interface PriorityStripeProps {
  priority: Priority;
  className?: string;
}

export function PriorityStripe({ priority, className }: PriorityStripeProps) {
  const stripeColors: Record<Priority, string> = {
    CRITICAL: 'bg-red-500 dark:bg-red-600',
    HIGH: 'bg-orange-500 dark:bg-orange-600',
    MEDIUM: 'bg-amber-500 dark:bg-amber-600',
    LOW: 'bg-slate-400 dark:bg-slate-500',
  };

  return (
    <div
      className={cn('w-1 h-full min-h-[40px] rounded-full shrink-0', stripeColors[priority] || 'bg-slate-400', className)}
      aria-hidden="true"
    />
  );
}
