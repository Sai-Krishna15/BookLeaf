import { z } from 'zod';
import { paginationQuerySchema } from '../../common/pagination';

const authorIdParam = z.string().trim().min(1).max(50);

/** AUTHOR callers: `authorId` is accepted but ignored (always scoped to their own). */
export const listBooksQuerySchema = paginationQuerySchema.extend({
  authorId: authorIdParam.optional(),
});
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

export const summaryQuerySchema = z.object({
  authorId: authorIdParam.optional(),
});
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

export const bookIdParamSchema = z.object({
  id: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, 'Invalid book id'),
});
export type BookIdParam = z.infer<typeof bookIdParamSchema>;
