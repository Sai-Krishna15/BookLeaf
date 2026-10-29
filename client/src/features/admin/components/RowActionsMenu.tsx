import * as React from 'react';
import {
  MoreHorizontal,
  UserCheck,
  UserMinus,
  PlayCircle,
  CheckCircle2,
  RotateCcw,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAssignMe, usePatchTicket } from '../hooks/useAdmin';
import type { AdminTicket, TicketStatus } from '../types';
import { useAuth } from '@/features/auth/useAuth';
import { toast } from 'sonner';

interface RowActionsMenuProps {
  ticket: AdminTicket;
}

export function RowActionsMenu({ ticket }: RowActionsMenuProps) {
  const { user } = useAuth();
  const assignMeMutation = useAssignMe();
  const patchTicketMutation = usePatchTicket();

  const assignedId = ticket.assignedToId || ticket.assignedTo?.id || null;
  const isAssignedToMe = Boolean(user?.id && assignedId === user.id);

  const handleAssignToMe = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAssignedToMe) {
      toast.info(`Ticket ${ticket.ticketNumber} is already assigned to you.`);
      return;
    }
    assignMeMutation.mutate(ticket.id);
  };

  const handleUnassign = (e: React.MouseEvent) => {
    e.stopPropagation();
    patchTicketMutation.mutate(
      { id: ticket.id, payload: { assignedToId: null } },
      {
        onSuccess: () => {
          toast.success(`Unassigned ticket ${ticket.ticketNumber}`);
        },
      },
    );
  };

  const handleSetStatus = (e: React.MouseEvent, status: TicketStatus, label: string) => {
    e.stopPropagation();
    if (ticket.status === status) return;
    patchTicketMutation.mutate(
      { id: ticket.id, payload: { status } },
      {
        onSuccess: () => {
          toast.success(`${label} ${ticket.ticketNumber}`);
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
        <DropdownMenuContent align="end" className="w-52 text-xs">
          {isAssignedToMe ? (
            <DropdownMenuItem
              onClick={handleUnassign}
              disabled={patchTicketMutation.isPending}
              className="cursor-pointer gap-2"
            >
              <UserMinus className="h-4 w-4 text-muted-foreground" />
              <span>Unassign ticket</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={handleAssignToMe}
              disabled={assignMeMutation.isPending}
              className="cursor-pointer gap-2"
            >
              <UserCheck className="h-4 w-4 text-primary" />
              <span>Assign to me</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Contextual status actions based on current status */}
          {ticket.status === 'OPEN' && (
            <>
              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'IN_PROGRESS', 'Marked In Progress')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <PlayCircle className="h-4 w-4 text-violet-500" />
                <span>Mark In Progress</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'RESOLVED', 'Marked Resolved')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Mark Resolved</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'CLOSED', 'Closed')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                <span>Close Ticket</span>
              </DropdownMenuItem>
            </>
          )}

          {ticket.status === 'IN_PROGRESS' && (
            <>
              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'RESOLVED', 'Marked Resolved')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Mark Resolved</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'CLOSED', 'Closed')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                <span>Close Ticket</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'OPEN', 'Moved back to Open')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <RotateCcw className="h-4 w-4 text-blue-500" />
                <span>Move to Open</span>
              </DropdownMenuItem>
            </>
          )}

          {ticket.status === 'RESOLVED' && (
            <>
              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'CLOSED', 'Closed')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                <span>Close Ticket</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => handleSetStatus(e, 'IN_PROGRESS', 'Reopened')}
                disabled={patchTicketMutation.isPending}
                className="cursor-pointer gap-2"
              >
                <RotateCcw className="h-4 w-4 text-amber-500" />
                <span>Reopen Ticket</span>
              </DropdownMenuItem>
            </>
          )}

          {ticket.status === 'CLOSED' && (
            <DropdownMenuItem
              onClick={(e) => handleSetStatus(e, 'IN_PROGRESS', 'Reopened')}
              disabled={patchTicketMutation.isPending}
              className="cursor-pointer gap-2"
            >
              <RotateCcw className="h-4 w-4 text-amber-500" />
              <span>Reopen Ticket</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
