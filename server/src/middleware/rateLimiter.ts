import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
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
