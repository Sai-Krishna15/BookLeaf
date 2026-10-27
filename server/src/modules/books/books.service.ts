import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import type { AuthUser } from '../../common/jwt';
import { paginated, toSkipTake } from '../../common/pagination';
import { buildSummary, toBookDto } from './books.dto';
import { booksRepository } from './books.repository';
import type { ListBooksQuery } from './books.schema';

/**
 * Ownership rules live here (PROJECT_CONTEXT §7):
 *  - ADMIN: may read anything, optionally narrowed with ?authorId.
 *  - AUTHOR: always scoped to their own authorId; any ?authorId is ignored.
 *  - AUTHOR without an authorId on the token: 403.
 */
function resolveScope(user: AuthUser, requestedAuthorId?: string): { authorId?: string } {
  if (user.role === 'ADMIN') return requestedAuthorId ? { authorId: requestedAuthorId } : {};
  if (!user.authorId) throw new ForbiddenError('Your account is not linked to an author profile');
  return { authorId: user.authorId };
}

export const booksService = {
  async list(user: AuthUser, query: ListBooksQuery) {
    const { authorId } = resolveScope(user, query.authorId);
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await booksRepository.findPage(authorId, skip, take);
    const now = new Date();
    return paginated(rows.map((r) => toBookDto(r, now)), query, total);
  },

  async getById(user: AuthUser, id: string) {
    const { authorId } = resolveScope(user);
    const row = await booksRepository.findById(id);
    // Same 404 for "does not exist" and "belongs to someone else", so ids cannot be probed.
    if (!row || (authorId !== undefined && row.authorId !== authorId)) throw new NotFoundError('Book not found');
    return toBookDto(row, new Date());
  },

  async summary(user: AuthUser, requestedAuthorId?: string) {
    const { authorId } = resolveScope(user, requestedAuthorId);
    if (!authorId) {
      // Assumption: a portfolio summary only makes sense for one author, so admins must name one.
      throw new ValidationError('authorId query parameter is required for admins', [
        { in: 'query', path: 'authorId', message: 'Required when calling as an admin' },
      ]);
    }
    if (user.role === 'ADMIN' && !(await booksRepository.authorExists(authorId))) {
      throw new NotFoundError('Author not found');
    }
    return buildSummary(await booksRepository.findAllByAuthor(authorId));
  },
};
