import { describe, expect, it } from 'vitest';
import { buildMeta, paginated, paginationQuerySchema, toSkipTake } from '../src/common/pagination';

const parse = (q: Record<string, unknown>) => paginationQuerySchema.safeParse(q);

describe('paginationQuerySchema', () => {
  it('defaults to page 1, limit 20', () => {
    expect(parse({})).toMatchObject({ success: true, data: { page: 1, limit: 20 } });
  });

  it('coerces numeric strings (query params are strings)', () => {
    expect(parse({ page: '3', limit: '50' })).toMatchObject({ success: true, data: { page: 3, limit: 50 } });
  });

  it('accepts limit exactly 100 and rejects 101', () => {
    expect(parse({ limit: '100' }).success).toBe(true);
    expect(parse({ limit: '101' }).success).toBe(false);
  });

  it.each([['page', '0'], ['page', '-1'], ['page', 'abc'], ['page', '1.5'], ['limit', '0'], ['limit', '-5'], ['limit', 'x']])(
    'rejects %s=%s',
    (key, value) => {
      expect(parse({ [key]: value }).success).toBe(false);
    },
  );

  it('rejects repeated params (arrays) instead of silently picking one', () => {
    expect(parse({ page: ['1', '2'] }).success).toBe(false);
  });
});

describe('toSkipTake', () => {
  it('computes offsets', () => {
    expect(toSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });
});

describe('buildMeta', () => {
  it('first page of many', () => {
    expect(buildMeta({ page: 1, limit: 1 }, 2)).toEqual({
      page: 1, limit: 1, total: 2, totalPages: 2, hasNext: true, hasPrev: false,
    });
  });

  it('last page', () => {
    expect(buildMeta({ page: 2, limit: 1 }, 2)).toMatchObject({ totalPages: 2, hasNext: false, hasPrev: true });
  });

  it('rounds totalPages up for a partial last page', () => {
    expect(buildMeta({ page: 1, limit: 20 }, 41).totalPages).toBe(3);
    expect(buildMeta({ page: 1, limit: 20 }, 40).totalPages).toBe(2);
  });

  it('no rows: totalPages 0, nothing to navigate to', () => {
    expect(buildMeta({ page: 1, limit: 20 }, 0)).toEqual({
      page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
    });
  });

  it('page beyond the last page: empty data, truthful meta, can go back', () => {
    const r = paginated([], { page: 9, limit: 10 }, 25);
    expect(r.data).toEqual([]);
    expect(r.meta).toEqual({ page: 9, limit: 10, total: 25, totalPages: 3, hasNext: false, hasPrev: true });
  });

  it('a single exact page has no next', () => {
    expect(buildMeta({ page: 1, limit: 20 }, 20)).toMatchObject({ totalPages: 1, hasNext: false });
  });
});
