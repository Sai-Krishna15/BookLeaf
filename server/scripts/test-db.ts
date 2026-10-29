/* Test database safety + preparation.
 *
 * Used by (a) Vitest globalSetup, (b) tests/setup.ts and (c) `npm run db:test:setup`.
 * Guarantees tests only ever run against DATABASE_URL_TEST, which must be a different database
 * from DATABASE_URL.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { runSeed } from '../prisma/seed';

/** host (Neon "-pooler" stripped) + db name: identifies the physical database behind a URL. */
export function databaseIdentity(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace('-pooler', '')}:${u.port || '5432'}${u.pathname}`;
}

/** Direct (non-pooled) variant of a Neon URL, for migrations. Other hosts are returned unchanged. */
export function toDirectUrl(url: string): string {
  const u = new URL(url);
  u.hostname = u.hostname.replace('-pooler', '');
  return u.toString();
}

export function assertSafeTestDatabase(testUrl: string | undefined, mainUrl: string | undefined): string {
  if (!testUrl) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Tests must run against a dedicated test database (e.g. a Neon "test" branch). ' +
        'Add DATABASE_URL_TEST to server/.env. Aborting so the main database is never touched.',
    );
  }
  let testId: string;
  try {
    testId = databaseIdentity(testUrl);
  } catch {
    throw new Error('DATABASE_URL_TEST is not a valid URL. Aborting.');
  }
  if (mainUrl && databaseIdentity(mainUrl) === testId) {
    throw new Error(
      'DATABASE_URL_TEST points at the same database as DATABASE_URL. Refusing to run tests against the main database.',
    );
  }
  return testUrl;
}

/** The original (non-test) DATABASE_URL, captured once so repeated calls in a reused worker stay correct. */
export function mainDatabaseUrl(): string | undefined {
  process.env.MAIN_DATABASE_URL_SNAPSHOT ??= process.env.DATABASE_URL;
  return process.env.MAIN_DATABASE_URL_SNAPSHOT;
}

/** Runs a prisma CLI command against the (already guarded) test database; surfaces stderr as text. */
function prisma_cli(args: string[], direct: string): void {
  try {
    execFileSync('npx', ['tsx', './node_modules/prisma/build/index.js', ...args], {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: direct, DATABASE_URL_UNPOOLED: direct },
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    const out = `${e.stderr?.toString() ?? ''}${e.stdout?.toString() ?? ''}`.trim();
    throw new Error(
      `prisma ${args.join(' ')} failed on the TEST database:\n${out}\n` +
        'If the test branch has a stale schema, run `npm run db:test:reset` (safe: test database only).',
    );
  }
}

/** Retries an async operation up to `maxAttempts` times on transient Neon ETIMEDOUT errors. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5, delayMs = 3000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string })?.code;
      // Retry on Neon cold-start timeouts and connection resets
      const isTransient =
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        (err instanceof Error &&
          (err.message.includes('ETIMEDOUT') ||
            err.message.includes('timeout') ||
            err.message.includes('Connection terminated')));
      if (!isTransient || attempt === maxAttempts) throw err;
      await new Promise((res) => setTimeout(res, delayMs * attempt));
    }
  }
  throw lastErr;
}

/** Applies migrations and seeds the test database. Idempotent. `reset` drops everything first. */
export async function prepareTestDatabase(log: (m: string) => void = () => {}, opts: { reset?: boolean } = {}): Promise<void> {
  const testUrl = assertSafeTestDatabase(process.env.DATABASE_URL_TEST, mainDatabaseUrl());
  const direct = toDirectUrl(testUrl);

  if (opts.reset) {
    log('resetting test database (drop + re-migrate)');
    prisma_cli(['migrate', 'reset', '--force', '--skip-seed'], direct);
  } else {
    log('applying migrations to test database');
    prisma_cli(['migrate', 'deploy'], direct);
  }

  log('seeding test database');
  // Wrapped in withRetry to handle Neon serverless cold-start ETIMEDOUT errors.
  await withRetry(async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    try {
      await runSeed(prisma, log);
    } finally {
      await prisma.$disconnect();
    }
  });
}

if (require.main === module) {
  prepareTestDatabase((m) => console.log(`[test-db] ${m}`), { reset: process.argv.includes('--reset') })
    .then(() => console.log('[test-db] ready'))
    .catch((err: unknown) => {
      console.error(`[test-db] ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
