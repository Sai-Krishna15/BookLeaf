import { format, formatDistanceToNowStrict, isValid } from 'date-fns';

/**
 * Formats a numeric amount in INR with Indian digit grouping (e.g., ₹1,23,456).
 * Returns "—" for null or undefined.
 */
export function formatINR(
  amount: number | null | undefined,
  options: { prefix?: boolean; decimals?: number } = {},
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }

  const prefix = options.prefix ?? true;
  const decimals = options.decimals ?? 0;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return prefix ? `₹${formatted}` : formatted;
}

/**
 * Formats a Date object or ISO string into a human-friendly format (dd MMM yyyy).
 * If null or undefined, returns the provided fallback string (default: "Not yet published").
 */
export function formatDate(
  date: string | Date | null | undefined,
  fallback = 'Not yet published',
): string {
  if (!date) return fallback;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return fallback;

  return format(d, 'dd MMM yyyy');
}

/**
 * Formats date and time into "dd MMM yyyy, hh:mm a".
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  fallback = '—',
): string {
  if (!date) return fallback;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return fallback;

  return format(d, 'dd MMM yyyy, hh:mm a');
}

/**
 * Returns a human-readable relative time string (e.g. "3 hours ago", "2 days ago").
 */
export function relativeTime(
  date: string | Date | null | undefined,
  fallback = 'Recently',
): string {
  if (!date) return fallback;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return fallback;

  try {
    return formatDistanceToNowStrict(d, { addSuffix: true });
  } catch {
    return fallback;
  }
}

/**
 * Formats ticket number consistently (e.g. BL-1042).
 */
export function formatTicketNumber(ticket: string | number | null | undefined): string {
  if (!ticket) return 'BL-—';
  const str = String(ticket).trim();
  if (str.toUpperCase().startsWith('BL-')) {
    return str.toUpperCase();
  }
  return `BL-${str}`;
}
