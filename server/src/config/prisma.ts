import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Long-running Node server => TCP driver (pg) via the Prisma driver adapter, on Neon's pooled URL.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

/** Shared Prisma client. Only repositories (and seed/health ping) should import this. */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();
if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
