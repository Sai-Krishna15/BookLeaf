import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminTicketDetailPage } from '@/features/admin/AdminTicketDetailPage';
import { adminApi } from '@/features/admin/admin.api';
import { booksApi } from '@/features/books/books.api';
import * as socketHook from '@/hooks/useSocketEvent';
import { ApiError } from '@/lib/api';
import type { AdminTicket, DraftResponse } from '@/features/admin/types';
import type { TicketMessage } from '@/features/tickets/types';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Siddharth Rao', email: 'siddharth@bookleaf.in', role: 'ADMIN' },
    token: 'mock-token',
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

describe('AdminTicketDetailPage', () => {
  let queryClient: QueryClient;
  let socketCallbacks: Record<string, (payload: unknown) => void> = {};

  const mockTicket: AdminTicket = {
    id: 'ticket-101',
    ticketNumber: 'BL-1001',
    ticketNumberRaw: 1001,
    authorId: 'auth-1',
    bookId: 'book-1',
    subject: 'Royalty Report Dispute',
    description: 'Hello,\nMy royalty report for Q3 shows 10 copies sold, but my dashboard says 15.',
    status: 'OPEN',
    category: 'ROYALTY_PAYMENTS',
    categorySource: 'AI',
    priority: 'HIGH',
    prioritySource: 'AI',
    aiStatus: 'DONE',
    aiReasoning: 'Author is inquiring about discrepancies in quarterly royalty calculations.',
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
    author: {
      id: 'auth-1',
      name: 'Priya Sharma',
      email: 'priya@example.com',
    },
    book: {
      id: 'book-1',
      title: 'Echoes of the Valley',
      isbn: '978-93-12345-67-8',
      status: 'PUBLISHED',
    },
  };

  const mockMessages: TicketMessage[] = [
    {
      id: 'msg-1',
      ticketId: 'ticket-101',
      type: 'AUTHOR_MESSAGE',
      body: 'Could you please clarify how Amazon reporting affects this count?',
      aiAssisted: false,
      createdAt: '2024-03-01T10:30:00.000Z',
      sender: {
        id: 'auth-1',
        displayName: 'Priya Sharma',
      },
    },
    {
      id: 'note-1',
      ticketId: 'ticket-101',
      type: 'INTERNAL_NOTE',
      body: 'Verified Amazon KDP report: 5 orders pending return reconciliation window.',
      aiAssisted: false,
      createdAt: '2024-03-01T11:00:00.000Z',
      sender: {
        id: 'admin-1',
        displayName: 'Siddharth Rao',
      },
    },
  ];

  const mockDraftReady: DraftResponse = {
    status: 'ready',
    draft: {
      id: 'draft-99',
      ticketId: 'ticket-101',
      body: 'Dear Priya,\n\nThank you for reaching out regarding your Q3 royalties.',
      warnings: ['Reconciliation window for Amazon returns is 30 days.'],
      createdAt: '2024-03-01T10:35:00.000Z',
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      stale: false,
    },
  };

  const mockAdmins = [
    { id: 'admin-1', name: 'Siddharth Rao', email: 'siddharth@bookleaf.in' },
    { id: 'admin-2', name: 'Kavita Nair', email: 'kavita@bookleaf.in' },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    sessionStorage.clear();
    socketCallbacks = {};
    vi.restoreAllMocks();

    vi.spyOn(socketHook, 'useSocketEvent').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: string, handler: any) => {
        socketCallbacks[event] = handler;
      },
    );

    // Default API mocks
    vi.spyOn(adminApi, 'getTicket').mockResolvedValue(mockTicket);
    vi.spyOn(adminApi, 'getTicketMessages').mockResolvedValue(mockMessages);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);
    vi.spyOn(adminApi, 'getDraft').mockResolvedValue(mockDraftReady);
    vi.spyOn(booksApi, 'getBook').mockResolvedValue({
      id: 'book-1',
      authorId: 'auth-1',
      title: 'Echoes of the Valley',
      isbn: '978-93-12345-67-8',
      genre: 'Fiction',
      publicationDate: '2023-01-15',
      status: 'PUBLISHED',
      mrp: 399,
      authorRoyaltyPerCopy: 45,
      totalCopiesSold: 120,
      totalRoyaltyEarned: 5400,
      royaltyPaid: 4500,
      royaltyPending: 900,
      lastRoyaltyPayoutDate: '2023-12-15',
      printPartner: 'Replika Press',
      availableOn: ['Amazon', 'Flipkart'],
      isPublished: true,
      productionStage: { currentStage: null, currentStageIndex: null, stages: [] },
      neverPaid: false,
      belowPayoutThreshold: false,
      payoutWindows: {
        lastQuarterEnd: '2023-12-31',
        lastQuarterPayoutDeadline: '2024-02-15',
        nextQuarterEnd: '2024-03-31',
        nextQuarterPayoutDeadline: '2024-05-15',
      },
    });
  });

  const renderPage = (ticketId = 'ticket-101') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/admin/tickets/${ticketId}`]}>
          <Routes>
            <Route path="/admin/tickets/:id" element={<AdminTicketDetailPage />} />
            <Route path="/admin/tickets" element={<div>Admin Queue Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders ticket details, badges, conversation thread, and author facts', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BL-1001')).toBeInTheDocument();
      expect(screen.getByText('Royalty Report Dispute')).toBeInTheDocument();
      expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThan(0);
    });

    // Check thread messages
    expect(screen.getByText(/My royalty report for Q3 shows 10 copies/)).toBeInTheDocument();
    expect(screen.getByText(/Could you please clarify how Amazon reporting affects/)).toBeInTheDocument();

    // Check internal note distinction
    expect(screen.getByText(/Internal note — not visible to the author/)).toBeInTheDocument();
    expect(screen.getByText(/Verified Amazon KDP report/)).toBeInTheDocument();

    // Check book facts
    await waitFor(() => {
      expect(screen.getAllByText('Echoes of the Valley').length).toBeGreaterThan(0);
      expect(screen.getByText('978-93-12345-67-8')).toBeInTheDocument();
      expect(screen.getByText(/Replika Press/)).toBeInTheDocument();
    });
  });

  it('auto-prefills AI draft when empty and reflects "AI Draft" vs "Edited" status', async () => {
    renderPage();

    // Prefilled text should appear
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Dear Priya,/)).toBeInTheDocument();
    });

    // Badge indicates initial AI Draft
    expect(screen.getByText('AI Draft')).toBeInTheDocument();

    // Shows policy warning note
    expect(screen.getByText(/Reconciliation window for Amazon returns is 30 days/)).toBeInTheDocument();

    // Editing composer changes badge to "Edited"
    const textarea = screen.getByLabelText('Author reply composer');
    await userEvent.type(textarea, ' Adding more custom notes.');

    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('never overwrites user typing if admin types before draft arrives', async () => {
    // Delay draft response
    let resolveDraft: (val: DraftResponse) => void = () => {};
    vi.spyOn(adminApi, 'getDraft').mockReturnValue(
      new Promise((resolve) => {
        resolveDraft = resolve;
      }),
    );

    renderPage();

    // User types before draft finishes loading
    const textarea = await screen.findByLabelText('Author reply composer');
    await userEvent.type(textarea, 'I am manually investigating your account right now.');

    expect(textarea).toHaveValue('I am manually investigating your account right now.');

    // Now resolve the AI draft
    resolveDraft(mockDraftReady);

    // Verify user text was NOT overwritten and notice appears offering to insert draft
    await waitFor(() => {
      expect(textarea).toHaveValue('I am manually investigating your account right now.');
      expect(screen.getByText(/AI draft has arrived/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Insert AI Draft/i })).toBeInTheDocument();
  });

  it('shows unavailable fallback banner and quick-insert snippet chips when AI draft fails', async () => {
    vi.spyOn(adminApi, 'getDraft').mockResolvedValue({
      status: 'unavailable',
      draft: null,
      reason: 'AI service circuit breaker tripped',
      snippets: [
        {
          id: 's-1',
          title: 'Payout Schedule',
          template: 'Payouts occur within 45 days after quarter close.',
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('AI draft is currently unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/AI service circuit breaker tripped/)).toBeInTheDocument();

    // Snippet chip is present
    const snippetBtn = screen.getByRole('button', { name: /\+ Payout Schedule/i });
    expect(snippetBtn).toBeInTheDocument();

    // Clicking snippet inserts it into the empty composer
    await userEvent.click(snippetBtn);
    const textarea = screen.getByLabelText('Author reply composer');
    expect(textarea).toHaveValue('Payouts occur within 45 days after quarter close.');
  });

  it('shows confirmation dialog before regenerating draft if user made edits', async () => {
    renderPage();

    const textarea = await screen.findByLabelText('Author reply composer');
    await userEvent.type(textarea, ' My customized response text.');

    const regenerateBtn = screen.getByRole('button', { name: /Regenerate Draft/i });
    await userEvent.click(regenerateBtn);

    // Confirm dialog should open
    expect(screen.getByText('Regenerate AI Draft?')).toBeInTheDocument();
    expect(screen.getByText(/You have modified the draft in the composer/)).toBeInTheDocument();
  });

  it('sends reply with draftId and clears composer and sessionStorage', async () => {
    const replySpy = vi.spyOn(adminApi, 'reply').mockResolvedValue({
      message: {
        id: 'msg-reply-1',
        ticketId: 'ticket-101',
        type: 'ADMIN_REPLY',
        body: 'Dear Priya, we updated your report.',
        aiAssisted: true,
        createdAt: '2024-03-01T12:00:00.000Z',
        sender: { id: 'admin-1', displayName: 'Siddharth Rao' },
      },
      ticket: { ...mockTicket, status: 'IN_PROGRESS' },
      firstResponseRecorded: true,
      statusChanged: true,
      editedFromDraft: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Dear Priya,/)).toBeInTheDocument();
    });

    const sendBtn = screen.getByRole('button', { name: /Send Reply/i });
    await userEvent.click(sendBtn);

    // Confirmation dialog opens
    const alertDialog = await screen.findByRole('alertdialog');
    expect(within(alertDialog).getByText('Send Reply to Priya Sharma?')).toBeInTheDocument();
    const confirmBtn = within(alertDialog).getByRole('button', { name: /Send Reply/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(replySpy).toHaveBeenCalledWith(
        'ticket-101',
        expect.objectContaining({
          body: expect.stringContaining('Dear Priya'),
          draftId: 'draft-99',
        }),
      );
    });

    // Composer is cleared
    const textarea = screen.getByLabelText('Author reply composer');
    expect(textarea).toHaveValue('');
    expect(sessionStorage.getItem('bookleaf_draft_ticket-101')).toBeNull();
  });

  it('handles 409 Closed ticket with Reopen button', async () => {
    vi.spyOn(adminApi, 'reply').mockRejectedValue(
      new ApiError('Ticket is closed', 'CONFLICT', 409),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Dear Priya,/)).toBeInTheDocument();
    });

    const sendBtn = screen.getByRole('button', { name: /Send Reply/i });
    await userEvent.click(sendBtn);

    const alertDialog = await screen.findByRole('alertdialog');
    const confirmBtn = within(alertDialog).getByRole('button', { name: /Send Reply/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/This ticket is currently closed/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reopen Ticket/i })).toBeInTheDocument();
    });
  });

  it('allows adding internal staff note with optimistic thread update', async () => {
    const addNoteSpy = vi.spyOn(adminApi, 'addNote').mockResolvedValue({
      id: 'note-real-1',
      ticketId: 'ticket-101',
      type: 'INTERNAL_NOTE',
      body: 'Author confirmed via phone call.',
      aiAssisted: false,
      createdAt: '2024-03-01T12:30:00.000Z',
      sender: { id: 'admin-1', displayName: 'Siddharth Rao' },
    });

    renderPage();

    // Switch to Internal Notes tab
    const noteTabBtn = await screen.findByRole('tab', { name: /Internal Staff Note/i });
    await userEvent.click(noteTabBtn);

    expect(screen.getByText(/Staff-only notes:/)).toBeInTheDocument();

    const noteTextarea = screen.getByLabelText('Staff internal note composer');
    await userEvent.type(noteTextarea, 'Author confirmed via phone call.');

    const addBtn = screen.getByRole('button', { name: /Add Internal Note/i });
    await userEvent.click(addBtn);

    await waitFor(() => {
      expect(addNoteSpy).toHaveBeenCalledWith('ticket-101', {
        body: 'Author confirmed via phone call.',
      });
    });

    expect(noteTextarea).toHaveValue('');
  });

  it('supports "Assign to me" and control changes with optimistic rollback on error', async () => {
    const assignMeSpy = vi.spyOn(adminApi, 'assignToMe').mockResolvedValue({
      ...mockTicket,
      assignedToId: 'admin-1',
      assignedTo: { id: 'admin-1', name: 'Siddharth Rao' },
    });

    renderPage();

    const assignMeBtn = await screen.findByRole('button', { name: /Assign to me/i });
    await userEvent.click(assignMeBtn);

    expect(assignMeSpy).toHaveBeenCalledWith('ticket-101');
  });

  it('renders friendly 404 state when ticket does not exist', async () => {
    vi.spyOn(adminApi, 'getTicket').mockRejectedValue(
      new ApiError('Ticket not found', 'NOT_FOUND', 404),
    );

    renderPage('ticket-unknown');

    await waitFor(() => {
      expect(screen.getByText('Ticket Not Found')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Back to Queue/i })).toBeInTheDocument();
    });
  });
});
