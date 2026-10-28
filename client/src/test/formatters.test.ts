import { describe, it, expect } from 'vitest';
import {
  formatINR,
  formatDate,
  formatDateTime,
  relativeTime,
  formatTicketNumber,
} from '@/lib/formatters';

describe('Formatters', () => {
  describe('formatINR', () => {
    it('formats numbers with Indian digit grouping and ₹ prefix', () => {
      expect(formatINR(0)).toBe('₹0');
      expect(formatINR(100)).toBe('₹100');
      expect(formatINR(1000)).toBe('₹1,000');
      expect(formatINR(10000)).toBe('₹10,000');
      expect(formatINR(100000)).toBe('₹1,00,000');
      expect(formatINR(1234567)).toBe('₹12,34,567');
    });

    it('returns "—" for null, undefined, or NaN', () => {
      expect(formatINR(null)).toBe('—');
      expect(formatINR(undefined)).toBe('—');
      expect(formatINR(NaN)).toBe('—');
    });

    it('respects options: prefix=false and decimals', () => {
      expect(formatINR(10000, { prefix: false })).toBe('10,000');
      expect(formatINR(1000.5, { decimals: 2 })).toBe('₹1,000.50');
    });
  });

  describe('formatDate', () => {
    it('formats ISO date strings to "dd MMM yyyy"', () => {
      expect(formatDate('2024-03-15T00:00:00.000Z')).toBe('15 Mar 2024');
      expect(formatDate(new Date(2025, 0, 1))).toBe('01 Jan 2025');
    });

    it('returns default fallback "Not yet published" when date is null or undefined', () => {
      expect(formatDate(null)).toBe('Not yet published');
      expect(formatDate(undefined)).toBe('Not yet published');
      expect(formatDate('')).toBe('Not yet published');
    });

    it('returns custom fallback when provided', () => {
      expect(formatDate(null, 'No date')).toBe('No date');
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time', () => {
      const formatted = formatDateTime('2024-06-15T14:30:00.000Z');
      expect(formatted).toContain('Jun 2024');
    });

    it('returns fallback for null date', () => {
      expect(formatDateTime(null)).toBe('—');
    });
  });

  describe('relativeTime', () => {
    it('returns a relative time string for recent dates', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = relativeTime(past);
      expect(result).toMatch(/2 hours? ago/);
    });

    it('returns fallback for null or empty input', () => {
      expect(relativeTime(null)).toBe('Recently');
      expect(relativeTime(undefined)).toBe('Recently');
    });
  });

  describe('formatTicketNumber', () => {
    it('formats ticket IDs and numbers with BL- prefix', () => {
      expect(formatTicketNumber(1042)).toBe('BL-1042');
      expect(formatTicketNumber('1042')).toBe('BL-1042');
      expect(formatTicketNumber('BL-1042')).toBe('BL-1042');
      expect(formatTicketNumber('bl-1042')).toBe('BL-1042');
    });

    it('returns fallback for null or undefined', () => {
      expect(formatTicketNumber(null)).toBe('BL-—');
      expect(formatTicketNumber(undefined)).toBe('BL-—');
    });
  });
});
