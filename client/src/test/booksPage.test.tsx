import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BooksPage } from '@/features/books/BooksPage';
import { booksApi } from '@/features/books/books.api';
import type { Book, BooksSummary } from '@/features/books/types';

describe('BooksPage', () => {
  let queryClient: QueryClient;

  const mockPublishedBook: Book = {
    id: 'book-1',
    authorId: 'auth-1',
    title: 'The Silent Whispers',
    isbn: '978-3-16-148410-0',
    genre: 'Fiction',
    publicationDate: '2024-01-15',
    status: 'Published',
    mrp: 399,
    authorRoyaltyPerCopy: 40,
    totalCopiesSold: 250,
    totalRoyaltyEarned: 10000,
    royaltyPaid: 5000,
    royaltyPending: 5000,
    lastRoyaltyPayoutDate: '2024-04-01',
    printPartner: 'Repro Books',
    availableOn: ['Amazon', 'Flipkart'],
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
  };

  const mockNeverPaidBook: Book = {
    ...mockPublishedBook,
    id: 'book-2',
    title: 'New Horizons',
    totalCopiesSold: 40,
    totalRoyaltyEarned: 1600,
    royaltyPaid: 0,
    royaltyPending: 1600,
    lastRoyaltyPayoutDate: null,
    neverPaid: true,
  };

  const mockBelowThresholdBook: Book = {
    ...mockPublishedBook,
    id: 'book-3',
    title: 'Autumn Leaves (BK016 Style)',
    totalCopiesSold: 20,
    totalRoyaltyEarned: 850,
    royaltyPaid: 0,
    royaltyPending: 850,
    belowPayoutThreshold: true,
  };

  const mockInProductionBook: Book = {
    id: 'book-4',
    authorId: 'auth-1',
    title: 'Winds of Change (In Production)',
    isbn: '978-1-23-456789-X',
    genre: 'Poetry',
    publicationDate: null,
    status: 'In Production - Cover Design',
    mrp: null,
    authorRoyaltyPerCopy: null,
    totalCopiesSold: 0,
    totalRoyaltyEarned: null,
    royaltyPaid: null,
    royaltyPending: null,
    lastRoyaltyPayoutDate: null,
    printPartner: null,
    availableOn: [],
    isPublished: false,
    productionStage: {
      currentStage: 'COVER_DESIGN',
      currentStageIndex: 2,
      stages: [
        { stage: 'MANUSCRIPT', label: 'Manuscript', step: 1, totalSteps: 9, isComplete: true, isCurrent: false },
        { stage: 'EDITING', label: 'Editing', step: 2, totalSteps: 9, isComplete: true, isCurrent: false },
        { stage: 'COVER_DESIGN', label: 'Cover Design', step: 3, totalSteps: 9, isComplete: false, isCurrent: true },
      ],
    },
    neverPaid: false,
    belowPayoutThreshold: false,
    payoutWindows: {
      lastQuarterEnd: '2024-03-31',
      lastQuarterPayoutDeadline: '2024-05-15',
      nextQuarterEnd: '2024-06-30',
      nextQuarterPayoutDeadline: '2024-08-15',
    },
  };

  const mockSummary: BooksSummary = {
    totalEarned: 12450,
    totalPaid: 5000,
    totalPending: 7450,
    bookCount: 4,
    publishedCount: 3,
    inProductionCount: 1,
    payoutThreshold: 1000,
    pendingBelowThreshold: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.restoreAllMocks();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BooksPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders summary strip metrics and published book cards with financial figures', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: [mockPublishedBook],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(booksApi, 'getBooksSummary').mockResolvedValueOnce(mockSummary);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('The Silent Whispers')).toBeInTheDocument();
    });

    expect(screen.getByText('978-3-16-148410-0')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('₹399')).toBeInTheDocument();
    expect(screen.getByText('₹10,000')).toBeInTheDocument();
    expect(screen.getByText(/Repro Books/i)).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
  });

  it('renders "First Payout Cycle" note and next deadline for neverPaid book', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: [mockNeverPaidBook],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(booksApi, 'getBooksSummary').mockResolvedValueOnce(mockSummary);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('New Horizons')).toBeInTheDocument();
    });

    expect(screen.getByText('First Payout Cycle')).toBeInTheDocument();
    expect(
      screen.getByText(/No payout has been made yet\. Royalties are calculated quarterly/i),
    ).toBeInTheDocument();
  });

  it('renders belowPayoutThreshold rollover warning for books like BK016', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: [mockBelowThresholdBook],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(booksApi, 'getBooksSummary').mockResolvedValueOnce(mockSummary);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Autumn Leaves (BK016 Style)')).toBeInTheDocument();
    });

    expect(screen.getByText(/Below ₹1,000 Minimum Payout/i)).toBeInTheDocument();
    expect(screen.getByText(/will roll over to the next payout window/i)).toBeInTheDocument();
  });

  it('renders in-production books without ₹ monetary figures (dashes or hidden), rendering stage tracker', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: [mockInProductionBook],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(booksApi, 'getBooksSummary').mockResolvedValueOnce(mockSummary);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Winds of Change (In Production)')).toBeInTheDocument();
    });

    expect(screen.getByText('In Production')).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 9: Cover Design')).toBeInTheDocument();
    expect(screen.getByText('Not yet published')).toBeInTheDocument();
    // Does not render monetary values for unpublished book
    expect(screen.queryByText('Total Earned:')).not.toBeInTheDocument();
  });

  it('renders EmptyState when author has no books', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    });
    vi.spyOn(booksApi, 'getBooksSummary').mockResolvedValueOnce({
      totalEarned: 0,
      totalPaid: 0,
      totalPending: 0,
      bookCount: 0,
      publishedCount: 0,
      inProductionCount: 0,
      payoutThreshold: 1000,
      pendingBelowThreshold: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No Books Found')).toBeInTheDocument();
    });
    expect(screen.getByText(/Contact Support/i)).toBeInTheDocument();
  });

  it('copies ISBN to clipboard on button click', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce();

    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: [mockPublishedBook],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(booksApi, 'getBooksSummary').mockResolvedValueOnce(mockSummary);

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Copy ISBN 978-3-16-148410-0/i)).toBeInTheDocument();
    });

    const copyBtn = screen.getByLabelText(/Copy ISBN 978-3-16-148410-0/i);
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith('978-3-16-148410-0');
  });

  it('renders "Raise a query" link on each book card linking to /tickets/new?bookId=<id>', async () => {
    vi.spyOn(booksApi, 'getBooks').mockResolvedValueOnce({
      data: [mockPublishedBook],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
    vi.spyOn(booksApi, 'getBooksSummary').mockResolvedValueOnce(mockSummary);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('The Silent Whispers')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: /Raise a query/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/tickets/new?bookId=book-1');
  });
});
