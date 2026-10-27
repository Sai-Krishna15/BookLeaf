import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/common/jwt';

const app = createApp();

interface JsonBook {
  book_id: string;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  status: string;
}
interface JsonAuthor { author_id: string; email: string; books: JsonBook[] }
const SEED: JsonAuthor[] = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'prisma', 'data', 'bookleaf_sample_data.json'), 'utf8'),
).authors;
const seedAuthor = (id: string) => SEED.find((a) => a.author_id === id)!;

const tokens: Record<string, string> = {};
async function login(key: string, email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  tokens[key] = res.body.token;
}
const get = (url: string, who: string) => request(app).get(url).set('Authorization', `Bearer ${tokens[who]}`);

beforeAll(async () => {
  await Promise.all([
    login('priya', 'priya.sharma@email.com', 'Test@1234'),
    login('ananya', 'ananya.reddy@email.com', 'Test@1234'),
    login('sneha', 'sneha.kulkarni@email.com', 'Test@1234'),
    login('kavita', 'kavita.deshmukh@email.com', 'Test@1234'),
    login('admin', 'admin@bookleaf.com', 'Admin@1234'),
  ]);
  // An AUTHOR-role token that has no author profile attached.
  tokens.orphan = signAccessToken({ id: 'orphan-user', role: 'AUTHOR', authorId: null });
}, 60_000);

describe('GET /books (list)', () => {
  it('an author sees only their own books, newest publication first', async () => {
    const res = await get('/api/v1/books', 'priya');
    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { id: string }) => b.id)).toEqual(['BK002', 'BK001']); // 2024-01-10, then 2023-06-20
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false });
  });

  it('ignores ?authorId for an author (cannot widen scope)', async () => {
    const res = await get('/api/v1/books?authorId=AUTH002', 'priya');
    expect(res.status).toBe(200);
    expect(res.body.data.map((b: { id: string }) => b.id)).toEqual(['BK002', 'BK001']);
  });

  it('admin sees all 18 books: published first (newest first), in-production last', async () => {
    const res = await get('/api/v1/books?limit=100', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(18);
    const ids = res.body.data.map((b: { id: string }) => b.id);
    expect(ids.slice(-2)).toEqual(['BK013', 'BK015']);
    const dates = res.body.data.slice(0, 16).map((b: { publicationDate: string }) => b.publicationDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('admin can filter with ?authorId', async () => {
    const res = await get('/api/v1/books?authorId=AUTH007', 'admin');
    expect(res.body.data.map((b: { id: string }) => b.id).sort()).toEqual(['BK011', 'BK012', 'BK013']);
    expect((await get('/api/v1/books?authorId=NOPE', 'admin')).body.data).toEqual([]);
  });

  it('pagination meta with limit=1', async () => {
    const p1 = await get('/api/v1/books?limit=1&page=1', 'priya');
    expect(p1.body.data).toHaveLength(1);
    expect(p1.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2, hasNext: true, hasPrev: false });
    const p2 = await get('/api/v1/books?limit=1&page=2', 'priya');
    expect(p2.body.data[0].id).toBe('BK001');
    expect(p2.body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2, hasNext: false, hasPrev: true });
  });

  it('a page beyond the last returns empty data with correct meta', async () => {
    const res = await get('/api/v1/books?limit=1&page=50', 'priya');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toEqual({ page: 50, limit: 1, total: 2, totalPages: 2, hasNext: false, hasPrev: true });
  });

  it.each(['limit=101', 'limit=0', 'page=0', 'page=abc', 'limit=-1'])('400 VALIDATION_ERROR for %s', async (qs) => {
    const res = await get(`/api/v1/books?${qs}`, 'priya');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0]).toMatchObject({ in: 'query' });
    expect(res.body.error.requestId).toBeTruthy();
  });
});

