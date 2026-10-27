import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { booksController } from './books.controller';
import { bookIdParamSchema, listBooksQuerySchema, summaryQuerySchema } from './books.schema';

/** Mounted AFTER the global `authenticate` (see app.ts), so every route here is protected. */
export const booksRouter = Router();

booksRouter.get('/', validate({ query: listBooksQuerySchema }), booksController.list);
// Must be registered BEFORE '/:id', otherwise "summary" would be captured as a book id.
booksRouter.get('/summary', validate({ query: summaryQuerySchema }), booksController.summary);
booksRouter.get('/:id', validate({ params: bookIdParamSchema }), booksController.getById);
