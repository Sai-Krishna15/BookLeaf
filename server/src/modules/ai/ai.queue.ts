import PQueue from 'p-queue';
import { env } from '../../config/env';

/**
 * Global rate-limiting queue for all LLM calls.
 *
 * Configured per PROJECT_CONTEXT §8.1:
 * - concurrency: 2
 * - intervalCap: env.AI_RPM_LIMIT (e.g. 10 requests per minute)
 * - interval: 60,000ms (1 minute window)
 *
 * Incoming requests in bursts are queued gracefully rather than rejected,
 * protecting free-tier rate limit quotas from being tripped.
 */
export const aiQueue = new PQueue({
  concurrency: 2,
  intervalCap: env.AI_RPM_LIMIT,
  interval: 60_000,
});