describe('GET /books/:id', () => {
  it('an author reads their own book, with computed fields and payout windows', async () => {
    const res = await get('/api/v1/books/BK001', 'priya');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'BK001', title: 'Whispers of the Ganges', isbn: '978-93-5XXXX-01-1', isPublished: true, mrp: 399,
      publicationDate: '2023-06-20', lastRoyaltyPayoutDate: '2025-10-15', neverPaid: false, belowPayoutThreshold: false,
      availableOn: ['Amazon India', 'Flipkart', 'BookLeaf Store'],
    });
    for (const k of ['lastQuarterEnd', 'lastQuarterPayoutDeadline', 'nextQuarterEnd', 'nextQuarterPayoutDeadline']) {
      expect(res.body.payoutWindows[k]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(res.body.productionStage.currentStage).toBe('Published & Live');
  });

  it("another author's book is 404 (never 403), identical to a nonexistent id", async () => {
    const other = await get('/api/v1/books/BK003', 'priya');
    const missing = await get('/api/v1/books/BK999', 'priya');
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe('NOT_FOUND');
    expect(missing.status).toBe(404);
    expect(other.body.error.message).toBe(missing.body.error.message);
  });

  it('admin can read any book', async () => {
    const res = await get('/api/v1/books/BK003', 'admin');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'BK003', authorId: 'AUTH002' });
  });

  it('admin gets 404 for a nonexistent id', async () => {
    expect((await get('/api/v1/books/BK999', 'admin')).status).toBe(404);
  });

  it('400 for a malformed id', async () => {
    const res = await get('/api/v1/books/bad%20id!', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['BK013', 'sneha', 'Cover Design', 2],
    ['BK015', 'kavita', 'Typesetting', 3],
  ])('in-production %s: null money/date fields, not published, stage tracker', async (id, who, stage, idx) => {
    const res = await get(`/api/v1/books/${id}`, who);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mrp: null, publicationDate: null, authorRoyaltyPerCopy: null, totalRoyaltyEarned: null,
      royaltyPaid: null, royaltyPending: null, lastRoyaltyPayoutDate: null,
      isPublished: false, neverPaid: false, belowPayoutThreshold: false,
    });
    expect(res.body.isbn).toContain('XXXX'); // shown as stored
    expect(res.body.productionStage).toMatchObject({ currentStage: stage, currentStageIndex: idx });
    expect(res.body.productionStage.stages[idx]).toMatchObject({ name: stage, state: 'current' });
    expect(res.body.productionStage.stages[0].state).toBe('complete');
    expect(res.body.productionStage.stages[8].state).toBe('upcoming');
  });

  it('BK016 (Kavita): below the payout threshold and never paid', async () => {
    const res = await get('/api/v1/books/BK016', 'kavita');
    expect(res.body).toMatchObject({
      royaltyPending: 850, royaltyPaid: 0, neverPaid: true, belowPayoutThreshold: true,
      lastRoyaltyPayoutDate: null, isPublished: true,
    });
  });

  it("BK005 (Ananya): never paid, but pending is above the threshold", async () => {
    const res = await get('/api/v1/books/BK005', 'ananya');
    expect(res.body).toMatchObject({ neverPaid: true, belowPayoutThreshold: false, royaltyPending: 2546 });
  });

  it('keeps the curly apostrophe (UTF-8) from the seed', async () => {
    expect((await get('/api/v1/books/BK017', 'admin')).body.title).toBe('Durga’s Daughters');
  });
});

describe('GET /books/summary', () => {
  const expected = (authorId: string) => {
    const books = seedAuthor(authorId).books;
    return {
      totalEarned: books.reduce((n, b) => n + b.total_royalty_earned, 0),
      totalPaid: books.reduce((n, b) => n + b.royalty_paid, 0),
      totalPending: books.reduce((n, b) => n + b.royalty_pending, 0),
      bookCount: books.length,
      publishedCount: books.filter((b) => b.status === 'Published & Live').length,
    };
  };

  it('multi-book author (Sneha, 3 books) totals match the seed data across ALL books', async () => {
    const res = await get('/api/v1/books/summary', 'sneha');
    expect(res.status).toBe(200); // not captured by /:id
    const e = expected('AUTH007');
    expect(res.body).toMatchObject({ ...e, inProductionCount: 1, payoutThreshold: 1000, pendingBelowThreshold: false });
    expect(e.bookCount).toBe(3);
  });

  it('summary ignores pagination: it covers every book even though the list is paged', async () => {
    const paged = await get('/api/v1/books?limit=1', 'sneha');
    expect(paged.body.data).toHaveLength(1);
    const res = await get('/api/v1/books/summary?limit=1&page=2', 'sneha');
    expect(res.body.bookCount).toBe(3);
  });

  it('Kavita: 850 pending in total -> pendingBelowThreshold true', async () => {
    const res = await get('/api/v1/books/summary', 'kavita');
    expect(res.body).toMatchObject({ ...expected('AUTH009'), totalPending: 850, pendingBelowThreshold: true, inProductionCount: 1 });
  });

  it('an author cannot use ?authorId to read someone else\'s summary', async () => {
    const res = await get('/api/v1/books/summary?authorId=AUTH007', 'kavita');
    expect(res.body.totalPending).toBe(850);
    expect(res.body.bookCount).toBe(2);
  });

  it('admin with ?authorId gets that author; without it gets 400; unknown author is 404', async () => {
    const ok = await get('/api/v1/books/summary?authorId=AUTH007', 'admin');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject(expected('AUTH007'));
    const missing = await get('/api/v1/books/summary', 'admin');
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect((await get('/api/v1/books/summary?authorId=NOPE', 'admin')).status).toBe(404);
  });
});

describe('author without an author profile', () => {
  it.each(['/api/v1/books', '/api/v1/books/summary', '/api/v1/books/BK001'])('403 on %s', async (url) => {
    const res = await get(url, 'orphan');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('authentication', () => {
  it.each(['/api/v1/books', '/api/v1/books/summary', '/api/v1/books/BK001'])('401 with no token on %s', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
