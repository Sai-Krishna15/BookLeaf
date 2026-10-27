import { describe, expect, it } from 'vitest';
import { buildSummary, isBookPublished, toBookDto, type BookRow } from '../src/modules/books/books.dto';

const NOW = new Date('2026-02-10T12:00:00Z');

const published: BookRow = {
  id: 'BKX1', authorId: 'AUTHX', title: 'Live Book', isbn: '978-93-5XXXX-01-1', genre: 'Fiction',
  publicationDate: new Date('2023-06-20'), status: 'Published & Live', mrp: 399, authorRoyaltyPerCopy: 35,
  totalCopiesSold: 342, totalRoyaltyEarned: 11970, royaltyPaid: 8400, royaltyPending: 3570,
  lastRoyaltyPayoutDate: new Date('2025-10-15'), printPartner: 'In-House', availableOn: ['Amazon India'],
};
const inProduction: BookRow = {
  ...published, id: 'BKX2', title: 'WIP', publicationDate: null, status: 'In Production - Cover Design',
  mrp: null, authorRoyaltyPerCopy: null, totalCopiesSold: 0, totalRoyaltyEarned: 0, royaltyPaid: 0,
  royaltyPending: 0, lastRoyaltyPayoutDate: null, printPartner: null, availableOn: [],
};

describe('toBookDto', () => {
  it('published book: figures intact, date-only strings, payout windows from `now`', () => {
    const d = toBookDto(published, NOW);
    expect(d).toMatchObject({
      isPublished: true, mrp: 399, totalRoyaltyEarned: 11970, royaltyPaid: 8400, royaltyPending: 3570,
      publicationDate: '2023-06-20', lastRoyaltyPayoutDate: '2025-10-15', neverPaid: false,
      belowPayoutThreshold: false,
    });
    expect(d.payoutWindows).toEqual({
      lastQuarterEnd: '2025-12-31', lastQuarterPayoutDeadline: '2026-02-14',
      nextQuarterEnd: '2026-03-31', nextQuarterPayoutDeadline: '2026-05-15',
    });
    expect(d.productionStage.currentStage).toBe('Published & Live');
  });

  it('unpublished book: money fields are null (not 0); copies sold stays a number', () => {
    const d = toBookDto(inProduction, NOW);
    expect(d).toMatchObject({
      isPublished: false, mrp: null, authorRoyaltyPerCopy: null, totalRoyaltyEarned: null,
      royaltyPaid: null, royaltyPending: null, publicationDate: null, lastRoyaltyPayoutDate: null,
      totalCopiesSold: 0, neverPaid: false, belowPayoutThreshold: false,
    });
    expect(d.productionStage).toMatchObject({ currentStage: 'Cover Design', currentStageIndex: 2 });
  });

  it('neverPaid / belowPayoutThreshold edge cases', () => {
    const neverPaid = toBookDto({ ...published, royaltyPaid: 0, royaltyPending: 850 }, NOW);
    expect(neverPaid).toMatchObject({ neverPaid: true, belowPayoutThreshold: true });
    const exactly1000 = toBookDto({ ...published, royaltyPending: 1000 }, NOW);
    expect(exactly1000.belowPayoutThreshold).toBe(false);
    const nothingPending = toBookDto({ ...published, royaltyPending: 0 }, NOW);
    expect(nothingPending.belowPayoutThreshold).toBe(false); // nothing to roll over
  });

  it('unparseable status never hides a live book: falls back to publicationDate', () => {
    const odd = { ...published, status: 'Some Future Status' };
    expect(isBookPublished(odd)).toBe(true);
    expect(toBookDto(odd, NOW)).toMatchObject({ isPublished: true, mrp: 399 });
    expect(toBookDto(odd, NOW).productionStage.currentStage).toBeNull();
    expect(isBookPublished({ status: 'Some Future Status', publicationDate: null })).toBe(false);
  });

  it('exposes exactly the documented fields', () => {
    expect(Object.keys(toBookDto(published, NOW)).sort()).toEqual([
      'authorId', 'authorRoyaltyPerCopy', 'availableOn', 'belowPayoutThreshold', 'genre', 'id', 'isPublished',
      'isbn', 'lastRoyaltyPayoutDate', 'mrp', 'neverPaid', 'payoutWindows', 'printPartner', 'productionStage',
      'publicationDate', 'royaltyPaid', 'royaltyPending', 'status', 'title', 'totalCopiesSold',
      'totalRoyaltyEarned',
    ]);
  });
});

describe('buildSummary', () => {
  it('sums every book and counts published vs in-production', () => {
    const s = buildSummary([published, { ...published, id: 'B3', totalRoyaltyEarned: 30, royaltyPaid: 10, royaltyPending: 20 }, inProduction]);
    expect(s).toEqual({
      totalEarned: 12000, totalPaid: 8410, totalPending: 3590, bookCount: 3, publishedCount: 2,
      inProductionCount: 1, payoutThreshold: 1000, pendingBelowThreshold: false,
    });
  });

  it('pendingBelowThreshold is an author-level accumulation (0 < total < 1000)', () => {
    const small = { ...published, royaltyPending: 850 };
    expect(buildSummary([small]).pendingBelowThreshold).toBe(true);
    expect(buildSummary([small, { ...published, id: 'B3', royaltyPending: 150 }]).pendingBelowThreshold).toBe(false); // sums to 1000
    expect(buildSummary([{ ...published, royaltyPending: 0 }]).pendingBelowThreshold).toBe(false);
  });

  it('empty portfolio', () => {
    expect(buildSummary([])).toMatchObject({ totalEarned: 0, bookCount: 0, publishedCount: 0, inProductionCount: 0, pendingBelowThreshold: false });
  });
});
