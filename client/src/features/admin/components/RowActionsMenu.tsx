import * as React from 'react';
import { MoreHorizontal, UserCheck, PlayCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAssignMe, usePatchTicket } from '../hooks/useAdmin';
import type { AdminTicket } from '../types';
import { useAuth } from '@/features/auth/useAuth';
import { toast } from 'sonner';

interface RowActionsMenuProps {
  ticket: AdminTicket;
}

export function RowActionsMenu({ ticket }: RowActionsMenuProps) {
  const { user } = useAuth();
  const assignMeMutation = useAssignMe();
  const patchTicketMutation = usePatchTicket();

  const isAssignedToMe = user && ticket.assignedToId === user.id;
  const isResolved = ticket.status === 'RESOLVED';
  const isInProgress = ticket.status === 'IN_PROGRESS';

  const handleAssignToMe = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAssignedToMe) {
      toast.info(`Ticket ${ticket.ticketNumber} is already assigned to you.`);
      return;
    }
    assignMeMutation.mutate(ticket.id);
  };

  const handleMarkInProgress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInProgress) return;
    patchTicketMutation.mutate(
      { id: ticket.id, payload: { status: 'IN_PROGRESS' } },
      {
        onSuccess: () => {
          toast.success(`Marked ${ticket.ticketNumber} as In Progress`);
        },
      },
    );
  };

  const handleMarkResolved = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isResolved) return;
    patchTicketMutation.mutate(
      { id: ticket.id, payload: { status: 'RESOLVED' } },
      {
        onSuccess: () => {
          toast.success(`Marked ${ticket.ticketNumber} as Resolved`);
        },
      },
    );
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label={`Actions for ticket ${ticket.ticketNumber}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 text-xs">
          <DropdownMenuItem
            onClick={handleAssignToMe}
            disabled={isAssignedToMe || assignMeMutation.isPending}
            className="cursor-pointer gap-2"
          >
            <UserCheck className="h-4 w-4 text-primary" />
            <span>{isAssignedToMe ? 'Assigned to you' : 'Assign to me'}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleMarkInProgress}
            disabled={isInProgress || patchTicketMutation.isPending}
            className="cursor-pointer gap-2"
          >
            <PlayCircle className="h-4 w-4 text-violet-500" />
            <span>Mark In Progress</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleMarkResolved}
            disabled={isResolved || patchTicketMutation.isPending}
            className="cursor-pointer gap-2"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Mark Resolved</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
