import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Long-running Node server => TCP driver (pg) via the Prisma driver adapter, on Neon's pooled URL.
  // We configure a connectionTimeoutMillis and idle error handler so Neon cold starts and wakeups don't crash requests.
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    max: 10,
  });

  pool.on('error', (err) => {
    logger.warn({ err: err.message }, 'Unexpected idle pg client error on pool (Neon wake/reconnect)');
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/** Shared Prisma client. Only repositories (and seed/health ping) should import this. */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();
if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
