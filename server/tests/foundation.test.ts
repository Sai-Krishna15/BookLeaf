import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { asyncHandler } from '../src/common/asyncHandler';
import { signAccessToken } from '../src/common/jwt';
import { ConflictError, ForbiddenError } from '../src/common/errors';
import { errorHandler } from '../src/middleware/errorHandler';
import { notFound } from '../src/middleware/notFound';
import { requestId } from '../src/middleware/requestId';
import { validate } from '../src/middleware/validate';

describe('GET /api/v1/health', () => {
  it('returns 200 with status and AI mode, plus a request id header', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.ai.mode).toBe('manual_fallback');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a valid inbound x-request-id', async () => {
    const res = await request(createApp()).get('/api/v1/health').set('x-request-id', 'abc-12345678');
    expect(res.headers['x-request-id']).toBe('abc-12345678');
  });
});

describe('standard error shape', () => {
  it('unknown routes -> 404 NOT_FOUND with requestId (for an authenticated caller)', async () => {
    const token = signAccessToken({ id: 'u1', role: 'ADMIN', authorId: null });
    const res = await request(createApp()).get('/api/v1/nope').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('unknown routes without a token -> 401 (protected by default, no route probing)', async () => {
    const res = await request(createApp()).get('/api/v1/nope');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('malformed JSON -> 400 VALIDATION_ERROR', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/anything')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Mini app reusing the real middleware to exercise error paths.
  const buildApp = () => {
    const app = express();
    app.use(requestId, express.json());
    app.post(
      '/validate',
      validate({
        body: z.object({ subject: z.string().min(5).max(150) }),
        query: z.object({ limit: z.coerce.number().int().max(100).default(20) }),
      }),
      (req, res) => {
        res.json({ body: req.body, query: req.query });
      },
    );
    app.get('/forbidden', (_req, _res, next) => next(new ForbiddenError()));
    app.get('/conflict', (_req, _res, next) => next(new ConflictError('dup')));
    app.get('/prisma-dup', (_req, _res, next) =>
      next(Object.assign(new Error('x'), { name: 'PrismaClientKnownRequestError', code: 'P2002' })),
    );
    app.get('/prisma-missing', (_req, _res, next) =>
      next(Object.assign(new Error('x'), { name: 'PrismaClientKnownRequestError', code: 'P2025' })),
    );
    app.get(
      '/boom',
      asyncHandler(async () => {
        throw new Error('secret internals: password=hunter2');
      }),
    );
    app.use(notFound, errorHandler);
    return app;
  };

  it('validate: bad body -> 400 with details', async () => {
    const res = await request(buildApp()).post('/validate').send({ subject: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0]).toMatchObject({ in: 'body', path: 'subject' });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('validate: coerces query and applies defaults', async () => {
    const res = await request(buildApp()).post('/validate?limit=50').send({ subject: 'valid subject' });
    expect(res.status).toBe(200);
    expect(res.body.query.limit).toBe(50);
    const over = await request(buildApp()).post('/validate?limit=500').send({ subject: 'valid subject' });
    expect(over.status).toBe(400);
  });

  it('maps AppError subclasses and Prisma errors', async () => {
    const app = buildApp();
    expect((await request(app).get('/forbidden')).body.error.code).toBe('FORBIDDEN');
    expect((await request(app).get('/conflict')).status).toBe(409);
    expect((await request(app).get('/prisma-dup')).status).toBe(409);
    expect((await request(app).get('/prisma-missing')).status).toBe(404);
  });

  it('unknown errors -> sanitized 500, no leaked message', async () => {
    const res = await request(buildApp()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(res.body.error.requestId).toBeTruthy();
  });
});
