import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { UnauthorizedError } from '../../common/errors';
import type { AuthUser } from '../../common/jwt';
import type { BookIdParam, ListBooksQuery, SummaryQuery } from './books.schema';
import { booksService } from './books.service';

/** `authenticate` guarantees req.user on these routes; this narrows the type defensively. */
const userOf = (req: Request): AuthUser => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const booksController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await booksService.list(userOf(req), req.query as unknown as ListBooksQuery));
  }),

  summary: asyncHandler(async (req: Request, res: Response) => {
    const { authorId } = req.query as unknown as SummaryQuery;
    res.status(200).json(await booksService.summary(userOf(req), authorId));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as BookIdParam;
    res.status(200).json(await booksService.getById(userOf(req), id));
  }),
};
