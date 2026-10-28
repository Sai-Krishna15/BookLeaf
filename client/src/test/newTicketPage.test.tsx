import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewTicketPage } from '@/features/tickets/NewTicketPage';
import { ticketsApi } from '@/features/tickets/tickets.api';
import { booksApi } from '@/features/books/books.api';
import { ApiError } from '@/lib/api';
import type { Book } from '@/features/books/types';

describe('NewTicketPage', () => {
  let queryClient: QueryClient;

  const mockBooks: Book[] = [
    {
      id: 'book-101',
      authorId: 'auth-1',
      title: 'Whispers of Eternity',
      isbn: '978-1-23-456789-0',
      genre: 'Fiction',
      publicationDate: '2024-01-01',
      status: 'Published',
      mrp: 350,
      authorRoyaltyPerCopy: 35,
      totalCopiesSold: 100,
      totalRoyaltyEarned: 3500,
      royaltyPaid: 3500,
      royaltyPending: 0,
      lastRoyaltyPayoutDate: '2024-04-01',
      printPartner: 'Repro',
      availableOn: ['Amazon'],
      isPublished: true,
      productionStage: { currentStage: null, currentStageIndex: null, stages: [] },
      neverPaid: false,
      belowPayoutThreshold: false,
      payoutWindows: {
        lastQuarterEnd: '2024-03-31',
        lastQuarterPayoutDeadline: '2024-05-15',
        nextQuarterEnd: '2024-06-30',
        nextQuarterPayoutDeadline: '2024-08-15',
      },
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.restoreAllMocks();
  });

  const renderPage = (initialEntries = ['/tickets/new']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/tickets/new" element={<NewTicketPage />} />
            <Route path="/tickets/:id" element={<div>Ticket Detail Screen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('validates subject (min 5 chars) and description (min 20 chars)', async () => {
    const user = userEvent.setup();
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: mockBooks,
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderPage();

    const submitBtn = screen.getByRole('button', { name: /submit query/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/subject must be at least 5 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/description must be at least 20 characters/i)).toBeInTheDocument();
    });
  });

  it('preselects related book from query parameter ?bookId=...', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: mockBooks,
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderPage(['/tickets/new?bookId=book-101']);

    await waitFor(() => {
      expect(screen.getByText('Whispers of Eternity')).toBeInTheDocument();
    });
  });

  it('validates file size limits (>10 MB rejected)', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: mockBooks,
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    renderPage();

    // Create an oversized 12 MB dummy file
    const oversizedFile = new window.File(['a'.repeat(1024)], 'giant-proof.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(oversizedFile, 'size', { value: 12 * 1024 * 1024 });

    const dropzone = screen.getByRole('button', { name: /upload attachments dropzone/i });
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [oversizedFile],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/exceeds the 10 MB limit/i)).toBeInTheDocument();
    });
  });

  it('maps server 400 validation error details into the form', async () => {
    const user = userEvent.setup();
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: mockBooks,
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    vi.spyOn(ticketsApi, 'createTicket').mockRejectedValueOnce(
      new ApiError('Validation failed', 'VALIDATION_ERROR', 400, {
        subject: 'Server says: Subject is too short',
        description: 'Server says: Description lacks required details',
      }),
    );

    renderPage();

    await user.type(screen.getByPlaceholderText(/e\.g\. Royalty payout/i), 'Valid Subject');
    await user.type(
      screen.getByPlaceholderText(/provide details about your query/i),
      'This is a long enough description that exceeds 20 characters easily.',
    );

    const submitBtn = screen.getByRole('button', { name: /submit query/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Server says: Subject is too short')).toBeInTheDocument();
      expect(screen.getByText('Server says: Description lacks required details')).toBeInTheDocument();
    });
  });

  it('submits query and redirects to /tickets/:id on success', async () => {
    const user = userEvent.setup();
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: mockBooks,
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    vi.spyOn(ticketsApi, 'createTicket').mockResolvedValueOnce({
      id: 'ticket-999',
      ticketNumber: 'BL-1099',
      subject: 'My Payout Query',
      description: 'Where is my royalty payment for Q1?',
      status: 'OPEN',
      book: null,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderPage();

    await user.type(screen.getByPlaceholderText(/e\.g\. Royalty payout/i), 'My Payout Query');
    await user.type(
      screen.getByPlaceholderText(/provide details about your query/i),
      'Where is my royalty payment for Q1? Please advise.',
    );

    const submitBtn = screen.getByRole('button', { name: /submit query/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Ticket Detail Screen')).toBeInTheDocument();
    });
  });

  it('displays friendly 429 rate-limit error when user submits too quickly', async () => {
    const user = userEvent.setup();
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: mockBooks,
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    vi.spyOn(ticketsApi, 'createTicket').mockRejectedValueOnce(
      new ApiError('Rate limit exceeded', 'RATE_LIMITED', 429),
    );

    renderPage();

    await user.type(screen.getByPlaceholderText(/e\.g\. Royalty payout/i), 'Repeated Submission');
    await user.type(
      screen.getByPlaceholderText(/provide details about your query/i),
      'Trying to submit another ticket right after the previous one.',
    );

    const submitBtn = screen.getByRole('button', { name: /submit query/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/You have submitted queries too quickly\. Please wait a moment and try again\./i),
      ).toBeInTheDocument();
    });
  });
});
