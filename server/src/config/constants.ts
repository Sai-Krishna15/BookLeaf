export const API_PREFIX = '/api/v1';
export const JSON_BODY_LIMIT = '100kb';
export const REQUEST_ID_HEADER = 'x-request-id';

export const RATE_LIMIT = {
  global: { windowMs: 15 * 60 * 1000, max: 300 },
  login: { windowMs: 15 * 60 * 1000, max: 10 },
} as const;

export const PAGINATION = { defaultLimit: 20, maxLimit: 100 } as const;
