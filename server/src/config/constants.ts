export const API_PREFIX = '/api/v1';
export const JSON_BODY_LIMIT = '100kb';
export const REQUEST_ID_HEADER = 'x-request-id';

export const RATE_LIMIT = {
  global: { windowMs: 15 * 60 * 1000, max: 300 },
  login: { windowMs: 15 * 60 * 1000, max: 10 },
} as const;

export const PAGINATION = { defaultLimit: 20, maxLimit: 100 } as const;

/** KB rule: royalties below this accumulated amount are not paid out; they roll over to the next quarter. */
export const PAYOUT_THRESHOLD = 1000;
/** KB rule: royalties for a quarter are paid within 45 days of the quarter end. */
export const PAYOUT_DEADLINE_DAYS = 45;
