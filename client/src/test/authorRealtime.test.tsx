import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useAuthorTicketRealtime,
  useUnreadTickets,
} from '@/features/tickets/hooks/useAuthorTicketRealtime';
import { ticketsKeys } from '@/features/tickets/tickets.api';
import * as socketHook from '@/hooks/useSocketEvent';
import type { AuthorTicket, TicketMessage } from '@/features/tickets/types';

describe('useAuthorTicketRealtime', () => {
  let queryClient: QueryClient;
  let socketCallbacks: Record<string, (payload: unknown) => void> = {};

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    socketCallbacks = {};
    vi.restoreAllMocks();

    vi.spyOn(socketHook, 'useSocketEvent').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: string, handler: any) => {
        socketCallbacks[event] = handler;
      },
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/books']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  it('subscribes to ticket:message and ticket:updated socket events', () => {
    renderHook(() => useAuthorTicketRealtime(), { wrapper });

    expect(socketCallbacks['ticket:message']).toBeDefined();
    expect(socketCallbacks['ticket:updated']).toBeDefined();
  });

  it('appends message to ticket cache and dedupes on duplicate messages', () => {
    const existingTicket: AuthorTicket = {
      id: 'ticket-1',
      ticketNumber: 'BL-1001',
      subject: 'Inquiry',
      description: 'Desc',
      status: 'OPEN',
      book: null,
      attachments: [],
      createdAt: '2024-03-01T10:00:00.000Z',
      updatedAt: '2024-03-01T10:00:00.000Z',
      messages: [],
    };

    queryClient.setQueryData(ticketsKeys.detail('ticket-1'), existingTicket);
    queryClient.setQueryData(ticketsKeys.messages('ticket-1'), []);

    renderHook(() => useAuthorTicketRealtime(), { wrapper });

    const newMsg: TicketMessage = {
      id: 'msg-99',
      ticketId: 'ticket-1',
      type: 'ADMIN_REPLY',
      body: 'Response from support',
      aiAssisted: true,
      createdAt: '2024-03-01T11:00:00.000Z',
      sender: { id: 'admin-1', displayName: 'BookLeaf Support' },
    };

    // First arrival
    act(() => {
      socketCallbacks['ticket:message']?.(newMsg);
    });

    const cachedMessages = queryClient.getQueryData<TicketMessage[]>(ticketsKeys.messages('ticket-1'));
    expect(cachedMessages).toHaveLength(1);
    expect(cachedMessages?.[0]?.id).toBe('msg-99');

    // Duplicate arrival (dedupe test)
    act(() => {
      socketCallbacks['ticket:message']?.(newMsg);
    });

    const dedupedMessages = queryClient.getQueryData<TicketMessage[]>(ticketsKeys.messages('ticket-1'));
    expect(dedupedMessages).toHaveLength(1);
  });

  it('shows toast and marks ticket as unread when message arrives for a ticket not currently being viewed', () => {
    const toastSpy = vi.spyOn(toast, 'info');

    const { result: unreadResult } = renderHook(() => useUnreadTickets());
    renderHook(() => useAuthorTicketRealtime(), { wrapper });

    const newMsg: TicketMessage = {
      id: 'msg-101',
      ticketId: 'ticket-2',
      type: 'ADMIN_REPLY',
      body: 'Your ISBN has been assigned successfully!',
      aiAssisted: false,
      createdAt: '2024-03-01T12:00:00.000Z',
      sender: { id: 'admin-1', displayName: 'BookLeaf Support' },
    };

    act(() => {
      socketCallbacks['ticket:message']?.(newMsg);
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining('New response'),
      expect.objectContaining({
        description: expect.stringContaining('Your ISBN has been assigned'),
      }),
    );

    expect(unreadResult.current.isTicketUnread('ticket-2')).toBe(true);
  });

  it('updates ticket status and updatedAt on ticket:updated event', () => {
    const existingTicket: AuthorTicket = {
      id: 'ticket-3',
      ticketNumber: 'BL-1003',
      subject: 'Inquiry',
      description: 'Desc',
      status: 'OPEN',
      book: null,
      attachments: [],
      createdAt: '2024-03-01T10:00:00.000Z',
      updatedAt: '2024-03-01T10:00:00.000Z',
    };

    queryClient.setQueryData(ticketsKeys.detail('ticket-3'), existingTicket);

    renderHook(() => useAuthorTicketRealtime(), { wrapper });

    act(() => {
      socketCallbacks['ticket:updated']?.({
        id: 'ticket-3',
        status: 'RESOLVED',
        updatedAt: '2024-03-01T14:00:00.000Z',
      });
    });

    const updated = queryClient.getQueryData<AuthorTicket>(ticketsKeys.detail('ticket-3'));
    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.updatedAt).toBe('2024-03-01T14:00:00.000Z');
  });
});
