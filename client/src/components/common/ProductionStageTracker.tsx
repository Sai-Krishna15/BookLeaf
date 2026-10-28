import { Check, Circle } from 'lucide-react';
import type { StageProgress } from '@/features/books/types';
import { cn } from '@/lib/utils';

interface ProductionStageTrackerProps {
  stages?: StageProgress[] | null;
  currentStage?: string | null;
  currentStageIndex?: number | null;
  rawStatus?: string;
  className?: string;
}

export function ProductionStageTracker({
  stages,
  currentStage,
  currentStageIndex: _currentStageIndex,
  rawStatus,
  className,
}: ProductionStageTrackerProps) {
  // If stages array is provided from the API
  if (stages && stages.length > 0) {
    const activeStage = stages.find((s) => s.isCurrent);
    const activeStepText = activeStage
      ? `Step ${activeStage.step} of ${activeStage.totalSteps}: ${activeStage.label}`
      : 'In Production';

    return (
      <div className={cn('space-y-3', className)} aria-label={`Production Progress: ${activeStepText}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-primary">{activeStepText}</span>
          <span className="text-muted-foreground text-[11px]">Royalties start after publication</span>
        </div>

        {/* 9-step progress bar */}
        <ol className="flex items-center w-full gap-1 sm:gap-1.5" role="list">
          {stages.map((stage) => {
            const isDone = stage.isComplete;
            const isCurr = stage.isCurrent;

            return (
              <li
                key={stage.stage}
                className="flex-1 flex flex-col items-center group relative"
                title={`${stage.label} (${isDone ? 'Completed' : isCurr ? 'In Progress' : 'Upcoming'})`}
              >
                <div
                  className={cn(
                    'h-1.5 w-full rounded-full transition-all duration-300',
                    isDone && 'bg-emerald-500',
                    isCurr && 'bg-primary ring-2 ring-primary/30',
                    !isDone && !isCurr && 'bg-muted dark:bg-muted/60',
                  )}
                />
                <span className="sr-only">
                  {stage.label}: {isDone ? 'Completed' : isCurr ? 'Current Step' : 'Upcoming'}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Stages chips row for tablet/desktop */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {stages.map((stage) => (
            <span
              key={stage.stage}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                stage.isComplete &&
                  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
                stage.isCurrent &&
                  'bg-primary/10 text-primary border-primary/30 font-semibold ring-1 ring-primary/20',
                !stage.isComplete &&
                  !stage.isCurrent &&
                  'bg-muted/40 text-muted-foreground border-border/50 opacity-60',
              )}
            >
              {stage.isComplete ? (
                <Check className="h-2.5 w-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="h-2 w-2 shrink-0 fill-current opacity-40" />
              )}
              <span>{stage.label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Fallback if status is unparseable
  return (
    <div className={cn('p-3 rounded-lg bg-muted/50 border border-border text-xs', className)}>
      <span className="font-semibold text-foreground">Status: </span>
      <span className="text-muted-foreground">{rawStatus || currentStage || 'In Production'}</span>
      <div className="text-[11px] text-muted-foreground mt-1">
        Royalties begin once production stages conclude and the book is live.
      </div>
    </div>
  );
}
