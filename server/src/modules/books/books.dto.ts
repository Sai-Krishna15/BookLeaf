import { PAYOUT_THRESHOLD, getPayoutWindows, toIsoDate } from '../../common/royalty';
import { parseBookStatus, type StageProgress } from '../../common/productionStage';

/** Shape returned by the repository's BOOK_SELECT. */
export interface BookRow {
  id: string;
  authorId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: Date | null;
  status: string;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutDate: Date | null;
  printPartner: string | null;
  availableOn: string[];
}

export interface BookDto {
  id: string;
  authorId: string;
  title: string;
  isbn: string; // shown exactly as stored, including XXXX placeholders
  genre: string;
  publicationDate: string | null; // YYYY-MM-DD
  status: string;
  /** Money fields are null (not 0) while a book is unpublished. */
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number | null;
  royaltyPaid: number | null;
  royaltyPending: number | null;
  lastRoyaltyPayoutDate: string | null; // YYYY-MM-DD
  printPartner: string | null;
  availableOn: string[];
  // computed
  isPublished: boolean;
  productionStage: {
    currentStage: string | null;
    currentStageIndex: number | null;
    stages: StageProgress[];
  };
  neverPaid: boolean;
  belowPayoutThreshold: boolean;
  payoutWindows: {
    lastQuarterEnd: string;
    lastQuarterPayoutDeadline: string;
    nextQuarterEnd: string;
    nextQuarterPayoutDeadline: string;
  };
}

/**
 * "Published" comes from the parsed status. If the status is unparseable we fall back to the
 * publication date, so an odd status string can never hide a live book's royalty figures.
 */
export function isBookPublished(row: Pick<BookRow, 'status' | 'publicationDate'>): boolean {
  const parsed = parseBookStatus(row.status);
  return parsed.isPublished || (parsed.currentStage === null && row.publicationDate !== null);
}

const dateOnly = (d: Date | null): string | null => (d ? toIsoDate(d) : null);

/** Pure: `now` is injected so tests (and Phase 8) can use fixed dates. */
export function toBookDto(row: BookRow, now: Date): BookDto {
  const parsed = parseBookStatus(row.status);
  const isPublished = isBookPublished(row);
  const money = <T>(value: T): T | null => (isPublished ? value : null);
  const w = getPayoutWindows(now);

  return {
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    isbn: row.isbn,
    genre: row.genre,
    publicationDate: dateOnly(row.publicationDate),
    status: row.status,
    mrp: money(row.mrp),
    authorRoyaltyPerCopy: money(row.authorRoyaltyPerCopy),
    totalCopiesSold: row.totalCopiesSold,
    totalRoyaltyEarned: money(row.totalRoyaltyEarned),
    royaltyPaid: money(row.royaltyPaid),
    royaltyPending: money(row.royaltyPending),
    lastRoyaltyPayoutDate: dateOnly(row.lastRoyaltyPayoutDate),
    printPartner: row.printPartner,
    availableOn: row.availableOn,
    isPublished,
    productionStage: {
      currentStage: parsed.currentStage,
      currentStageIndex: parsed.currentStageIndex,
      stages: parsed.stages,
    },
    neverPaid: isPublished && row.royaltyPaid === 0,
    belowPayoutThreshold: isPublished && row.royaltyPending > 0 && row.royaltyPending < PAYOUT_THRESHOLD,
    payoutWindows: {
      lastQuarterEnd: toIsoDate(w.lastQuarterEnd),
      lastQuarterPayoutDeadline: toIsoDate(w.lastQuarterPayoutDeadline),
      nextQuarterEnd: toIsoDate(w.nextQuarterEnd),
      nextQuarterPayoutDeadline: toIsoDate(w.nextQuarterPayoutDeadline),
    },
  };
}

export interface BooksSummary {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  bookCount: number;
  publishedCount: number;
  inProductionCount: number;
  payoutThreshold: number;
  /**
   * Author-level accumulation (per the KB, pending royalties accumulate across an author's books
   * until the total reaches the threshold): true when 0 < totalPending < 1000.
   */
  pendingBelowThreshold: boolean;
}

/** Pure aggregation over ALL of an author's books (not a page). */
export function buildSummary(rows: BookRow[]): BooksSummary {
  let totalEarned = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let publishedCount = 0;
  for (const r of rows) {
    totalEarned += r.totalRoyaltyEarned;
    totalPaid += r.royaltyPaid;
    totalPending += r.royaltyPending;
    if (isBookPublished(r)) publishedCount += 1;
  }
  return {
    totalEarned,
    totalPaid,
    totalPending,
    bookCount: rows.length,
    publishedCount,
    inProductionCount: rows.length - publishedCount,
    payoutThreshold: PAYOUT_THRESHOLD,
    pendingBelowThreshold: totalPending > 0 && totalPending < PAYOUT_THRESHOLD,
  };
}
