import type { RequestHandler } from 'express';
import { NotFoundError } from '../common/errors';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl.split('?')[0]} not found`));
};
