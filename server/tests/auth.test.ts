import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { signAccessToken, verifyAccessToken } from '../src/common/jwt';
import { env } from '../src/config/env';
import { authenticate } from '../src/middleware/authenticate';
import { errorHandler } from '../src/middleware/errorHandler';
import { requestId } from '../src/middleware/requestId';
import { requireRole } from '../src/middleware/requireRole';

const app = createApp();
const AUTHOR = { email: 'priya.sharma@email.com', password: 'Test@1234' };
const ADMIN = { email: 'admin@bookleaf.com', password: 'Admin@1234' };

const login = (body: unknown) => request(app).post('/api/v1/auth/login').send(body as object);
const bodyText = (res: { body: unknown }) => JSON.stringify(res.body);

async function tokenFor(creds: { email: string; password: string }): Promise<string> {
  const res = await login(creds);
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe('POST /auth/login', () => {
  it('logs an author in: {token, user} with an allow-listed user and a minimal JWT', async () => {
    const res = await login(AUTHOR);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['token', 'user']);
    expect(Object.keys(res.body.user).sort()).toEqual(['authorId', 'email', 'id', 'name', 'role']);
    expect(res.body.user).toMatchObject({ email: AUTHOR.email, name: 'Priya Sharma', role: 'AUTHOR', authorId: 'AUTH001' });

    const claims = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(Object.keys(claims).sort()).toEqual(['authorId', 'exp', 'iat', 'role', 'sub']);
    expect(claims.sub).toBe(res.body.user.id);
    expect(verifyAccessToken(res.body.token)).toEqual({ id: res.body.user.id, role: 'AUTHOR', authorId: 'AUTH001' });
  });

  it('logs an admin in (authorId is null)', async () => {
    const res = await login(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: ADMIN.email, role: 'ADMIN', authorId: null });
    expect(verifyAccessToken(res.body.token).role).toBe('ADMIN');
  });

  it('normalizes email (trim + lowercase)', async () => {
    const res = await login({ email: '  Priya.Sharma@EMAIL.com ', password: AUTHOR.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(AUTHOR.email);
  });

  it('wrong password and unknown email give identical 401 responses (no enumeration)', async () => {
    const wrongPassword = await login({ email: AUTHOR.email, password: 'nope-nope' });
    const unknownEmail = await login({ email: 'nobody@nowhere.com', password: 'nope-nope' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
    expect(wrongPassword.body.error.message).toBe('Invalid email or password');
    // Identical apart from the per-request id.
    const strip = (b: { error: Record<string, unknown> }) => ({ ...b.error, requestId: undefined });
    expect(strip(unknownEmail.body)).toEqual(strip(wrongPassword.body));
    expect(wrongPassword.body.error.requestId).toBeTruthy();
  });

  it.each([
    ['missing password', { email: AUTHOR.email }],
    ['missing email', { password: 'x' }],
    ['invalid email', { email: 'not-an-email', password: 'x' }],
    ['empty password', { email: AUTHOR.email, password: '' }],
    ['non-string password', { email: AUTHOR.email, password: 12345 }],
    ['empty body', {}],
  ])('rejects invalid body (%s) with 400 in the standard error shape', async (_name, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.error.message).toBe('string');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.requestId).toBeTruthy();
  });
});

describe('GET /auth/me', () => {
  it('401 UNAUTHORIZED with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it.each([
    ['wrong scheme', 'Basic abc'],
    ['no token after Bearer', 'Bearer'],
    ['extra segments', 'Bearer a b'],
    ['garbage token', 'Bearer not.a.jwt'],
  ])('401 for malformed/bad Authorization (%s)', async (_n, header) => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', header);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 for an expired token', async () => {
    const expired = jwt.sign({ role: 'ADMIN' }, env.JWT_SECRET, { subject: 'u1', expiresIn: -10 });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Token expired');
  });

  it('401 for a token signed with the wrong secret, and for an unsigned (alg=none) token', async () => {
    const forged = jwt.sign({ role: 'ADMIN' }, 'some-other-secret-some-other-secret-1', { subject: 'u1' });
    const none = jwt.sign({ role: 'ADMIN' }, '', { subject: 'u1', algorithm: 'none' });
    for (const t of [forged, none]) {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(401);
    }
  });

  it('returns the user plus author profile for an author', async () => {
    const token = await tokenFor(AUTHOR);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: AUTHOR.email, role: 'AUTHOR', authorId: 'AUTH001' });
    expect(res.body.author).toMatchObject({ id: 'AUTH001', name: 'Priya Sharma', city: 'Mumbai' });
  });

  it('returns author: null for an admin', async () => {
    const token = await tokenFor(ADMIN);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.author).toBeNull();
  });

  it('401 when the token is valid but the account no longer exists', async () => {
    const ghost = signAccessToken({ id: 'does-not-exist', role: 'AUTHOR', authorId: 'AUTH001' });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${ghost}`);
    expect(res.status).toBe(401);
  });
});

describe('passwordHash never leaks', () => {
  it('appears in no auth response (success or failure)', async () => {
    const authorToken = await tokenFor(AUTHOR);
    const responses = [
      await login(AUTHOR),
      await login(ADMIN),
      await login({ email: AUTHOR.email, password: 'wrong' }),
      await login({}),
      await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${authorToken}`),
      await request(app).get('/api/v1/auth/me'),
    ];
    for (const res of responses) {
      const text = bodyText(res);
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('$2a$');
      expect(text).not.toContain('$2b$');
    }
  });
});

describe('requireRole', () => {
  // A throwaway admin-only route, standing in for the Phase 6 /admin/* routers.
  const guarded = express();
  guarded.use(requestId, authenticate);
  guarded.get('/admin-only', requireRole('ADMIN'), (req, res) => res.json({ ok: true, user: req.user }));
  guarded.get('/either', requireRole('ADMIN', 'AUTHOR'), (_req, res) => res.json({ ok: true }));
  guarded.use(errorHandler);

  it('403 FORBIDDEN for an author, 200 for an admin', async () => {
    const authorToken = await tokenFor(AUTHOR);
    const adminToken = await tokenFor(ADMIN);

    const denied = await request(guarded).get('/admin-only').set('Authorization', `Bearer ${authorToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    expect(denied.body.error.requestId).toBeTruthy();

    const allowed = await request(guarded).get('/admin-only').set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.user.role).toBe('ADMIN');
  });

  it('401 (not 403) when unauthenticated, and accepts any listed role', async () => {
    expect((await request(guarded).get('/admin-only')).status).toBe(401);
    const authorToken = await tokenFor(AUTHOR);
    expect((await request(guarded).get('/either').set('Authorization', `Bearer ${authorToken}`)).status).toBe(200);
  });
});

describe('public vs protected', () => {
  it('/health is public', async () => {
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });
});
