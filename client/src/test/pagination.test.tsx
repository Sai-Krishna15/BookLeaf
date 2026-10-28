import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Pagination, type PaginationMeta } from '@/components/common/Pagination';

describe('Pagination Component', () => {
  const baseMeta: PaginationMeta = {
    page: 2,
    limit: 10,
    total: 35,
    totalPages: 4,
    hasNext: true,
    hasPrev: true,
  };

  it('renders record counts and current page', () => {
    render(<Pagination meta={baseMeta} onPageChange={vi.fn()} />);

    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' && element?.textContent?.replace(/\s+/g, ' ').trim() === 'Page 2 of 4',
      ),
    ).toBeInTheDocument();
  });

  it('calls onPageChange with previous and next page numbers', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination meta={baseMeta} onPageChange={onPageChange} />);

    const prevButton = screen.getByRole('button', { name: /previous page/i });
    const nextButton = screen.getByRole('button', { name: /next page/i });

    await user.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous button on first page', () => {
    const firstPageMeta: PaginationMeta = {
      ...baseMeta,
      page: 1,
      hasPrev: false,
    };

    render(<Pagination meta={firstPageMeta} onPageChange={vi.fn()} />);

    const prevButton = screen.getByRole('button', { name: /previous page/i });
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    const lastPageMeta: PaginationMeta = {
      ...baseMeta,
      page: 4,
      hasNext: false,
    };

    render(<Pagination meta={lastPageMeta} onPageChange={vi.fn()} />);

    const nextButton = screen.getByRole('button', { name: /next page/i });
    expect(nextButton).toBeDisabled();
  });

  it('returns null when total is 0', () => {
    const zeroMeta: PaginationMeta = {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    };

    const { container } = render(<Pagination meta={zeroMeta} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
