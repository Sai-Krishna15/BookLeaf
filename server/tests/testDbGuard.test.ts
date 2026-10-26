import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabase, databaseIdentity, toDirectUrl } from '../scripts/test-db';

const MAIN = 'postgresql://u:p@ep-main-abc-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
const TEST = 'postgresql://u:p@ep-test-xyz-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

describe('test database guard', () => {
  it('aborts with a clear message when DATABASE_URL_TEST is missing', () => {
    expect(() => assertSafeTestDatabase(undefined, MAIN)).toThrow(/DATABASE_URL_TEST is not set/);
    expect(() => assertSafeTestDatabase('', MAIN)).toThrow(/DATABASE_URL_TEST is not set/);
  });

  it('aborts when it is identical to DATABASE_URL, even via the pooled/direct host variant', () => {
    expect(() => assertSafeTestDatabase(MAIN, MAIN)).toThrow(/same database as DATABASE_URL/);
    expect(() => assertSafeTestDatabase(toDirectUrl(MAIN), MAIN)).toThrow(/same database/);
  });

  it('aborts on an invalid URL, and accepts a genuinely different database', () => {
    expect(() => assertSafeTestDatabase('not a url', MAIN)).toThrow(/not a valid URL/);
    expect(assertSafeTestDatabase(TEST, MAIN)).toBe(TEST);
  });

  it('derives the direct URL and identity by stripping -pooler', () => {
    expect(new URL(toDirectUrl(TEST)).hostname).toBe('ep-test-xyz.c-7.us-east-2.aws.neon.tech');
    expect(databaseIdentity(TEST)).toBe('ep-test-xyz.c-7.us-east-2.aws.neon.tech:5432/neondb');
  });

  it('the running suite really is pointed at the test database, not the main one', () => {
    expect(process.env.DATABASE_URL).toBe(process.env.DATABASE_URL_TEST);
    expect(process.env.MAIN_DATABASE_URL_SNAPSHOT).not.toBe(process.env.DATABASE_URL);
  });
});
