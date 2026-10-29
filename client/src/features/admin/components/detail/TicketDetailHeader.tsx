import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { CategoryBadge } from '@/components/common/CategoryBadge';
import { SourceMarker } from '../SourceMarker';
import { OverdueIndicator } from '../OverdueIndicator';
import { formatAge, formatDateTime, formatTicketNumber } from '@/lib/formatters';
import type { AdminTicket } from '../../types';

interface TicketDetailHeaderProps {
  ticket: AdminTicket;
}

export function TicketDetailHeader({ ticket }: TicketDetailHeaderProps) {
  const location = useLocation();
  const backTarget = (location.state as { from?: string } | null)?.from || '/admin/tickets';

  return (
    <div className="space-y-3 pb-2 border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <Link to={backTarget}>
            <ArrowLeft className="h-4 w-4" />
            Back to Queue
          </Link>
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Created {formatDateTime(ticket.createdAt)} ({formatAge(ticket.createdAt, ticket.resolvedAt)} ago)
          </span>
          {ticket.isOverdue && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
              <OverdueIndicator isOverdue={true} />
              <span>Overdue SLA</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-primary">
            {formatTicketNumber(ticket.ticketNumber || ticket.id)}
          </span>
          <span className="text-muted-foreground text-sm">•</span>
          <span className="text-sm text-muted-foreground">
            Author: <strong className="text-foreground">{ticket.author.name}</strong> ({ticket.author.email})
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
          {ticket.subject}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <StatusBadge status={ticket.status} />

        <div className="inline-flex items-center gap-1">
          <PriorityBadge priority={ticket.priority} />
          {ticket.prioritySource && <SourceMarker source={ticket.prioritySource} />}
        </div>

        <div className="inline-flex items-center gap-1">
          <CategoryBadge category={ticket.category} />
          {ticket.categorySource && <SourceMarker source={ticket.categorySource} />}
        </div>

        {ticket.needsManualTriage && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 shadow-xs">
            <AlertTriangle className="h-3 w-3 text-amber-700 dark:text-amber-400" />
            Needs Triage
          </span>
        )}
      </div>
    </div>
  );
}
