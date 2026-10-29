import * as React from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useReclassify } from '../../hooks/useAdminDetail';
import type { AdminTicket, AiStatus } from '../../types';
import { cn } from '@/lib/utils';

interface AiAnalysisCardProps {
  ticket: AdminTicket;
}

export function AiAnalysisCard({ ticket }: AiAnalysisCardProps) {
  const [reasoningOpen, setReasoningOpen] = React.useState(true);
  const reclassifyMutation = useReclassify(ticket.id);

  const isPending = ticket.aiStatus === 'PENDING' || reclassifyMutation.isPending;
  const isFailed = ticket.aiStatus === 'FAILED';
  const isSkipped = ticket.aiStatus === 'SKIPPED';

  const statusBadgeConfig: Record<
    AiStatus,
    { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
  > = {
    DONE: {
      label: 'Success',
      icon: CheckCircle2,
      className:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    },
    PENDING: {
      label: 'Running',
      icon: Clock,
      className:
        'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 animate-pulse',
    },
    FAILED: {
      label: 'Failed',
      icon: XCircle,
      className:
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
    },
    SKIPPED: {
      label: 'Skipped',
      icon: HelpCircle,
      className:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    },
  };

  const currentStatusConfig =
    statusBadgeConfig[ticket.aiStatus] || statusBadgeConfig.SKIPPED;
  const StatusIcon = currentStatusConfig.icon;

  const handleRetryReclassify = () => {
    if (isPending) return;
    reclassifyMutation.mutate();
  };

  return (
    <Card className="shadow-xs border-border bg-card rounded-xl">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI Triage Analysis</span>
          </CardTitle>

          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs',
              currentStatusConfig.className,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {currentStatusConfig.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {/* Fallback Yellow Banner when Failed or Skipped */}
        {(isFailed || isSkipped) && (
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 text-xs space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>AI Classification Unavailable</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-300/90">
              {ticket.aiError ||
                'AI classification was unavailable or skipped for this ticket. You can categorize manually or retry.'}
            </p>
          </div>
        )}

        {/* Collapsible Reasoning */}
        {ticket.aiReasoning && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setReasoningOpen((v) => !v)}
              className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground text-left py-0.5 transition-colors"
            >
              <span>AI Classification Reasoning</span>
              {reasoningOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            {reasoningOpen && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                {ticket.aiReasoning}
              </div>
            )}
          </div>
        )}

        {/* Retry Reclassify Button */}
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetryReclassify}
            disabled={isPending}
            className="w-full text-xs h-8 gap-1.5 shadow-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
            {isPending ? 'Classifying Ticket...' : 'Retry Reclassify'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
