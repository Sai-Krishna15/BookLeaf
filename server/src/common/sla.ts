/**
 * SLA first-response limits (PROJECT_CONTEXT §10.6).
 * Assumption: SLA clock starts at createdAt; isOverdue is true only for OPEN or IN_PROGRESS
 * tickets where firstResponseAt is still null AND age has exceeded the priority limit.
 */

import type { Priority, TicketStatus } from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// SLA limits (hours)
// ---------------------------------------------------------------------------

/** SLA first-response limits per priority (hours). */
export const SLA_HOURS: Record<Priority, number> = {
  CRITICAL: 24,
  HIGH: 48,
  MEDIUM: 5 * 24, // 120 h
  LOW: 7 * 24,   // 168 h
} as const;

/**
 * Priority weights used for urgency sorting (lower = more urgent).
 * Stored here to keep ordering logic alongside SLA context.
 * SQL CASE uses the inverse: CRITICAL → 1, LOW → 4.
 */
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
} as const;

// ---------------------------------------------------------------------------
// Pure helpers — always accept `now: Date` so tests can fix the clock
// ---------------------------------------------------------------------------

/** Hours elapsed between createdAt and now (may be fractional). */
export function ageHours(createdAt: Date, now: Date): number {
  return (now.getTime() - createdAt.getTime()) / 3_600_000;
}

/**
 * Returns true when the ticket is overdue per the SLA:
 *  - status is OPEN or IN_PROGRESS, AND
 *  - no first response has been recorded yet, AND
 *  - age > SLA limit for the ticket's priority.
 */
export function isOverdue(
  ticket: { status: TicketStatus; priority: Priority; firstResponseAt: Date | null; createdAt: Date },
  now: Date,
): boolean {
  const unresolved: TicketStatus[] = ['OPEN', 'IN_PROGRESS'];
  if (!unresolved.includes(ticket.status)) return false;
  if (ticket.firstResponseAt !== null) return false;
  return ageHours(ticket.createdAt, now) > SLA_HOURS[ticket.priority];
}
