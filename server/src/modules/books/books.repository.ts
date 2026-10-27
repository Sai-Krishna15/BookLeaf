import { prisma } from '../../config/prisma';

/**
 * Explicit select: only Book columns the API may expose, never relations or anything else.
 * This is the only layer that touches Prisma for books.
 */
const BOOK_SELECT = {
  id: true,
  authorId: true,
  title: true,
  isbn: true,
  genre: true,
  publicationDate: true,
  status: true,
  mrp: true,
  authorRoyaltyPerCopy: true,
  totalCopiesSold: true,
  totalRoyaltyEarned: true,
  royaltyPaid: true,
  royaltyPending: true,
  lastRoyaltyPayoutDate: true,
  printPartner: true,
  availableOn: true,
} as const;

/** Published books first (newest first), then in-production books (null date), stable by id. */
const DEFAULT_ORDER = [{ publicationDate: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }] as const;

export const booksRepository = {
  async findPage(authorId: string | undefined, skip: number, take: number) {
    const where = authorId ? { authorId } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.book.findMany({ where, select: BOOK_SELECT, orderBy: [...DEFAULT_ORDER], skip, take }),
      prisma.book.count({ where }),
    ]);
    return { rows, total };
  },

  findById(id: string) {
    return prisma.book.findUnique({ where: { id }, select: BOOK_SELECT });
  },

  /** Every book of one author (authors have a handful), for whole-portfolio aggregation. */
  findAllByAuthor(authorId: string) {
    return prisma.book.findMany({ where: { authorId }, select: BOOK_SELECT });
  },

  async authorExists(authorId: string): Promise<boolean> {
    return (await prisma.author.count({ where: { id: authorId } })) > 0;
  },
};
