import { Info, Clock, CheckCircle2, AlertOctagon } from 'lucide-react';
import type { TicketStatus } from '@/features/tickets/types';
import { cn } from '@/lib/utils';

interface TicketStatusNoteProps {
  status: TicketStatus | string;
  className?: string;
}

const statusNotes: Record<
  TicketStatus,
  { title: string; description: string; icon: typeof Info; className: string }
> = {
  OPEN: {
    title: 'Query Received',
    description: "We've received your query. A BookLeaf support specialist will review it shortly.",
    icon: Clock,
    className: 'bg-blue-50/70 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
  },
  IN_PROGRESS: {
    title: 'In Progress',
    description: 'Our support team is actively working on your ticket.',
    icon: Info,
    className: 'bg-violet-50/70 border-violet-200 text-violet-900 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-300',
  },
  RESOLVED: {
    title: 'Marked as Resolved',
    description: 'This query has been resolved. If you still need assistance, you can reply below to reopen it.',
    icon: CheckCircle2,
    className: 'bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  },
  CLOSED: {
    title: 'Ticket Closed',
    description: 'This ticket is closed and no longer accepting follow-up replies. Please submit a new query if you have further questions.',
    icon: AlertOctagon,
    className: 'bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300',
  },
};

export function TicketStatusNote({ status, className }: TicketStatusNoteProps) {
  const normalized = (status?.toUpperCase() || 'OPEN') as TicketStatus;
  const note = statusNotes[normalized] || statusNotes.OPEN;
  const Icon = note.icon;

  return (
    <div className={cn('flex items-start gap-3 p-3.5 rounded-lg border text-xs', note.className, className)}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">{note.title}</p>
        <p className="mt-0.5 opacity-90 leading-relaxed">{note.description}</p>
      </div>
    </div>
  );
}
