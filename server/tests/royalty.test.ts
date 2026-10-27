import { describe, expect, it } from 'vitest';
import { PAYOUT_THRESHOLD } from '../src/config/constants';
import { getNextPayoutDeadline, getPayoutWindows, isBelowPayoutThreshold, toIsoDate } from '../src/common/royalty';

const at = (iso: string) => new Date(iso);
const windows = (iso: string) => {
  const w = getPayoutWindows(at(iso));
  return {
    lastQuarterEnd: toIsoDate(w.lastQuarterEnd),
    lastQuarterPayoutDeadline: toIsoDate(w.lastQuarterPayoutDeadline),
    nextQuarterEnd: toIsoDate(w.nextQuarterEnd),
    nextQuarterPayoutDeadline: toIsoDate(w.nextQuarterPayoutDeadline),
  };
};

describe('getPayoutWindows (calendar quarters, deadline = quarter end + 45 days)', () => {
  it('mid-Q1', () => {
    expect(windows('2026-02-10T12:00:00Z')).toEqual({
      lastQuarterEnd: '2025-12-31',
      lastQuarterPayoutDeadline: '2026-02-14',
      nextQuarterEnd: '2026-03-31',
      nextQuarterPayoutDeadline: '2026-05-15',
    });
  });

  it('year rollover: 1 Jan looks back to 31 Dec of the previous year', () => {
    expect(windows('2026-01-01T00:00:00Z')).toEqual({
      lastQuarterEnd: '2025-12-31',
      lastQuarterPayoutDeadline: '2026-02-14',
      nextQuarterEnd: '2026-03-31',
      nextQuarterPayoutDeadline: '2026-05-15',
    });
  });

  it('year rollover: 31 Dec is still inside Q4, so the next quarter end is that same day', () => {
    expect(windows('2025-12-31T23:59:59Z')).toEqual({
      lastQuarterEnd: '2025-09-30',
      lastQuarterPayoutDeadline: '2025-11-14',
      nextQuarterEnd: '2025-12-31',
      nextQuarterPayoutDeadline: '2026-02-14',
    });
  });

  it('quarter boundary: the last second of a quarter vs the first second of the next', () => {
    expect(windows('2026-03-31T23:59:59Z').lastQuarterEnd).toBe('2025-12-31');
    expect(windows('2026-03-31T23:59:59Z').nextQuarterEnd).toBe('2026-03-31');
    expect(windows('2026-04-01T00:00:00Z').lastQuarterEnd).toBe('2026-03-31');
    expect(windows('2026-04-01T00:00:00Z').nextQuarterEnd).toBe('2026-06-30');
  });

  it.each([
    ['2026-04-15', '2026-03-31', '2026-06-30'],
    ['2026-07-15', '2026-06-30', '2026-09-30'],
    ['2026-10-26', '2026-09-30', '2026-12-31'],
    ['2026-09-30', '2026-06-30', '2026-09-30'],
    ['2026-10-01', '2026-09-30', '2026-12-31'],
  ])('%s -> last %s, next %s', (now, last, next) => {
    const w = windows(`${now}T10:00:00Z`);
    expect(w.lastQuarterEnd).toBe(last);
    expect(w.nextQuarterEnd).toBe(next);
  });

  it('deadlines are exactly 45 days after the quarter end', () => {
    for (const iso of ['2026-02-10', '2026-05-10', '2026-08-10', '2026-11-10', '2028-02-29']) {
      const w = getPayoutWindows(at(`${iso}T00:00:00Z`));
      expect((w.lastQuarterPayoutDeadline.getTime() - w.lastQuarterEnd.getTime()) / 86_400_000).toBe(45);
      expect((w.nextQuarterPayoutDeadline.getTime() - w.nextQuarterEnd.getTime()) / 86_400_000).toBe(45);
    }
  });

  it('works in a leap year and for any year (nothing hardcoded)', () => {
    expect(windows('2028-02-29T00:00:00Z')).toMatchObject({
      lastQuarterEnd: '2027-12-31',
      lastQuarterPayoutDeadline: '2028-02-14',
      nextQuarterEnd: '2028-03-31',
    });
    expect(windows('2031-08-01T00:00:00Z').lastQuarterEnd).toBe('2031-06-30');
  });

  it('does not mutate its input and returns midnight-UTC dates', () => {
    const now = at('2026-05-05T15:30:00Z');
    const before = now.getTime();
    const w = getPayoutWindows(now);
    expect(now.getTime()).toBe(before);
    expect(w.lastQuarterEnd.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });
});

describe('getNextPayoutDeadline', () => {
  it('is last quarter\'s deadline while it is still ahead (or today)', () => {
    expect(toIsoDate(getNextPayoutDeadline(at('2026-10-26T09:00:00Z')))).toBe('2026-11-14');
    expect(toIsoDate(getNextPayoutDeadline(at('2026-11-14T23:00:00Z')))).toBe('2026-11-14');
  });

  it('rolls to the current quarter\'s deadline once last quarter\'s has passed', () => {
    expect(toIsoDate(getNextPayoutDeadline(at('2026-11-15T00:00:00Z')))).toBe('2027-02-14');
  });
});

describe('isBelowPayoutThreshold', () => {
  it('threshold is 1000', () => {
    expect(PAYOUT_THRESHOLD).toBe(1000);
  });

  it('is strictly below the threshold', () => {
    expect(isBelowPayoutThreshold(850)).toBe(true);
    expect(isBelowPayoutThreshold(999)).toBe(true);
    expect(isBelowPayoutThreshold(1000)).toBe(false);
    expect(isBelowPayoutThreshold(2546)).toBe(false);
  });
});
