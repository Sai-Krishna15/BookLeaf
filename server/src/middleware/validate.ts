import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../common/errors';

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Validates body/params/query with Zod and replaces them with the parsed (coerced) values.
 * Express 5 exposes req.query/req.params as getters, so we redefine them on the request.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    const details: { in: string; path: string; message: string }[] = [];

    for (const key of ['body', 'params', 'query'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true });
      } else {
        for (const issue of result.error.issues) {
          details.push({ in: key, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) return next(new ValidationError('Invalid request data', details));
    next();
  };
