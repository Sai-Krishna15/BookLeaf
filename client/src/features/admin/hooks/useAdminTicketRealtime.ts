import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { useAuth } from '@/features/auth/useAuth';
import { adminKeys } from '../admin.api';
import type { AdminTicket } from '../types';
import type { TicketListResponse } from '@/features/tickets/types';
import { formatTicketNumber } from '@/lib/formatters';

// Unread admin tracking for author follow-ups
const unreadTicketsSet = new Set<string>();
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function markAdminTicketAsUnread(ticketId: string) {
  unreadTicketsSet.add(ticketId);
  notifyListeners();
}

export function markAdminTicketAsRead(ticketId: string) {
  if (unreadTicketsSet.has(ticketId)) {
    unreadTicketsSet.delete(ticketId);
    notifyListeners();
  }
}

export function clearUnreadAdminTickets() {
  unreadTicketsSet.clear();
  newTicketsCount = 0;
  notifyListeners();
  notifyNewTicketsListeners();
}

export function useUnreadAdminTickets() {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    listeners.add(forceUpdate);
    return () => {
      listeners.delete(forceUpdate);
    };
  }, []);

  return {
    isTicketUnread: (ticketId: string) => unreadTicketsSet.has(ticketId),
    markAsRead: markAdminTicketAsRead,
    markAsUnread: markAdminTicketAsUnread,
  };
}

// Global count of new tickets received off page 1
let newTicketsCount = 0;
const newTicketsListeners = new Set<() => void>();

function notifyNewTicketsListeners() {
  for (const listener of newTicketsListeners) {
    listener();
  }
}

export function incrementNewTicketsCount() {
  newTicketsCount += 1;
  notifyNewTicketsListeners();
}

export function resetNewTicketsCount() {
  newTicketsCount = 0;
  notifyNewTicketsListeners();
}

export function useNewTicketsOffPage() {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    newTicketsListeners.add(forceUpdate);
    return () => {
      newTicketsListeners.delete(forceUpdate);
    };
  }, []);

  return {
    newTicketsCount,
    resetCount: resetNewTicketsCount,
  };
}

export function useAdminTicketRealtime() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Debounced queue and stats invalidation to coalesce bursts (500ms)
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedInvalidate = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tickets() });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    }, 500);
  }, [queryClient]);

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 1. ticket:created
  useSocketEvent('ticket:created', (rawPayload: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = rawPayload as any;
    if (!payload) return;

    const ticketId = payload.ticketId || payload.id;
    const ticketNumStr = formatTicketNumber(payload.ticketNumber || ticketId);
    const authorName = payload.author?.name || payload.authorName || 'an author';

    // Show toast with view action
    toast.info(`New ticket ${ticketNumStr} from ${authorName}`, {
      action: {
        label: 'View',
        onClick: () => {
          markAdminTicketAsRead(ticketId);
          navigate(`/admin/tickets/${ticketId}`);
        },
      },
    });

    // Check if admin is currently off page 1 or non-urgency sort
    const searchParams = new URLSearchParams(location.search);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const sort = searchParams.get('sort') || 'urgency';

    if (page > 1 || sort !== 'urgency') {
      incrementNewTicketsCount();
    }

    debouncedInvalidate();
  });

  // 2. ticket:updated and ticket:ai_ready
  const handleTicketUpdate = React.useCallback(
    (rawPayload: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = rawPayload as any;
      if (!payload) return;

      const ticketId = payload.ticketId || payload.id;
      if (!ticketId) return;

      // Immediately patch matching row across cached ticket pages
      queryClient.setQueriesData<TicketListResponse<AdminTicket>>(
        { queryKey: adminKeys.tickets() },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t) => {
              if (t.id !== ticketId) return t;
              return {
                ...t,
                status: payload.status ?? t.status,
                category: payload.category !== undefined ? payload.category : t.category,
                priority: payload.priority ?? t.priority,
                categorySource: payload.categorySource ?? t.categorySource,
                prioritySource: payload.prioritySource ?? t.prioritySource,
                aiStatus: payload.aiStatus ?? t.aiStatus,
                needsManualTriage:
                  payload.needsManualTriage !== undefined
                    ? payload.needsManualTriage
                    : t.needsManualTriage,
                assignedToId:
                  payload.assignedToId !== undefined
                    ? payload.assignedToId
                    : (payload.assignedTo?.id !== undefined ? payload.assignedTo?.id : t.assignedToId),
                assignedTo: payload.assignedTo !== undefined ? payload.assignedTo : t.assignedTo,
              };
            }),
          };
        },
      );

      // Immediately patch detail cache if present
      queryClient.setQueryData<AdminTicket>(adminKeys.ticketDetail(ticketId), (old) => {
        if (!old) return old;
        return {
          ...old,
          status: payload.status ?? old.status,
          category: payload.category !== undefined ? payload.category : old.category,
          priority: payload.priority ?? old.priority,
          categorySource: payload.categorySource ?? old.categorySource,
          prioritySource: payload.prioritySource ?? old.prioritySource,
          aiStatus: payload.aiStatus ?? old.aiStatus,
          needsManualTriage:
            payload.needsManualTriage !== undefined
              ? payload.needsManualTriage
              : old.needsManualTriage,
          assignedToId:
            payload.assignedToId !== undefined
              ? payload.assignedToId
              : (payload.assignedTo?.id !== undefined ? payload.assignedTo?.id : old.assignedToId),
          assignedTo: payload.assignedTo !== undefined ? payload.assignedTo : old.assignedTo,
        };
      });

      debouncedInvalidate();
    },
    [queryClient, debouncedInvalidate],
  );

  useSocketEvent('ticket:updated', handleTicketUpdate);
  useSocketEvent('ticket:ai_ready', handleTicketUpdate);

  // 3. ticket:message
  useSocketEvent('ticket:message', (rawPayload: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = rawPayload as any;
    if (!payload?.ticketId) return;

    const isCurrentTicket = location.pathname === `/admin/tickets/${payload.ticketId}`;

    // If author sent a message (follow-up)
    if (payload.type === 'AUTHOR_MESSAGE') {
      const ticketNumStr = formatTicketNumber(payload.ticketNumber || payload.ticketId);

      if (!isCurrentTicket) {
        markAdminTicketAsUnread(payload.ticketId);
        toast.info(`New message on ${ticketNumStr}`, {
          description: payload.body?.length > 70 ? `${payload.body.substring(0, 70)}...` : payload.body,
          action: {
            label: 'View',
            onClick: () => {
              markAdminTicketAsRead(payload.ticketId);
              navigate(`/admin/tickets/${payload.ticketId}`);
            },
          },
        });
      }
    }

    // Invalidate messages/detail caches for this ticket
    queryClient.invalidateQueries({ queryKey: adminKeys.ticketDetail(payload.ticketId) });
    debouncedInvalidate();
  });

  // 4. ticket:note
  useSocketEvent('ticket:note', (rawPayload: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = rawPayload as any;
    if (!payload?.ticketId) return;

    // Invalidate notes/detail only
    queryClient.invalidateQueries({ queryKey: adminKeys.ticketDetail(payload.ticketId) });

    // If note was created by another admin, show subtle notification
    if (payload.senderId && payload.senderId !== user?.id) {
      toast.info('New internal note added', {
        description: payload.body?.length > 60 ? `${payload.body.substring(0, 60)}...` : payload.body,
      });
    }
  });
}
