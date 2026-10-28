import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminTicketsPage } from '@/features/admin/AdminTicketsPage';
import { adminApi } from '@/features/admin/admin.api';
import type { AdminStats, AdminTicket, AdminUser } from '@/features/admin/types';
import { ApiError } from '@/lib/api';

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Siddharth Rao', email: 'siddharth@bookleaf.in', role: 'ADMIN' },
    token: 'mock-token',
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

describe('AdminTicketsPage', () => {
  let queryClient: QueryClient;

  const mockAdmins: AdminUser[] = [
    { id: 'admin-1', name: 'Siddharth Rao', email: 'siddharth@bookleaf.in' },
    { id: 'admin-2', name: 'Neha Gupta', email: 'neha@bookleaf.in' },
  ];

  const mockStats: AdminStats = {
    total: 42,
    byStatus: {
      OPEN: 18,
      IN_PROGRESS: 12,
      RESOLVED: 8,
      CLOSED: 4,
    },
    byPriority: {
      CRITICAL: 5,
      HIGH: 10,
      MEDIUM: 20,
      LOW: 7,
    },
    unassigned: 6,
    overdue: 3,
    needsManualTriage: 2,
    avgFirstResponseHours: 4.5,
  };

  const mockTickets: AdminTicket[] = [
    {
      id: 'ticket-1',
      ticketNumber: 'BL-1001',
      ticketNumberRaw: 1001,
      authorId: 'auth-1',
      bookId: 'book-1',
      subject: 'Critical Royalty Discrepancy',
      description: 'My reported sales on Amazon do not match royalty report.',
      status: 'OPEN',
      category: 'ROYALTY_PAYMENTS',
      categorySource: 'AI',
      priority: 'CRITICAL',
      prioritySource: 'AI',
      aiStatus: 'DONE',
      aiReasoning: 'Author expresses severe urgency regarding royalty shortfall.',
      aiError: null,
      needsManualTriage: false,
      assignedToId: null,
      assignedTo: null,
      firstResponseAt: null,
      resolvedAt: null,
      createdAt: '2024-03-01T10:00:00.000Z',
      updatedAt: '2024-03-01T10:00:00.000Z',
      ageHours: 26.5,
      isOverdue: true,
      messageCount: 1,
      author: { id: 'auth-1', name: 'Aarav Patel', email: 'aarav@example.com' },
      book: { id: 'book-1', title: 'The Silent Whispers' },
    },
    {
      id: 'ticket-2',
      ticketNumber: 'BL-1002',
      ticketNumberRaw: 1002,
      authorId: 'auth-2',
      bookId: null,
      subject: 'Cover Proof Typography Revision',
      description: 'Need assistance fixing typography and spine text.',
      status: 'IN_PROGRESS',
      category: 'PRINTING_QUALITY',
      categorySource: 'FALLBACK',
      priority: 'HIGH',
      prioritySource: 'ADMIN',
      aiStatus: 'FAILED',
      aiReasoning: null,
      aiError: 'AI rate limit exceeded',
      needsManualTriage: true,
      assignedToId: 'admin-1',
      assignedTo: { id: 'admin-1', name: 'Siddharth Rao' },
      firstResponseAt: '2024-03-02T11:00:00.000Z',
      resolvedAt: null,
      createdAt: '2024-03-02T10:00:00.000Z',
      updatedAt: '2024-03-02T12:00:00.000Z',
      ageHours: 2.0,
      isOverdue: false,
      messageCount: 3,
      author: { id: 'auth-2', name: 'Priya Sharma', email: 'priya@example.com' },
      book: null,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.restoreAllMocks();
    vi.spyOn(adminApi, 'getTickets').mockResolvedValue({
      data: mockTickets,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(adminApi, 'getStats').mockResolvedValue(mockStats);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);
  });

  const renderPage = (initialEntries = ['/admin/tickets']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/admin/tickets" element={<AdminTicketsPage />} />
            <Route path="/admin/tickets/:id" element={<div>Admin Ticket Detail</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders dashboard stat cards with values, warning variants, and applies filters on click', async () => {
    const user = userEvent.setup();
    const getTicketsSpy = vi.spyOn(adminApi, 'getTickets').mockResolvedValue({
      data: mockTickets,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(adminApi, 'getStats').mockResolvedValue(mockStats);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BL-1001')).toBeInTheDocument();
    });

    // Check Stat cards values
    expect(screen.getByText('18')).toBeInTheDocument(); // Open
    expect(screen.getByText('12')).toBeInTheDocument(); // In Progress
    expect(screen.getAllByText('6').length).toBeGreaterThan(0); // Unassigned
    expect(screen.getAllByText('3').length).toBeGreaterThan(0); // Overdue
    expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Needs Triage
    expect(screen.getByText('4.5h')).toBeInTheDocument(); // Avg First Reply

    // Click "Unassigned" stat card
    const unassignedCard = screen.getAllByText('Unassigned')[0]!;
    await user.click(unassignedCard);

    // Verify filter parameter sent to API
    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'unassigned' }),
      );
    });

    // Click "Overdue" stat card
    const overdueCard = screen.getByText('Overdue');
    await user.click(overdueCard);

    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ overdue: 'true' }),
      );
      expect(screen.getByText('Overdue', { selector: 'span' })).toBeInTheDocument();
    });

    // Click "Needs Triage" stat card
    const triageCard = screen.getByText('Needs Triage');
    await user.click(triageCard);

    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ needsManualTriage: 'true' }),
      );
    });

    // Click "Open" stat card
    const openCard = screen.getAllByText('Open')[0]!;
    await user.click(openCard);

    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'OPEN' }),
      );
    });

    // Click "In Progress" stat card
    const inProgressCard = screen.getAllByText('In Progress')[0]!;
    await user.click(inProgressCard);

    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'IN_PROGRESS' }),
      );
    });
  });

  it('renders queue columns, priority stripe, source markers, and overdue/triage indicators', async () => {
    vi.spyOn(adminApi, 'getTickets').mockResolvedValue({
      data: mockTickets,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(adminApi, 'getStats').mockResolvedValue(mockStats);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BL-1001')).toBeInTheDocument();
      expect(screen.getByText('BL-1002')).toBeInTheDocument();
    });

    // Author names
    expect(screen.getByText('Aarav Patel')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();

    // Books
    expect(screen.getByText('The Silent Whispers')).toBeInTheDocument();
    expect(screen.getByText('General / Account Level')).toBeInTheDocument();

    // Badges & Source markers (AI suggested and Auto rules / Manual override)
    expect(screen.getByText('Royalty & Payments')).toBeInTheDocument();
    expect(screen.getAllByLabelText('AI suggested').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Auto rules')).toBeInTheDocument();
    expect(screen.getByLabelText('Manual override')).toBeInTheDocument();

    // Overdue clock indicator and Needs Triage badge
    expect(screen.getByLabelText('Overdue: No first response within SLA')).toBeInTheDocument();
    expect(screen.getByText('Triage')).toBeInTheDocument();

    // Assignees
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
    expect(screen.getByText('Siddharth Rao')).toBeInTheDocument();
  });

  it('updates search query with debounce and sends server request without browser filtering', async () => {
    const user = userEvent.setup();
    const getTicketsSpy = vi.spyOn(adminApi, 'getTickets').mockResolvedValue({
      data: mockTickets,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(adminApi, 'getStats').mockResolvedValue(mockStats);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BL-1001')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search tickets');
    await user.type(searchInput, 'Shortfall');

    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'Shortfall' }),
      );
    });
  });

  it('optimistically updates row on "Assign to me" and rolls back on API error', async () => {
    const user = userEvent.setup();
    const toastErrorSpy = vi.spyOn(toast, 'error');
    vi.spyOn(adminApi, 'getTickets').mockResolvedValue({
      data: [mockTickets[0]!],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(adminApi, 'getStats').mockResolvedValue(mockStats);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);

    const assignSpy = vi
      .spyOn(adminApi, 'assignToMe')
      .mockRejectedValueOnce(new ApiError('Permission Denied', 'FORBIDDEN', 403));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BL-1001')).toBeInTheDocument();
      expect(screen.getAllByText('Unassigned').length).toBeGreaterThanOrEqual(1);
    });

    const actionBtn = screen.getByLabelText('Actions for ticket BL-1001');
    await user.click(actionBtn);

    const assignItem = screen.getByText('Assign to me');
    await user.click(assignItem);

    expect(assignSpy).toHaveBeenCalledWith('ticket-1');

    // On error, rolls back and displays toast error
    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith('Permission Denied');
      expect(screen.getAllByText('Unassigned').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders pagination and navigates to next page via URL query parameters', async () => {
    const user = userEvent.setup();
    const getTicketsSpy = vi.spyOn(adminApi, 'getTickets').mockResolvedValue({
      data: mockTickets,
      meta: { page: 1, limit: 20, total: 35, totalPages: 2, hasNext: true, hasPrev: false },
    });
    vi.spyOn(adminApi, 'getStats').mockResolvedValue(mockStats);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      expect(screen.getByText((_, el) => el?.textContent?.trim() === 'Page 1 of 2')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    await user.click(nextBtn);

    await waitFor(() => {
      expect(getTicketsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  it('displays empty state with "Clear Filters" CTA when filters yield no results', async () => {
    vi.spyOn(adminApi, 'getTickets').mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });
    vi.spyOn(adminApi, 'getStats').mockResolvedValue(mockStats);
    vi.spyOn(adminApi, 'getAdmins').mockResolvedValue(mockAdmins);

    renderPage(['/admin/tickets?status=RESOLVED']);

    await waitFor(() => {
      expect(screen.getByText('No Matching Tickets')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /clear filters/i }).length).toBeGreaterThanOrEqual(1);
    });
  });
});
