import type { Request, Response } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { RATE_LIMIT } from '../config/constants';
import { isTest } from '../config/env';
import { RateLimitError } from '../common/errors';
import { sendError } from './errorHandler';

function build(opts: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
    handler: (req: Request, res: Response) => {
      sendError(res, req.requestId, new RateLimitError());
    },
  });
}

/** Applied to the whole API. */
export const globalRateLimiter = build(RATE_LIMIT.global);

/** Stricter limiter for POST /auth/login (wired in Phase 3). */
export const loginRateLimiter = build(RATE_LIMIT.login);

/**
 * Per-user rate limit for POST /tickets.
 * Uses the user id from the Bearer token as the key so switching IPs doesn't reset the window.
 * Falls back to IP if the header is absent (unauthenticated requests are rejected earlier anyway).
 */
export const ticketCreateRateLimiter = rateLimit({
  windowMs: RATE_LIMIT.ticketCreate.windowMs,
  limit: RATE_LIMIT.ticketCreate.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true',
  keyGenerator: (req: Request) => {
    const auth = req.header('authorization') ?? '';
    const token = auth.split(' ')[1];
    // The user id is the JWT subject; extract it cheaply without full verification.
    // Full verification already happened in the `authenticate` middleware.
    if (token) {
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
        if (typeof payload?.sub === 'string') return payload.sub as string;
      } catch {
        // ignore – fall through to IP
      }
    }
    return ipKeyGenerator(req.ip ?? '');
  },
  handler: (req: Request, res: Response) => {
    sendError(res, req.requestId, new RateLimitError('Too many ticket submissions. Please wait before trying again.'));
  },
});
