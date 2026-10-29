import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { useAuth } from '@/features/auth/useAuth';
import { adminKeys } from '../admin.api';
import type { AdminTicket } from '../types';
import type { TicketMessage } from '@/features/tickets/types';

interface DetailRealtimeOptions {
  ticketId: string;
  onNewAuthorMessage?: () => void;
  onAiReady?: () => void;
}

export function useAdminTicketDetailRealtime({
  ticketId,
  onNewAuthorMessage,
  onAiReady,
}: DetailRealtimeOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. New message in thread (Author message or Admin reply)
  useSocketEvent(
    'ticket:message',
    React.useCallback(
      (rawPayload: unknown) => {
        const data = rawPayload as { ticketId: string; message: TicketMessage };
        if (!data || data.ticketId !== ticketId || !data.message) return;

        queryClient.setQueryData<TicketMessage[]>(adminKeys.ticketMessages(ticketId), (old) => {
          if (!old) return [data.message];
          if (old.some((m) => m.id === data.message.id)) return old;
          return [...old, data.message];
        });

        if (data.message.type === 'AUTHOR_MESSAGE') {
          queryClient.invalidateQueries({ queryKey: adminKeys.draft(ticketId) });
          onNewAuthorMessage?.();
        }
      },
      [ticketId, queryClient, onNewAuthorMessage],
    ),
  );

  // 2. New internal note created
  useSocketEvent(
    'ticket:note',
    React.useCallback(
      (rawPayload: unknown) => {
        const data = rawPayload as { ticketId: string; note: TicketMessage };
        if (!data || data.ticketId !== ticketId || !data.note) return;

        queryClient.setQueryData<TicketMessage[]>(adminKeys.ticketMessages(ticketId), (old) => {
          if (!old) return [data.note];
          if (old.some((m) => m.id === data.note.id)) return old;
          return [...old, data.note];
        });
      },
      [ticketId, queryClient],
    ),
  );

  // 3. Ticket metadata or assignment updated
  useSocketEvent(
    'ticket:updated',
    React.useCallback(
      (rawPayload: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = rawPayload as any;
        if (!data) return;

        const incomingId = data.ticketId || data.id;
        if (!incomingId || incomingId !== ticketId) return;

        const prev = queryClient.getQueryData<AdminTicket>(adminKeys.ticketDetail(ticketId));

        if (data.updatedBy && user && data.updatedBy !== user.id) {
          toast.info('Ticket metadata was updated by another team member');
        }

        const patch = data.ticket || data;
        if (patch && prev) {
          const newAssignedToId =
            patch.assignedToId !== undefined
              ? patch.assignedToId
              : (patch.assignedTo?.id ?? prev.assignedToId);
          queryClient.setQueryData<AdminTicket>(adminKeys.ticketDetail(ticketId), {
            ...prev,
            ...patch,
            assignedToId: newAssignedToId,
            assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : prev.assignedTo,
          });
        } else {
          queryClient.invalidateQueries({ queryKey: adminKeys.ticketDetail(ticketId) });
        }
      },
      [ticketId, queryClient, user],
    ),
  );

  // 4. AI classification or pipeline ready
  useSocketEvent(
    'ticket:ai_ready',
    React.useCallback(
      (data) => {
        if (!data || data.ticketId !== ticketId) return;

        queryClient.invalidateQueries({ queryKey: adminKeys.ticketDetail(ticketId) });
        queryClient.invalidateQueries({ queryKey: adminKeys.draft(ticketId) });
        onAiReady?.();
      },
      [ticketId, queryClient, onAiReady],
    ),
  );
}
