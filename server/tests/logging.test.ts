import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { REDACT_PATHS } from '../src/config/logger';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const logger = pino({ level: 'info', redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { lines, logger };
}

describe('log redaction', () => {
  it('redacts passwords, tokens and auth headers wherever the configured paths apply', () => {
    const { lines, logger } = capture();
    logger.info({
      req: {
        headers: { authorization: 'Bearer SECRET.JWT.VALUE', cookie: 'sid=SECRETCOOKIE' },
        body: { email: 'a@b.com', password: 'SECRETPASS', token: 'SECRETTOKEN' },
      },
      body: { password: 'SECRETPASS2' },
      user: { passwordHash: '$2a$10$SECRETHASH', password: 'SECRETPASS3' },
      password: 'SECRETPASS4',
      token: 'SECRETTOKEN2',
    });
    const out = lines.join('');
    for (const secret of ['SECRET.JWT.VALUE', 'SECRETCOOKIE', 'SECRETPASS', 'SECRETTOKEN', 'SECRETHASH']) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('a@b.com'); // non-secret fields are still logged
  });

  it('a real login request logged through pino-http never contains the password or token', async () => {
    const { lines, logger } = capture();
    const app = express();
    app.use(
      pinoHttp({
        logger,
        // Same serializer policy as src/app.ts: only method/url, never headers or bodies.
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      }),
    );
    app.use(express.json());
    app.post('/login', (req, res) => {
      // Worst case: application code logs the body itself. Redaction must still hold.
      (req as unknown as { log: pino.Logger }).log.info({ req: { body: req.body } }, 'login attempt');
      res.json({ token: 'SECRETTOKEN' });
    });

    await request(app)
      .post('/login')
      .set('Authorization', 'Bearer SECRET.JWT.VALUE')
      .send({ email: 'a@b.com', password: 'SECRETPASS' });

    const out = lines.join('');
    expect(out).toContain('login attempt');
    expect(out).not.toContain('SECRETPASS');
    expect(out).not.toContain('SECRET.JWT.VALUE');
  });
});
