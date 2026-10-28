import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketsPage } from '@/features/tickets/TicketsPage';
import { ticketsApi } from '@/features/tickets/tickets.api';
import { markTicketAsUnread } from '@/features/tickets/hooks/useAuthorTicketRealtime';
import type { AuthorTicket } from '@/features/tickets/types';

describe('TicketsPage', () => {
  let queryClient: QueryClient;

  const mockTickets: AuthorTicket[] = [
    {
      id: 'ticket-1',
      ticketNumber: 'BL-1001',
      subject: 'Royalty discrepancy for March',
      description: 'I noticed my copies sold does not match the royalty calculation.',
      status: 'OPEN',
      book: { id: 'book-1', title: 'The Silent Whispers' },
      attachments: [],
      createdAt: '2024-03-01T10:00:00.000Z',
      updatedAt: '2024-03-01T10:00:00.000Z',
    },
    {
      id: 'ticket-2',
      ticketNumber: 'BL-1002',
      subject: 'Cover Design proof update',
      description: 'Can you please send me the latest high resolution PDF cover?',
      status: 'IN_PROGRESS',
      book: null,
      attachments: [],
      createdAt: '2024-03-02T12:00:00.000Z',
      updatedAt: '2024-03-02T14:30:00.000Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.restoreAllMocks();
  });

  const renderPage = (initialEntries = ['/tickets']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <TicketsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders ticket rows with ticket number, subject, book, and status badges', async () => {
    vi.spyOn(ticketsApi, 'getTickets').mockResolvedValueOnce({
      data: mockTickets,
      meta: { page: 1, limit: 15, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('BL-1001')).toBeInTheDocument();
      expect(screen.getByText('BL-1002')).toBeInTheDocument();
    });

    expect(screen.getByText('Royalty discrepancy for March')).toBeInTheDocument();
    expect(screen.getByText('The Silent Whispers')).toBeInTheDocument();
    expect(screen.getByText('General / Account Level')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('displays EmptyState with CTA when author has no tickets', async () => {
    vi.spyOn(ticketsApi, 'getTickets').mockResolvedValueOnce({
      data: [],
      meta: { page: 1, limit: 15, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No Support Queries Yet')).toBeInTheDocument();
    });

    expect(screen.getByText(/Raise your first query/i)).toBeInTheDocument();
  });

  it('displays unread response indicator when ticket has received live updates', async () => {
    markTicketAsUnread('ticket-1');

    vi.spyOn(ticketsApi, 'getTickets').mockResolvedValueOnce({
      data: mockTickets,
      meta: { page: 1, limit: 15, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTitle('New response received')).toBeInTheDocument();
    });
  });

  it('allows searching and updates search box', async () => {
    const user = userEvent.setup();
    vi.spyOn(ticketsApi, 'getTickets').mockResolvedValue({
      data: mockTickets,
      meta: { page: 1, limit: 15, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderPage();

    const searchInput = screen.getByLabelText(/search tickets/i);
    await user.type(searchInput, 'discrepancy');

    expect(searchInput).toHaveValue('discrepancy');
  });
});
