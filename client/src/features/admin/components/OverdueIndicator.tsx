import { ClockAlert } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface OverdueIndicatorProps {
  isOverdue: boolean;
  className?: string;
}

export function OverdueIndicator({ isOverdue, className }: OverdueIndicatorProps) {
  if (!isOverdue) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center justify-center p-0.5 rounded text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-950/60 cursor-help',
              className,
            )}
            aria-label="Overdue: No first response within SLA"
          >
            <ClockAlert className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs bg-red-900 text-white dark:bg-red-950 border border-red-800">
          No first response within the 24h SLA
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
