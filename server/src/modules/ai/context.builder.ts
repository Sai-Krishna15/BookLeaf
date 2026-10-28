import { TicketCategory } from '../../generated/prisma/enums';
import { getCategoryKb, COMPANY_OVERVIEW } from './kb';
import { scrubPii } from './prompts/classify.prompt';
import { parseBookStatus } from '../../common/productionStage';
import {
  getPayoutWindows,
  getNextPayoutDeadline,
  isBelowPayoutThreshold,
  toIsoDate,
} from '../../common/royalty';

export type RoyaltyHint = 'BELOW_THRESHOLD' | 'POSSIBLY_OVERDUE' | 'WITHIN_CYCLE' | 'NOT_APPLICABLE';

export interface BookFacts {
  title: string;
  status: string;
  currentProductionStage: string | null;
  publicationDate: string;
  copiesSold: number;
  mrp: string;
  royaltyPerCopy: string;
  totalEarned: string;
  paid: string;
  pending: string;
  lastPayoutDate: string;
  printPartner: string;
  platforms: string;
  isInProduction: boolean;
  neverPaid: boolean;
  belowPayoutThreshold: boolean;
  nextPayoutWindow: string;
}

export interface AuthorRoyaltySummary {
  totalEarned: string;
  paid: string;
  pending: string;
  belowPayoutThreshold: boolean;
}

export interface ConversationMessage {
  from: string;
  text: string;
  date: string;
}

export interface DraftContext {
  authorFirstName: string;
  category: TicketCategory;
  categoryProvisional: boolean;
  companyOverview: string;
  policy: string;
  fewShots: Array<{ authorQuery: string; idealResponse: string }>;
  ticketSubject: string;
  ticketDescription: string;
  bookFacts: BookFacts | null;
  authorTotals: AuthorRoyaltySummary | null;
  royaltyHint: RoyaltyHint;
  recentMessages: ConversationMessage[];
}

export interface BuildDraftContextInput {
  ticket: {
    id: string;
    ticketNumber?: number;
    subject: string;
    description: string;
    category?: TicketCategory | string | null;
    createdAt: Date;
  };
  author: {
    id: string;
    name: string;
  };
  book?: {
    id: string;
    title: string;
    status: string;
    publicationDate: Date | null;
    totalCopiesSold: number;
    mrp: number | null;
    authorRoyaltyPerCopy: number | null;
    totalRoyaltyEarned: number;
    royaltyPaid: number;
    royaltyPending: number;
    lastRoyaltyPayoutDate: Date | null;
    printPartner: string | null;
    availableOn: string[];
  } | null;
  authorTotals?: {
    totalRoyaltyEarned: number;
    royaltyPaid: number;
    royaltyPending: number;
    belowPayoutThreshold?: boolean;
  } | null;
  messages?: Array<{
    type: string;
    body: string;
    createdAt: Date;
    senderName?: string;
  }>;
  now?: Date;
}

/**
 * Computes the first full calendar-quarter payout deadline following publication.
 * E.g., published Jan 15 (Q1) -> Q1 ends Mar 31 -> deadline is May 15 (Mar 31 + 45 days).
 */
function getFirstQuarterPayoutDeadline(pubDate: Date): Date {
  const year = pubDate.getUTCFullYear();
  const quarter = Math.floor(pubDate.getUTCMonth() / 3);
  const quarterEnd = new Date(Date.UTC(year, (quarter + 1) * 3, 0));
  const deadline = new Date(quarterEnd.getTime());
  deadline.setUTCDate(deadline.getUTCDate() + 45);
  return deadline;
}

/**
 * Computes the deterministic Royalty Hint (PROJECT_CONTEXT §8.4):
 * - NOT_APPLICABLE: Book is in production or has no publication date.
 * - BELOW_THRESHOLD: Pending royalty is strictly below the ₹1,000 threshold (rolls over to next quarter).
 * - POSSIBLY_OVERDUE: Book is published, never paid (paid=0), pending >= ₹1,000, and the book's first
 *   quarter-end + 45 days has already passed relative to `now`.
 * - WITHIN_CYCLE: Royalty is currently within the active calendar quarter / payout window.
 */
export function computeRoyaltyHint(
  book: BuildDraftContextInput['book'],
  authorTotals: BuildDraftContextInput['authorTotals'],
  now: Date,
): RoyaltyHint {
  // If specific book is provided:
  if (book) {
    const parsedStatus = parseBookStatus(book.status);
    const isInProduction = !parsedStatus.isPublished;
    if (isInProduction || !book.publicationDate) {
      return 'NOT_APPLICABLE';
    }

    if (isBelowPayoutThreshold(book.royaltyPending)) {
      return 'BELOW_THRESHOLD';
    }

    if (book.royaltyPaid === 0 && book.royaltyPending >= 1000) {
      const firstDeadline = getFirstQuarterPayoutDeadline(book.publicationDate);
      if (now.getTime() > firstDeadline.getTime()) {
        return 'POSSIBLY_OVERDUE';
      }
    }

    return 'WITHIN_CYCLE';
  }

  // Account-level / General query:
  if (authorTotals) {
    if (isBelowPayoutThreshold(authorTotals.royaltyPending)) {
      return 'BELOW_THRESHOLD';
    }
    if (authorTotals.royaltyPaid === 0 && authorTotals.royaltyPending >= 1000) {
      return 'POSSIBLY_OVERDUE';
    }
    return 'WITHIN_CYCLE';
  }

  return 'NOT_APPLICABLE';
}

