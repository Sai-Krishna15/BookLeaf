import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

// The limiter is skipped in tests by default; opt in for this file only (read per request, so
// setting it after the static imports above is fine).
process.env.ENABLE_RATE_LIMIT_IN_TESTS = 'true';

describe('login rate limiter', () => {
  it('returns 429 RATE_LIMITED in the standard error shape after 10 attempts', async () => {
    const app = createApp();
    // Invalid bodies fail validation (400) but still count toward the limit, and never touch the DB.
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/v1/auth/login').send({});
      expect(res.status).toBe(400);
    }
    const limited = await request(app).post('/api/v1/auth/login').send({});
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.body.error.requestId).toBeTruthy();
    expect(limited.headers['ratelimit']).toBeDefined();
  });
});
