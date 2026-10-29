import * as React from 'react';
import { cn } from '@/lib/utils';

export type TicketCategory =
  | 'ROYALTY_PAYMENTS'
  | 'ISBN_METADATA'
  | 'PRINTING_QUALITY'
  | 'DISTRIBUTION_AVAILABILITY'
  | 'BOOK_STATUS_PRODUCTION'
  | 'GENERAL_INQUIRY';

interface CategoryBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  category: TicketCategory | string | null | undefined;
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: 'Royalty & Payments',
  ISBN_METADATA: 'ISBN & Metadata Issues',
  PRINTING_QUALITY: 'Printing & Quality',
  DISTRIBUTION_AVAILABILITY: 'Distribution & Availability',
  BOOK_STATUS_PRODUCTION: 'Book Status & Production Updates',
  GENERAL_INQUIRY: 'General / Account Level',
};

export function CategoryBadge({ category, className, ...props }: CategoryBadgeProps) {
  if (!category) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border shadow-xs',
          className,
        )}
        {...props}
      >
        Unclassified
      </span>
    );
  }

  const normalized = category as TicketCategory;
  const label = CATEGORY_LABELS[normalized] || category;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200/90 shadow-xs dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700',
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}
