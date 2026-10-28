import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useAdminTicketRealtime,
  useUnreadAdminTickets,
  useNewTicketsOffPage,
  resetNewTicketsCount,
} from '@/features/admin/hooks/useAdminTicketRealtime';
import { adminKeys } from '@/features/admin/admin.api';
import * as socketHook from '@/hooks/useSocketEvent';
import type { AdminTicket } from '@/features/admin/types';
import type { TicketListResponse } from '@/features/tickets/types';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Siddharth Rao', email: 'siddharth@bookleaf.in', role: 'ADMIN' },
    token: 'mock-token',
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

describe('useAdminTicketRealtime', () => {
  let queryClient: QueryClient;
  let socketCallbacks: Record<string, (payload: unknown) => void> = {};

  const mockTicket: AdminTicket = {
    id: 'ticket-101',
    ticketNumber: 'BL-1001',
    ticketNumberRaw: 1001,
    authorId: 'auth-1',
    bookId: null,
    subject: 'Royalty inquiry',
    description: 'When will Q1 royalties be distributed?',
    status: 'OPEN',
    category: null,
    categorySource: null,
    priority: 'MEDIUM',
    prioritySource: null,
    aiStatus: 'PENDING',
    aiReasoning: null,
    aiError: null,
    needsManualTriage: false,
    assignedToId: null,
    assignedTo: null,
    firstResponseAt: null,
    resolvedAt: null,
    createdAt: '2024-03-01T10:00:00.000Z',
    updatedAt: '2024-03-01T10:00:00.000Z',
    isOverdue: false,
    messageCount: 1,
    author: { id: 'auth-1', name: 'Aarav Patel', email: 'aarav@example.com' },
    book: null,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    socketCallbacks = {};
    resetNewTicketsCount();
    vi.restoreAllMocks();

    vi.spyOn(socketHook, 'useSocketEvent').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: string, handler: any) => {
        socketCallbacks[event] = handler;
      },
    );
  });

  const renderRealtimeHook = (initialEntries = ['/admin/tickets']) => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );

    return renderHook(() => useAdminTicketRealtime(), { wrapper });
  };

  it('subscribes to admin realtime events: ticket:created, ticket:updated, ticket:ai_ready, ticket:message, ticket:note', () => {
    renderRealtimeHook();

    expect(socketCallbacks['ticket:created']).toBeDefined();
    expect(socketCallbacks['ticket:updated']).toBeDefined();
    expect(socketCallbacks['ticket:ai_ready']).toBeDefined();
    expect(socketCallbacks['ticket:message']).toBeDefined();
    expect(socketCallbacks['ticket:note']).toBeDefined();
  });

  it('shows toast for new ticket and coalesces invalidation', () => {
    vi.useFakeTimers();
    const toastInfoSpy = vi.spyOn(toast, 'info');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderRealtimeHook();

    act(() => {
      socketCallbacks['ticket:created']?.({
        ticketId: 'ticket-1042',
        ticketNumber: 1042,
        authorName: 'Aarav Patel',
      });
    });

    expect(toastInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('New ticket BL-1042 from Aarav Patel'),
      expect.anything(),
    );

    // Debounced invalidation fires after 500ms
    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.tickets() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.stats() });

    vi.useRealTimers();
  });

  it('increments newTicketsCount when new ticket arrives while on page > 1 or non-default sort', () => {
    renderRealtimeHook(['/admin/tickets?page=2&sort=urgency']);

    const { result: newTicketsResult } = renderHook(() => useNewTicketsOffPage());
    expect(newTicketsResult.current.newTicketsCount).toBe(0);

    act(() => {
      socketCallbacks['ticket:created']?.({
        ticketId: 'ticket-999',
        ticketNumber: 999,
        authorName: 'Rohan Mehra',
      });
    });

    expect(newTicketsResult.current.newTicketsCount).toBe(1);
  });

  it('immediately patches cached queue row on ticket:updated and ticket:ai_ready', () => {
    renderRealtimeHook();

    // Populate initial ticket in queue cache
    const initialList: TicketListResponse<AdminTicket> = {
      data: [mockTicket],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    };
    queryClient.setQueryData(adminKeys.ticketList({}), initialList);

    // Simulate ticket:ai_ready event
    act(() => {
      socketCallbacks['ticket:ai_ready']?.({
        ticketId: 'ticket-101',
        category: 'ROYALTY_PAYMENTS',
        categorySource: 'AI',
        priority: 'CRITICAL',
        prioritySource: 'AI',
        aiStatus: 'DONE',
        needsManualTriage: false,
      });
    });

    const cached = queryClient.getQueryData<TicketListResponse<AdminTicket>>(adminKeys.ticketList({}));
    const updatedTicket = cached?.data.find((t) => t.id === 'ticket-101');

    expect(updatedTicket?.category).toBe('ROYALTY_PAYMENTS');
    expect(updatedTicket?.priority).toBe('CRITICAL');
    expect(updatedTicket?.aiStatus).toBe('DONE');
  });

  it('shows toast for author follow-up message and marks ticket as unread', () => {
    const toastInfoSpy = vi.spyOn(toast, 'info');
    renderRealtimeHook(['/admin/tickets']);

    const { result: unreadResult } = renderHook(() => useUnreadAdminTickets());
    expect(unreadResult.current.isTicketUnread('ticket-101')).toBe(false);

    act(() => {
      socketCallbacks['ticket:message']?.({
        ticketId: 'ticket-101',
        ticketNumber: 1001,
        type: 'AUTHOR_MESSAGE',
        body: 'Any update on my inquiry?',
        sender: { id: 'auth-1', displayName: 'Aarav Patel' },
      });
    });

    expect(toastInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('New message on BL-1001'),
      expect.anything(),
    );
    expect(unreadResult.current.isTicketUnread('ticket-101')).toBe(true);
  });

  it('invalidates note cache without toasting current admin on ticket:note', () => {
    const toastInfoSpy = vi.spyOn(toast, 'info');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderRealtimeHook();

    act(() => {
      socketCallbacks['ticket:note']?.({
        ticketId: 'ticket-101',
        senderId: 'admin-1',
        body: 'Internal audit verified invoice.',
      });
    });

    // Invalidates ticket detail without notifying self
    expect(toastInfoSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.ticketDetail('ticket-101'),
    });
  });
});
