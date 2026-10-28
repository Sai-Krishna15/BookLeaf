/**
 * Tickets service — business logic + domain event emission.
 * This layer never imports Prisma or socket.io directly.
 * Rules from PROJECT_CONTEXT §7:
 *  - Authors can only operate on their own tickets; another author's ticket is 404, not 403.
 *  - bookId must belong to the calling author (else 404, not 403).
 *  - Admins get the full admin DTO; authors get the author DTO.
 */
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors';
import type { AuthUser } from '../../common/jwt';
import { paginated, buildMeta } from '../../common/pagination';
import { domainEvents } from '../../common/domainEvents';
import {
  toAuthorTicketDto,
  toAdminTicketDto,
  toMessageDto,
  type AuthorTicketDto,
  type AdminTicketDto,
  type MessageDto,
} from './tickets.dto';
import { ticketsRepository } from './tickets.repository';
import type { AdminListQuery, AuthorListQuery, CreateMessageBody, CreateTicketBody } from './tickets.schema';
import type { Paginated } from '../../common/pagination';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Guard: ensure req.user is an author with an authorId. */
function requireAuthorId(user: AuthUser): string {
  if (user.role !== 'AUTHOR' || !user.authorId) {
    throw new ForbiddenError('This action is available to authors only');
  }
  return user.authorId;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const ticketsService = {
  // ---- Create ticket (AUTHOR only) ----------------------------------------

  async create(user: AuthUser, body: CreateTicketBody): Promise<AuthorTicketDto> {
    const authorId = requireAuthorId(user);

    // bookId ownership check: 404 (not 403) for a book that doesn't belong to this author
    if (body.bookId !== null) {
      const book = await ticketsRepository.findBookAuthor(body.bookId);
      if (!book || book.authorId !== authorId) {
        throw new NotFoundError('Book not found');
      }
    }

    const row = await ticketsRepository.create({
      authorId,
      bookId: body.bookId,
      subject: body.subject,
      description: body.description,
      attachments: body.attachments,
    });

    // Seed the conversation thread with the description as the first message
    const msg = await ticketsRepository.createInitialMessage(row.id, user.id, body.description);

    // Emit after both DB writes succeed; a throwing listener must not crash the request
    domainEvents.emit('ticket.created', {
      ticketId: row.id,
      ticketNumber: row.ticketNumber,
      authorId,
    });
    domainEvents.emit('ticket.message.created', {
      ticketId: row.id,
      messageId: msg.id,
      type: 'AUTHOR_MESSAGE',
      senderId: user.id,
    });

    return toAuthorTicketDto(row);
  },

  // ---- List tickets -------------------------------------------------------

  async list(
    user: AuthUser,
    query: AuthorListQuery | AdminListQuery,
  ): Promise<Paginated<AuthorTicketDto | AdminTicketDto>> {
    const now = new Date();

    if (user.role === 'AUTHOR') {
      const authorId = requireAuthorId(user);
      const q = query as AuthorListQuery;
      const { rows, total } = await ticketsRepository.findAuthorPage(authorId, q);
      return paginated(rows.map(toAuthorTicketDto), q, total);
    }

    // ADMIN
    const q = query as AdminListQuery;
    // Resolve "me" to the calling admin's user id
    const resolvedAssigneeId = q.assignedTo === 'me' ? user.id : undefined;
    const { rows, total } = await ticketsRepository.findAdminPage(q, resolvedAssigneeId);
    const meta = buildMeta({ page: q.page, limit: q.limit }, total);
    return { data: rows.map((r) => toAdminTicketDto(r, now)), meta };
  },

  // ---- Get one ticket -----------------------------------------------------

  async getById(user: AuthUser, id: string): Promise<AuthorTicketDto | AdminTicketDto> {
    const row = await ticketsRepository.findById(id);
    const now = new Date();

    if (user.role === 'ADMIN') {
      if (!row) throw new NotFoundError('Ticket not found');
      return toAdminTicketDto(row, now);
    }

    // AUTHOR: 404 for own-not-found AND for another author's ticket (no 403 so ids can't be probed)
    const authorId = requireAuthorId(user);
    if (!row || row.authorId !== authorId) throw new NotFoundError('Ticket not found');
    return toAuthorTicketDto(row);
  },

  // ---- Get messages -------------------------------------------------------

  async getMessages(user: AuthUser, ticketId: string): Promise<MessageDto[]> {
    // Ownership check first (same 404 for missing and other-author's)
    const row = await ticketsRepository.findById(ticketId);
    const isAdmin = user.role === 'ADMIN';

    if (isAdmin) {
      if (!row) throw new NotFoundError('Ticket not found');
    } else {
      const authorId = requireAuthorId(user);
      if (!row || row.authorId !== authorId) throw new NotFoundError('Ticket not found');
    }

    // INTERNAL_NOTE is filtered in the repository query, not here
    const messages = await ticketsRepository.findMessages(ticketId, isAdmin);
    return messages.map((m) => toMessageDto(m, isAdmin));
  },

  // ---- Author follow-up message -------------------------------------------

  async addMessage(user: AuthUser, ticketId: string, body: CreateMessageBody): Promise<MessageDto> {
    const authorId = requireAuthorId(user);

    const row = await ticketsRepository.findById(ticketId);
    if (!row || row.authorId !== authorId) throw new NotFoundError('Ticket not found');

    if (row.status === 'CLOSED') {
      throw new ConflictError('This ticket is closed and no longer accepts messages. Please open a new ticket.');
    }

    // Add the message
    const msg = await ticketsRepository.addAuthorMessage(ticketId, user.id, body.body);
    let reopened = false;

    // Reopen a RESOLVED ticket
    if (row.status === 'RESOLVED') {
      await ticketsRepository.reopenTicket(ticketId);
      reopened = true;
    }

    domainEvents.emit('ticket.message.created', {
      ticketId,
      messageId: msg.id,
      type: 'AUTHOR_MESSAGE',
      senderId: user.id,
    });

    if (reopened) {
      domainEvents.emit('ticket.updated', { ticketId, status: 'OPEN' });
    }

    // Return the message DTO
    // Fetch fresh to get sender relation
    const messages = await ticketsRepository.findMessages(ticketId, false);
    const fresh = messages.find((m) => m.id === msg.id);
    if (!fresh) throw new NotFoundError('Message not found after creation');
    return toMessageDto(fresh, false);
  },
};
