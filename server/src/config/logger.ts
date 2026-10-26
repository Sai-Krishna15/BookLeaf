import pino from 'pino';
import { env, isProduction, isTest } from './env';

/** Paths that must never reach the logs (secrets, credentials, tokens). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.apiKey',
  'password',
  'token',
];

export const logger = pino({
  level: isTest ? 'silent' : isProduction ? 'info' : 'debug',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  ...(isProduction || isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
  base: { env: env.NODE_ENV },
});
