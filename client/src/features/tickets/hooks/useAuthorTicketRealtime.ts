import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { ticketsKeys } from '../tickets.api';
import type { AuthorTicket, TicketMessage, TicketStatus } from '../types';
import { formatTicketNumber } from '@/lib/formatters';

// Module-level reactive store for unread tickets in the current tab session
const unreadTicketIds = new Set<string>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function markTicketAsUnread(ticketId: string) {
  unreadTicketIds.add(ticketId);
  notifyListeners();
}

export function markTicketAsRead(ticketId: string) {
  if (unreadTicketIds.has(ticketId)) {
    unreadTicketIds.delete(ticketId);
    notifyListeners();
  }
}

export function useUnreadTickets() {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    isTicketUnread: (ticketId: string) => unreadTicketIds.has(ticketId),
    markAsRead: markTicketAsRead,
    unreadCount: unreadTicketIds.size,
  };
}

export function useAuthorTicketRealtime() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle incoming messages
  useSocketEvent('ticket:message', (rawPayload: unknown) => {
    const payload = rawPayload as TicketMessage;
    if (!payload?.ticketId || !payload?.id) return;

    const currentTicketPath = `/tickets/${payload.ticketId}`;
    const isCurrentlyViewing = location.pathname === currentTicketPath;

    // 1. Update messages query cache
    queryClient.setQueryData<TicketMessage[]>(ticketsKeys.messages(payload.ticketId), (old) => {
      if (!old) return [payload];
      if (old.some((m) => m.id === payload.id)) return old; // dedupe
      return [...old, payload];
    });

    // 2. Update ticket detail query cache
    queryClient.setQueryData<AuthorTicket>(ticketsKeys.detail(payload.ticketId), (old) => {
      if (!old) return old;
      const existing = old.messages || [];
      const updatedMessages = existing.some((m) => m.id === payload.id)
        ? existing
        : [...existing, payload];

      return {
        ...old,
        updatedAt: payload.createdAt,
        messages: updatedMessages,
      };
    });

    // 3. Invalidate ticket list queries so row order / preview bumps
    queryClient.invalidateQueries({ queryKey: ticketsKeys.lists() });

    // 4. If author is NOT currently viewing this ticket, show toast & mark unread dot
    if (!isCurrentlyViewing) {
      markTicketAsUnread(payload.ticketId);

      // Attempt to get ticket number from cache if available
      const cachedTicket = queryClient.getQueryData<AuthorTicket>(ticketsKeys.detail(payload.ticketId));
      const formattedNum = formatTicketNumber(cachedTicket?.ticketNumber || payload.ticketId);

      toast.info(`New response on ${formattedNum}`, {
        description: payload.body.length > 80 ? `${payload.body.substring(0, 80)}...` : payload.body,
        action: {
          label: 'View',
          onClick: () => {
            markTicketAsRead(payload.ticketId);
            navigate(currentTicketPath);
          },
        },
      });
    }
  });

  // Handle ticket updates (e.g. status changes)
  useSocketEvent('ticket:updated', (rawPayload: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = rawPayload as any;
    const ticketId = payload?.id || payload?.ticketId;
    if (!ticketId) return;

    // 1. Update ticket detail cache
    queryClient.setQueryData<AuthorTicket>(ticketsKeys.detail(ticketId), (old) => {
      if (!old) return old;
      return {
        ...old,
        status: (payload.status || old.status) as TicketStatus,
        updatedAt: payload.updatedAt || old.updatedAt,
      };
    });

    // 2. Invalidate lists
    queryClient.invalidateQueries({ queryKey: ticketsKeys.lists() });
  });
}
