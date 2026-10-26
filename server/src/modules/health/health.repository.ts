import { prisma } from '../../config/prisma';

// Generous enough for a cold pooled connection (TCP + TLS + auth) to a remote/serverless DB.
const PING_TIMEOUT_MS = 5000;

export const healthRepository = {
  /** Returns true if a trivial query round-trips within the timeout. Never throws. */
  async pingDatabase(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('db ping timeout')), PING_TIMEOUT_MS);
      });
      await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  },
};
