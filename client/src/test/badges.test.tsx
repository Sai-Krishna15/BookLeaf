import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { CategoryBadge, CATEGORY_LABELS, type TicketCategory } from '@/components/common/CategoryBadge';

describe('Badges', () => {
  describe('StatusBadge', () => {
    it('renders all four ticket statuses with correct labels', () => {
      const { rerender } = render(<StatusBadge status="OPEN" />);
      expect(screen.getByText('Open')).toBeInTheDocument();

      rerender(<StatusBadge status="IN_PROGRESS" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      rerender(<StatusBadge status="RESOLVED" />);
      expect(screen.getByText('Resolved')).toBeInTheDocument();

      rerender(<StatusBadge status="CLOSED" />);
      expect(screen.getByText('Closed')).toBeInTheDocument();
    });
  });

  describe('PriorityBadge', () => {
    it('renders all four priorities with correct labels', () => {
      const { rerender } = render(<PriorityBadge priority="CRITICAL" />);
      expect(screen.getByText('Critical')).toBeInTheDocument();

      rerender(<PriorityBadge priority="HIGH" />);
      expect(screen.getByText('High')).toBeInTheDocument();

      rerender(<PriorityBadge priority="MEDIUM" />);
      expect(screen.getByText('Medium')).toBeInTheDocument();

      rerender(<PriorityBadge priority="LOW" />);
      expect(screen.getByText('Low')).toBeInTheDocument();
    });
  });

  describe('CategoryBadge', () => {
    it('renders readable labels for each of the 6 categories', () => {
      const categories: TicketCategory[] = [
        'ROYALTY_PAYMENTS',
        'ISBN_METADATA',
        'PRINTING_QUALITY',
        'DISTRIBUTION_AVAILABILITY',
        'BOOK_STATUS_PRODUCTION',
        'GENERAL_INQUIRY',
      ];

      for (const cat of categories) {
        const { unmount } = render(<CategoryBadge category={cat} />);
        expect(screen.getByText(CATEGORY_LABELS[cat])).toBeInTheDocument();
        unmount();
      }
    });

    it('renders "Unclassified" when category is null or undefined', () => {
      render(<CategoryBadge category={null} />);
      expect(screen.getByText('Unclassified')).toBeInTheDocument();
    });
  });
});
