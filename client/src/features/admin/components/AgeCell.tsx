import { Check } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatAge, formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface AgeCellProps {
  createdAt: string;
  resolvedAt?: string | null;
  className?: string;
}

export function AgeCell({ createdAt, resolvedAt, className }: AgeCellProps) {
  const age = formatAge(createdAt, resolvedAt);
  const isResolved = !!resolvedAt;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 font-mono text-xs text-muted-foreground cursor-help whitespace-nowrap',
              isResolved && 'text-emerald-600 dark:text-emerald-400 font-medium',
              className,
            )}
          >
            {isResolved && <Check className="h-3 w-3 shrink-0" />}
            <span>{age}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs space-y-1">
          <p>Created: {formatDateTime(createdAt)}</p>
          {isResolved && <p>Resolved: {formatDateTime(resolvedAt)}</p>}
          {isResolved && <p className="text-[10px] text-muted-foreground">Total time open</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
