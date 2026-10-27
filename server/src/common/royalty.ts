import { PAYOUT_DEADLINE_DAYS, PAYOUT_THRESHOLD } from '../config/constants';

/**
 * ASSUMPTION (documented in the README): payout cycles follow CALENDAR quarters
 * (Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec), and a quarter's royalties are due
 * quarter end + 45 days. All maths is in UTC so results never depend on the server's timezone.
 * Pure functions: `now` is always a parameter, and no year is hardcoded.
 */

export interface PayoutWindows {
  /** Last day of the most recently COMPLETED calendar quarter (UTC midnight). */
  lastQuarterEnd: Date;
  lastQuarterPayoutDeadline: Date;
  /** Last day of the quarter `now` falls in, i.e. the next quarter end on or after today. */
  nextQuarterEnd: Date;
  nextQuarterPayoutDeadline: Date;
}

const addDays = (d: Date, days: number): Date => {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
};

export function getPayoutWindows(now: Date): PayoutWindows {
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3); // 0..3

  // Day 0 of month N is the last day of month N-1, so these are quarter-end days.
  // q=0 -> Date.UTC(year, 0, 0) = 31 Dec of the previous year (year rollover handled for free).
  const lastQuarterEnd = new Date(Date.UTC(year, quarter * 3, 0));
  const nextQuarterEnd = new Date(Date.UTC(year, (quarter + 1) * 3, 0));

  return {
    lastQuarterEnd,
    lastQuarterPayoutDeadline: addDays(lastQuarterEnd, PAYOUT_DEADLINE_DAYS),
    nextQuarterEnd,
    nextQuarterPayoutDeadline: addDays(nextQuarterEnd, PAYOUT_DEADLINE_DAYS),
  };
}

/**
 * The next payout deadline that is still ahead of (or exactly on) today: last quarter's deadline
 * if it has not passed yet, otherwise the current quarter's. For the AI context builder (Phase 8).
 */
export function getNextPayoutDeadline(now: Date): Date {
  const { lastQuarterPayoutDeadline, nextQuarterPayoutDeadline } = getPayoutWindows(now);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return lastQuarterPayoutDeadline.getTime() >= startOfToday.getTime()
    ? lastQuarterPayoutDeadline
    : nextQuarterPayoutDeadline;
}

/** True when the pending amount is under the minimum payout threshold (INR 1,000). */
export function isBelowPayoutThreshold(pending: number): boolean {
  return pending < PAYOUT_THRESHOLD;
}

/** "YYYY-MM-DD" in UTC, for API output of date-only values. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export { PAYOUT_THRESHOLD };
