import bcrypt from 'bcryptjs';
import { afterAll, describe, expect, it } from 'vitest';
import { formatTicketNumber } from '../src/common/ticketNumber';
import { prisma } from '../src/config/prisma';
import { runSeed } from '../prisma/seed';

/** Retries fn up to maxAttempts times on Neon ETIMEDOUT (cold-start / pool exhaustion). */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, delayMs = 3000): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTimeout = (err as { code?: string })?.code === 'ETIMEDOUT' ||
        (err instanceof Error && err.message.includes('ETIMEDOUT'));
      if (!isTimeout || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error('unreachable');
}

// Runs against the real database from server/.env (Neon). Seed is idempotent, so this is safe to repeat.
describe('seed', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('is idempotent: running twice yields identical counts and no duplicates', async () => {
    const first = await withRetry(() => runSeed(prisma));
    // Only count messages on seed tickets: tickets.test.ts runs concurrently and creates its
    // own messages between the two runSeed calls, which would inflate the total count.
    const seedMsgCount = () =>
      prisma.ticketMessage.count({ where: { ticketId: { startsWith: 'seed-ticket-' } } });
    const messagesAfterFirst = await seedMsgCount();
    const second = await withRetry(() => runSeed(prisma));

    // Compare only the entities the seed manages (authors, books, users).
    // Ticket count is total-DB and may grow if other test files create tickets concurrently.
    expect(second.authors).toBe(first.authors);
    expect(second.books).toBe(first.books);
    expect(second.users).toBe(first.users);
    expect(second.authors).toBe(10);
    expect(second.books).toBe(18);
    expect(second.users).toBe(12);
    // Seed tickets specifically are always exactly 9 (skipDuplicates keeps them idempotent).
    expect(await prisma.ticket.count({ where: { id: { startsWith: 'seed-ticket-' } } })).toBe(9);
    expect(await seedMsgCount()).toBe(messagesAfterFirst);
  }, 120_000);

  it('seeds roles: 10 authors, 2 admins, each author user linked to an author', async () => {
    expect(await prisma.user.count({ where: { role: 'AUTHOR', authorId: { not: null } } })).toBe(10);
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, orderBy: { email: 'asc' } });
    expect(admins.map((a) => a.email)).toEqual(['admin@bookleaf.com', 'ops@bookleaf.com']);
    expect(await bcrypt.compare('Admin@1234', admins[0]!.passwordHash)).toBe(true);
    const priya = await prisma.user.findUniqueOrThrow({ where: { email: 'priya.sharma@email.com' } });
    expect(await bcrypt.compare('Test@1234', priya.passwordHash)).toBe(true);
  }, 30_000);

  it('keeps in-production books null (BK013, BK015) and the ISBN placeholders as stored', async () => {
    for (const id of ['BK013', 'BK015']) {
      const b = await prisma.book.findUniqueOrThrow({ where: { id } });
      expect(b.mrp).toBeNull();
      expect(b.publicationDate).toBeNull();
      expect(b.authorRoyaltyPerCopy).toBeNull();
      expect(b.lastRoyaltyPayoutDate).toBeNull();
      expect(b.isbn).toContain('XXXX');
    }
    const bk016 = await prisma.book.findUniqueOrThrow({ where: { id: 'BK016' } });
    expect(bk016.royaltyPending).toBe(850);
    expect(bk016.lastRoyaltyPayoutDate).toBeNull();
  }, 30_000);

  it('preserves UTF-8 (curly apostrophe) and parses dates', async () => {
    const b = await prisma.book.findUniqueOrThrow({ where: { id: 'BK017' } });
    expect(b.title).toBe('Durga’s Daughters');
    const bk001 = await prisma.book.findUniqueOrThrow({ where: { id: 'BK001' } });
    expect(bk001.publicationDate?.toISOString().slice(0, 10)).toBe('2023-06-20');
    expect(bk001.availableOn).toEqual(['Amazon India', 'Flipkart', 'BookLeaf Store']);
  }, 30_000);

  it('seeds varied demo tickets incl. internal note and an AI-failed ticket', async () => {
    // Reset seed-ticket-1006 (Priya's resolved ticket) in case a previous test
    // run reopened it via the follow-up message test. The seed is idempotent for
    // inserts but does not re-apply status changes made through the app.
    await prisma.ticket.update({
      where: { id: 'seed-ticket-1006' },
      data: { status: 'RESOLVED', resolvedAt: new Date(Date.now() - 100 * 3_600_000) },
    });

    const tickets = await prisma.ticket.findMany({ where: { id: { startsWith: 'seed-ticket-' } } });
    expect(new Set(tickets.map((t) => t.category)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(tickets.map((t) => t.status)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(tickets.map((t) => t.priority)).size).toBeGreaterThanOrEqual(3);

    expect(await prisma.ticketMessage.count({ where: { type: 'INTERNAL_NOTE' } })).toBeGreaterThanOrEqual(1);

    const failed = tickets.filter((t) => t.aiStatus === 'FAILED');
    expect(failed.length).toBeGreaterThanOrEqual(1);
    expect(failed.every((t) => t.needsManualTriage && t.categorySource === 'FALLBACK')).toBe(true);
    expect(tickets.filter((t) => t.aiStatus === 'DONE').every((t) => t.categorySource === 'AI')).toBe(true);

    const resolved = tickets.find((t) => t.status === 'RESOLVED');
    expect(resolved?.resolvedAt).not.toBeNull();
  }, 30_000);

  it('numbers tickets from 1001 and formats them as BL-xxxx', async () => {
    const nums = (await prisma.ticket.findMany({ where: { id: { startsWith: 'seed-ticket-' } }, select: { ticketNumber: true } }))
      .map((t) => t.ticketNumber)
      .sort((a, b) => a - b);
    expect(nums[0]).toBe(1001);
    expect(formatTicketNumber(1001)).toBe('BL-1001');
  }, 30_000);
});
