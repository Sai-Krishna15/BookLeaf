import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketDetailPage } from '@/features/tickets/TicketDetailPage';
import { ticketsApi } from '@/features/tickets/tickets.api';
import { ApiError } from '@/lib/api';
import type { AuthorTicket, TicketMessage } from '@/features/tickets/types';

describe('TicketDetailPage', () => {
  let queryClient: QueryClient;

  const mockOpenTicket: AuthorTicket = {
    id: 'ticket-101',
    ticketNumber: 'BL-1001',
    subject: 'Royalty Report Inquiry',
    description: 'Hello Support,\n\nI have a question about my royalties for Q1.\nPlease see attached.',
    status: 'OPEN',
    book: { id: 'book-1', title: 'The Silent Whispers' },
    attachments: [{ name: 'statement.pdf', size: 102400, mimeType: 'application/pdf' }],
    createdAt: '2024-03-01T10:00:00.000Z',
    updatedAt: '2024-03-01T10:00:00.000Z',
  };

  const mockMessages: TicketMessage[] = [
    {
      id: 'msg-1',
      ticketId: 'ticket-101',
      type: 'ADMIN_REPLY',
      body: 'Hi Priya,\n\nWe are looking into this with the accounts team and will update you shortly.\n\nWarm regards,\nBookLeaf Author Support Team',
      aiAssisted: true,
      createdAt: '2024-03-01T11:00:00.000Z',
      sender: {
        id: 'admin-1',
        displayName: 'BookLeaf Support',
      },
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.restoreAllMocks();
  });

  const renderPage = (ticketId = 'ticket-101') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/tickets" element={<div>Tickets List Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders original query bubble, attachment name, and subsequent thread messages', async () => {
    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValueOnce(mockOpenTicket);
    vi.spyOn(ticketsApi, 'getMessages').mockResolvedValueOnce(mockMessages);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Royalty Report Inquiry')).toBeInTheDocument();
    });

    expect(screen.getByText('Original Query')).toBeInTheDocument();
    expect(screen.getByText('statement.pdf')).toBeInTheDocument();
    expect(screen.getByText('BookLeaf Support')).toBeInTheDocument();
    expect(screen.getByText(/We are looking into this with the accounts team/i)).toBeInTheDocument();
  });

  it('preserves line breaks in message text', async () => {
    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValueOnce(mockOpenTicket);
    vi.spyOn(ticketsApi, 'getMessages').mockResolvedValueOnce(mockMessages);

    const { container } = renderPage();

    await waitFor(() => {
      const bubble = container.querySelector('.whitespace-pre-wrap');
      expect(bubble).toBeInTheDocument();
      expect(bubble?.textContent).toContain('Hello Support,\n\nI have a question about my royalties');
    });
  });

  it('disables follow-up composer when ticket status is CLOSED with friendly note', async () => {
    const closedTicket: AuthorTicket = {
      ...mockOpenTicket,
      status: 'CLOSED',
    };

    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValueOnce(closedTicket);
    vi.spyOn(ticketsApi, 'getMessages').mockResolvedValueOnce(mockMessages);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/This ticket is closed and no longer accepting follow-up responses/i)).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText(/Type your response/i)).not.toBeInTheDocument();
  });

  it('displays reopen notice when ticket status is RESOLVED', async () => {
    const resolvedTicket: AuthorTicket = {
      ...mockOpenTicket,
      status: 'RESOLVED',
    };

    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValueOnce(resolvedTicket);
    vi.spyOn(ticketsApi, 'getMessages').mockResolvedValueOnce(mockMessages);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Sending a follow-up reply will automatically reopen it/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/Type your response/i)).toBeInTheDocument();
  });

  it('sends follow-up reply successfully', async () => {
    const user = userEvent.setup();
    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValue(mockOpenTicket);
    vi.spyOn(ticketsApi, 'getMessages').mockResolvedValue(mockMessages);
    const addMessageSpy = vi.spyOn(ticketsApi, 'addMessage').mockResolvedValueOnce({
      id: 'msg-new',
      ticketId: 'ticket-101',
      type: 'AUTHOR_MESSAGE',
      body: 'Thank you for checking on this!',
      aiAssisted: false,
      createdAt: new Date().toISOString(),
      sender: { id: 'auth-1', displayName: 'Priya Sharma' },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your response/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Type your response/i);
    await user.type(textarea, 'Thank you for checking on this!');

    const sendBtn = screen.getByRole('button', { name: /send reply/i });
    await user.click(sendBtn);

    expect(addMessageSpy).toHaveBeenCalledWith('ticket-101', {
      body: 'Thank you for checking on this!',
    });
  });

  it('displays friendly 404 message for another authors ticket', async () => {
    vi.spyOn(ticketsApi, 'getTicket').mockRejectedValueOnce(
      new ApiError('Not found', 'NOT_FOUND', 404),
    );

    renderPage('ticket-other');

    await waitFor(() => {
      expect(screen.getByText('Ticket Not Found')).toBeInTheDocument();
      expect(
        screen.getByText(/We could not find this ticket\. It may not exist, or you may not have permission to view another author's ticket\./i),
      ).toBeInTheDocument();
    });
  });

  it('shows friendly 409 message when follow-up fails because ticket was closed concurrently', async () => {
    const user = userEvent.setup();
    vi.spyOn(ticketsApi, 'getTicket').mockResolvedValue(mockOpenTicket);
    vi.spyOn(ticketsApi, 'getMessages').mockResolvedValue(mockMessages);
    vi.spyOn(ticketsApi, 'addMessage').mockRejectedValueOnce(
      new ApiError('Ticket closed', 'CONFLICT', 409),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your response/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Type your response/i);
    await user.type(textarea, 'Can someone please reopen this?');

    const sendBtn = screen.getByRole('button', { name: /send reply/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/This ticket is currently closed and cannot receive replies\./i),
      ).toBeInTheDocument();
    });
  });
});