/**
 * Builds the complete structured ground-truth context for draft reply generation.
 *
 * Strict Privacy & Safety Guarantees:
 * - Only the author's FIRST NAME is included (no phone, email, address, or location).
 * - Ticket text is scrubbed of any phone numbers and email addresses via `scrubPii`.
 * - Internal notes are strictly excluded from conversation history (only public messages).
 * - Book facts are computed in server code, never hallucinated by the model.
 */
export function buildDraftContext(input: BuildDraftContextInput): DraftContext {
  const now = input.now ?? new Date();
  const authorFirstName = input.author.name.trim().split(/\s+/)[0] || 'Author';

  // Category & provisional flag
  const rawCat = input.ticket.category;
  const categoryProvisional = !rawCat;
  const category = (rawCat ?? TicketCategory.GENERAL_INQUIRY) as TicketCategory;
  const kbData = getCategoryKb(category);

  // Compute Book Facts (ground truth)
  let bookFacts: BookFacts | null = null;
  if (input.book) {
    const b = input.book;
    const parsed = parseBookStatus(b.status);
    const isInProduction = !parsed.isPublished;
    const nextDeadline = getNextPayoutDeadline(now);

    bookFacts = {
      title: b.title,
      status: b.status,
      currentProductionStage: parsed.currentStage ?? (isInProduction ? 'In Production' : 'Published & Live'),
      publicationDate: b.publicationDate ? toIsoDate(b.publicationDate) : 'Not yet published (in production)',
      copiesSold: b.totalCopiesSold,
      mrp: b.mrp !== null ? `₹${b.mrp.toLocaleString('en-IN')}` : '—',
      royaltyPerCopy: b.authorRoyaltyPerCopy !== null ? `₹${b.authorRoyaltyPerCopy.toLocaleString('en-IN')}` : '—',
      totalEarned: `₹${b.totalRoyaltyEarned.toLocaleString('en-IN')}`,
      paid: `₹${b.royaltyPaid.toLocaleString('en-IN')}`,
      pending: `₹${b.royaltyPending.toLocaleString('en-IN')}`,
      lastPayoutDate: b.lastRoyaltyPayoutDate ? toIsoDate(b.lastRoyaltyPayoutDate) : 'none yet',
      printPartner: b.printPartner ?? 'BookLeaf Standard Print Network',
      platforms: b.availableOn.length > 0 ? b.availableOn.join(', ') : 'Direct Bookstore',
      isInProduction,
      neverPaid: b.royaltyPaid === 0,
      belowPayoutThreshold: isBelowPayoutThreshold(b.royaltyPending),
      nextPayoutWindow: toIsoDate(nextDeadline),
    };
  }

  // Author-level royalty totals (included for General tickets or Royalty inquiries)
  let authorTotals: AuthorRoyaltySummary | null = null;
  const includeAuthorTotals = !input.book || category === TicketCategory.ROYALTY_PAYMENTS;
  if (includeAuthorTotals && input.authorTotals) {
    authorTotals = {
      totalEarned: `₹${input.authorTotals.totalRoyaltyEarned.toLocaleString('en-IN')}`,
      paid: `₹${input.authorTotals.royaltyPaid.toLocaleString('en-IN')}`,
      pending: `₹${input.authorTotals.royaltyPending.toLocaleString('en-IN')}`,
      belowPayoutThreshold:
        input.authorTotals.belowPayoutThreshold ?? isBelowPayoutThreshold(input.authorTotals.royaltyPending),
    };
  }

  const royaltyHint = computeRoyaltyHint(input.book, input.authorTotals, now);

  // Conversation history: ONLY the last 3 PUBLIC messages (never internal notes)
  const publicMessages = (input.messages ?? [])
    .filter((m) => m.type !== 'INTERNAL_NOTE')
    .slice(-3)
    .map((m) => {
      const from = m.type === 'ADMIN_REPLY' ? 'BookLeaf Support' : authorFirstName;
      return {
        from,
        text: scrubPii(m.body.trim()),
        date: toIsoDate(m.createdAt),
      };
    });

  // Token Budget Guard: cap free-text to budget
  let ticketSubject = scrubPii(input.ticket.subject.trim());
  let ticketDescription = scrubPii(input.ticket.description.trim());
  const MAX_DESC_CHARS = 2000;
  if (ticketDescription.length > MAX_DESC_CHARS) {
    ticketDescription = ticketDescription.slice(0, MAX_DESC_CHARS) + '... [truncated]';
  }

  return {
    authorFirstName,
    category,
    categoryProvisional,
    companyOverview: COMPANY_OVERVIEW,
    policy: kbData.policy,
    fewShots: kbData.fewShots,
    ticketSubject,
    ticketDescription,
    bookFacts,
    authorTotals,
    royaltyHint,
    recentMessages: publicMessages,
  };
}
