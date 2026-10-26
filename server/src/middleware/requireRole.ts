import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors';
import type { Role } from '../generated/prisma/client';

/** Must run after `authenticate`. 403 FORBIDDEN unless req.user.role is one of `roles`. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    // Defensive: reaching here without req.user means a route was wired without authenticate.
    if (!req.user) return next(new UnauthorizedError('Authentication required'));
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
