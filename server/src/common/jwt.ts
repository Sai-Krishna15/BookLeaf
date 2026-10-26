import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { UnauthorizedError } from './errors';
import { env } from '../config/env';
import type { Role } from '../generated/prisma/client';

/** The identity attached to req.user (and to Socket.IO sockets in Phase 7). */
export interface AuthUser {
  id: string;
  role: Role;
  authorId: string | null;
}

const ALGORITHM = 'HS256' as const;

/** Claims are deliberately minimal: sub (user id), role, authorId. No PII. */
const claimsSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(['AUTHOR', 'ADMIN']),
  authorId: z.string().min(1).nullish(),
});

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { role: user.role, ...(user.authorId ? { authorId: user.authorId } : {}) },
    env.JWT_SECRET,
    {
      subject: user.id,
      algorithm: ALGORITHM,
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    },
  );
}

/**
 * Single verification entry point, shared by the HTTP `authenticate` middleware and the
 * Socket.IO handshake. Pins the algorithm (rejects `alg: none` / algorithm confusion) and
 * throws UnauthorizedError for missing, malformed, tampered or expired tokens.
 */
export function verifyAccessToken(token: string): AuthUser {
  let payload: unknown;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new UnauthorizedError('Token expired');
    throw new UnauthorizedError('Invalid token');
  }
  const parsed = claimsSchema.safeParse(payload);
  if (!parsed.success) throw new UnauthorizedError('Invalid token');
  return { id: parsed.data.sub, role: parsed.data.role, authorId: parsed.data.authorId ?? null };
}
