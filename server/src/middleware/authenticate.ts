import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../common/errors';
import { verifyAccessToken } from '../common/jwt';

/**
 * Requires `Authorization: Bearer <jwt>`. Stateless: identity comes from verified claims.
 * 401 UNAUTHORIZED for missing, malformed, tampered or expired tokens.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header) return next(new UnauthorizedError('Authentication required'));

  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return next(new UnauthorizedError('Malformed Authorization header, expected "Bearer <token>"'));
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};
