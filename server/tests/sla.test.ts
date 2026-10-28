import { describe, expect, it } from 'vitest';
import { SLA_HOURS, ageHours, isOverdue } from '../src/common/sla';
import type { Priority, TicketStatus } from '../src/generated/prisma/client';

function makeTicket(
  status: TicketStatus,
  priority: Priority,
  createdHoursAgo: number,
  firstResponseAt: Date | null = null,
  now: Date = new Date(),
): { status: TicketStatus; priority: Priority; firstResponseAt: Date | null; createdAt: Date } {
  const createdAt = new Date(now.getTime() - createdHoursAgo * 3_600_000);
  return { status, priority, firstResponseAt, createdAt };
}

describe('ageHours', () => {
  it('returns 0 for same instant', () => {
    const t = new Date('2026-01-01T00:00:00Z');
    expect(ageHours(t, t)).toBe(0);
  });

  it('returns exact fractional hours', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T01:30:00Z');
    expect(ageHours(createdAt, now)).toBeCloseTo(1.5);
  });

  it('handles multi-day spans', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-08T00:00:00Z');
    expect(ageHours(createdAt, now)).toBe(7 * 24);
  });
});

describe('SLA_HOURS', () => {
  it('has correct limits', () => {
    expect(SLA_HOURS.CRITICAL).toBe(24);
    expect(SLA_HOURS.HIGH).toBe(48);
    expect(SLA_HOURS.MEDIUM).toBe(5 * 24);
    expect(SLA_HOURS.LOW).toBe(7 * 24);
  });
});

describe('isOverdue', () => {
  const NOW = new Date('2026-06-15T12:00:00Z');

  it('CRITICAL: overdue when OPEN, no first response, age > 24h', () => {
    const t = makeTicket('OPEN', 'CRITICAL', 25, null, NOW);
    expect(isOverdue(t, NOW)).toBe(true);
  });

  it('CRITICAL: not overdue when age <= 24h', () => {
    const t = makeTicket('OPEN', 'CRITICAL', 23, null, NOW);
    expect(isOverdue(t, NOW)).toBe(false);
  });

  it('HIGH: overdue when IN_PROGRESS, no first response, age > 48h', () => {
    const t = makeTicket('IN_PROGRESS', 'HIGH', 49, null, NOW);
    expect(isOverdue(t, NOW)).toBe(true);
  });

  it('HIGH: not overdue if first response exists', () => {
    const firstResponseAt = new Date(NOW.getTime() - 10 * 3_600_000);
    const t = makeTicket('IN_PROGRESS', 'HIGH', 72, firstResponseAt, NOW);
    expect(isOverdue(t, NOW)).toBe(false);
  });

  it('MEDIUM: overdue after 5 days (120h)', () => {
    const t = makeTicket('OPEN', 'MEDIUM', 121, null, NOW);
    expect(isOverdue(t, NOW)).toBe(true);
  });

  it('MEDIUM: not overdue at exactly 120h', () => {
    const t = makeTicket('OPEN', 'MEDIUM', 120, null, NOW);
    expect(isOverdue(t, NOW)).toBe(false);
  });

  it('LOW: overdue after 7 days (168h)', () => {
    const t = makeTicket('OPEN', 'LOW', 169, null, NOW);
    expect(isOverdue(t, NOW)).toBe(true);
  });

  it('RESOLVED ticket is never overdue even if very old', () => {
    const t = makeTicket('RESOLVED', 'CRITICAL', 1000, null, NOW);
    expect(isOverdue(t, NOW)).toBe(false);
  });

  it('CLOSED ticket is never overdue', () => {
    const t = makeTicket('CLOSED', 'HIGH', 1000, null, NOW);
    expect(isOverdue(t, NOW)).toBe(false);
  });

  it('OPEN with first response is not overdue regardless of age', () => {
    const firstResponseAt = new Date(NOW.getTime() - 1000 * 3_600_000);
    const t = makeTicket('OPEN', 'CRITICAL', 9999, firstResponseAt, NOW);
    expect(isOverdue(t, NOW)).toBe(false);
  });
});
