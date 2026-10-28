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

/**
 * Formats duration between createdAt and resolvedAt (or now) into compact string:
 * e.g., "3d 4h", "5h 20m", "<1m", "4d".
 */
export function formatAge(
  createdAt: string | Date | null | undefined,
  resolvedAt?: string | Date | null,
): string {
  if (!createdAt) return '—';
  const start = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (!isValid(start)) return '—';

  const end = resolvedAt
    ? typeof resolvedAt === 'string'
      ? new Date(resolvedAt)
      : resolvedAt
    : new Date();
  if (!isValid(end)) return '—';

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return remHours > 0 ? `${diffDays}d ${remHours}h` : `${diffDays}d`;
  }
  if (diffHours > 0) {
    const remMins = diffMins % 60;
    return remMins > 0 ? `${diffHours}h ${remMins}m` : `${diffHours}h`;
  }
  if (diffMins > 0) {
    return `${diffMins}m`;
  }
  return '<1m';
}

/**
 * Formats average response hours (e.g. 4.2 -> "4.2h", 28 -> "1d 4h", null -> "—").
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) {
    return '—';
  }
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return mins > 0 ? `${mins}m` : '<1m';
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
