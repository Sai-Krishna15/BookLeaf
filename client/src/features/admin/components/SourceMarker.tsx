import { Sparkles, Bot, UserCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FieldSource } from '@/features/tickets/types';
import { cn } from '@/lib/utils';

interface SourceMarkerProps {
  source?: FieldSource | null;
  className?: string;
}

export function SourceMarker({ source, className }: SourceMarkerProps) {
  if (!source) return null;

  const config = {
    AI: {
      icon: Sparkles,
      label: 'AI suggested',
      color: 'text-purple-600 dark:text-purple-400',
    },
    FALLBACK: {
      icon: Bot,
      label: 'Auto rules',
      color: 'text-amber-600 dark:text-amber-400',
    },
    ADMIN: {
      icon: UserCheck,
      label: 'Manual override',
      color: 'text-blue-600 dark:text-blue-400',
    },
  }[source] || {
    icon: Bot,
    label: 'Auto rules',
    color: 'text-muted-foreground',
  };

  const Icon = config.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center justify-center p-0.5 rounded hover:bg-muted/60 cursor-help',
              className,
            )}
            aria-label={config.label}
          >
            <Icon className={cn('h-3 w-3 shrink-0', config.color)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
