import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../common/errors';
import { isProduction } from '../config/env';
import { logger } from '../config/logger';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown[];
    requestId: string;
  };
}

/** Writes the standard error shape (PROJECT_CONTEXT §5.3). */
export function sendError(res: Response, requestId: string, err: AppError): void {
  const body: ErrorBody = {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      requestId,
    },
  };
  res.status(err.status).json(body);
}

/** Duck-typed Prisma error check so we don't depend on @prisma/client before Phase 2. */
function isPrismaKnownError(err: unknown): err is { code: string; meta?: { target?: unknown } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'PrismaClientKnownRequestError' &&
    typeof (err as { code?: unknown }).code === 'string'
  );
}

function normalize(err: unknown): AppError | null {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new ValidationError(
      'Invalid request data',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }

  if (isPrismaKnownError(err)) {
    if (err.code === 'P2002') return new ConflictError('A record with these values already exists');
    if (err.code === 'P2025') return new NotFoundError();
  }

  // body-parser errors (malformed JSON, payload too large)
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return new ValidationError('Malformed JSON body');
  if (e?.type === 'entity.too.large') {
    return new AppError('VALIDATION_ERROR', 'Request body too large', 413);
  }

  return null;
}

// Express requires the 4-arg signature to treat this as an error handler.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const known = normalize(err);

  if (known) {
    if (known.status >= 500) logger.error({ err, requestId: req.requestId }, 'Handled server error');
    return sendError(res, req.requestId, known);
  }

  // Unknown: log everything, expose nothing.
  logger.error({ err, requestId: req.requestId, path: req.path, method: req.method }, 'Unhandled error');
  const body: ErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Something went wrong. Please try again later.' : 'Internal server error',
      requestId: req.requestId,
    },
  };
  res.status(500).json(body);
};
