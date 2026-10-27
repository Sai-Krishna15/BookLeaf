import { z } from 'zod';
import { PAGINATION } from '../config/constants';

/** Shared query schema for every list endpoint (PROJECT_CONTEXT §5.5): ?page=1&limit=20, limit <= 100. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});

export type PaginationParams = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Prisma-style offset/limit for a validated page. */
export function toSkipTake({ page, limit }: PaginationParams): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

/**
 * Builds the meta block. A page beyond the last one is valid: data is empty and the meta is still
 * truthful (hasNext=false, hasPrev=true so clients can navigate back).
 */
export function buildMeta({ page, limit }: PaginationParams, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit); // 0 when there are no rows
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

export function paginated<T>(data: T[], params: PaginationParams, total: number): Paginated<T> {
  return { data, meta: buildMeta(params, total) };
}
