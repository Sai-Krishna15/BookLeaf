import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { healthRepository } from '../src/modules/health/health.repository';

describe('GET /api/v1/health database check', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports "connected" when the DB answers', async () => {
    vi.spyOn(healthRepository, 'pingDatabase').mockResolvedValue(true);
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toBe('connected');
  });

  it('reports "unreachable" and degraded status when the DB is down', async () => {
    vi.spyOn(healthRepository, 'pingDatabase').mockResolvedValue(false);
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database).toBe('unreachable');
  });

  it('really queries the configured database', async () => {
    let connected = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await request(createApp()).get('/api/v1/health');
      if (res.body.checks.database === 'connected') {
        connected = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    expect(connected).toBe(true);
  }, 20_000);
});
