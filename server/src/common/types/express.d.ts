import type { AuthUser } from '../jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id set by the requestId middleware. */
      requestId: string;
      /** Set by `authenticate`. Undefined on public routes. */
      user?: AuthUser;
    }
  }
}

export {};
