declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id set by the requestId middleware. */
      requestId: string;
    }
  }
}

export {};
