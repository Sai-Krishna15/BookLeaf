/**
 * Tickets repository — the ONLY layer that touches Prisma for tickets.
 *
 * URGENCY SORT APPROACH (PROJECT_CONTEXT §5, §10.6)
 * --------------------------------------------------
 * "Urgency" = unresolved before resolved, then priority CRITICAL→LOW, then oldest first.
 * We cannot express multi-level ordering with dynamic CASE expressions in Prisma's typed
 * findMany because the CASE values mix enum columns and a boolean derived column.
 *
 * Implementation: $queryRawUnsafe to SELECT only the matching ticket ids in the correct
 * order (with LIMIT/OFFSET for the page), then fetch the full rows in a second query using
 * findMany({ where: { id: { in: [...] } } }).  A separate COUNT query feeds pagination meta.
 * The two-query pattern avoids N+1 (the second query is a single IN).
 *
 * The urgency CASE:
 *   status_rank:   OPEN/IN_PROGRESS=1, RESOLVED/CLOSED=2
 *   priority_rank: CRITICAL=1, HIGH=2, MEDIUM=3, LOW=4
 *   then createdAt ASC (oldest first within same group)
 *
 * For non-urgency sorts (newest/oldest) we use a regular Prisma findMany with orderBy.
 */

import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../config/prisma';
import type { AdminListQuery, AuthorListQuery } from './tickets.schema';

// ---------------------------------------------------------------------------
// Column select shapes
// ---------------------------------------------------------------------------

/** All ticket columns needed for author and admin DTOs. */
const TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  authorId: true,
  bookId: true,
  subject: true,
  description: true,
  status: true,
  category: true,
  categorySource: true,
  priority: true,
  prioritySource: true,
  aiStatus: true,
  aiReasoning: true,
  aiError: true,
  needsManualTriage: true,
  assignedToId: true,
  attachments: true,
  firstResponseAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  // Relations
  author: { select: { id: true, name: true, email: true } },
  book: { select: { id: true, title: true } },
  assignee: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
} as const;

export type TicketRow = Prisma.TicketGetPayload<{ select: typeof TICKET_SELECT }>;

/** Message row for GET /:id/messages */
const MESSAGE_SELECT = {
  id: true,
  ticketId: true,
  senderId: true,
  type: true,
  body: true,
  aiAssisted: true,
  createdAt: true,
  sender: { select: { id: true, name: true, role: true } },
} as const;

export type MessageRow = Prisma.TicketMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

// ---------------------------------------------------------------------------
// Build WHERE clause for admin list
// ---------------------------------------------------------------------------

type TicketWhereInput = Prisma.TicketWhereInput;

function buildAdminWhere(q: AdminListQuery, resolvedAssigneeId?: string): TicketWhereInput {
  const where: TicketWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.category) where.category = q.category;
  if (q.priority) where.priority = q.priority;
  if (q.authorId) where.authorId = q.authorId;
  if (q.bookId) where.bookId = q.bookId;
  if (q.needsManualTriage !== undefined) where.needsManualTriage = q.needsManualTriage;

  // assignedTo: me | unassigned | <userId>
  if (q.assignedTo === 'unassigned') {
    where.assignedToId = null;
  } else if (q.assignedTo === 'me' && resolvedAssigneeId) {
    where.assignedToId = resolvedAssigneeId;
  } else if (q.assignedTo && q.assignedTo !== 'me') {
    where.assignedToId = q.assignedTo;
  }

  // Date range (createdAt)
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = q.from;
    if (q.to) {
      // "to" is start of day; include the whole day by advancing by 1 day
      const toEnd = new Date(q.to);
      toEnd.setUTCDate(toEnd.getUTCDate() + 1);
      where.createdAt.lt = toEnd;
    }
  }

  // Text search: subject, description, or ticket number (e.g. "BL-1003" or "1003")
  if (q.q) {
    const raw = q.q.trim();
    // Extract numeric part from "BL-1003" or "1003"
    const numMatch = raw.replace(/^BL-/i, '');
    const numericSearch = /^\d+$/.test(numMatch) ? parseInt(numMatch, 10) : null;

    const orClauses: TicketWhereInput[] = [
      { subject: { contains: raw, mode: 'insensitive' } },
      { description: { contains: raw, mode: 'insensitive' } },
    ];
    if (numericSearch !== null) {
      orClauses.push({ ticketNumber: numericSearch });
    }
    where.OR = orClauses;
  }

  return where;
}

// ---------------------------------------------------------------------------
// Urgency sort: raw SQL ids + count, then full row fetch
// ---------------------------------------------------------------------------

/**
 * Returns ordered ticket ids for one page using a SQL CASE expression for urgency.
 * Also returns the total count of matching tickets.
 */
async function findUrgencyPage(
  where: TicketWhereInput,
  skip: number,
  take: number,
): Promise<{ ids: string[]; total: number }> {
  // Build the Prisma WHERE into a raw fragment. We use Prisma's count for correctness
  // and $queryRaw only for the ordered ids.
  const total = await prisma.ticket.count({ where });
  if (total === 0) return { ids: [], total: 0 };

  // Convert the Prisma WHERE into something we can use with $queryRaw.
  // Strategy: materialize all matching ids with Prisma first (single query returning only id),
  // then apply the CASE sort in SQL on that subset.
  // For large datasets a real implementation would push the filter into the raw SQL; for this
  // project's scale (hundreds of tickets) the id-list approach is fine and keeps type safety.
  const matchingIds = await prisma.ticket.findMany({
    where,
    select: { id: true },
  });

  if (matchingIds.length === 0) return { ids: [], total: 0 };

  const idList = matchingIds.map((r) => r.id);

  // Use tagged template to keep the id array safe
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Ticket"
    WHERE id = ANY(${idList}::text[])
    ORDER BY
      CASE status
        WHEN 'OPEN'        THEN 1
        WHEN 'IN_PROGRESS' THEN 1
        WHEN 'RESOLVED'    THEN 2
        WHEN 'CLOSED'      THEN 2
        ELSE 3
      END ASC,
      CASE priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH'     THEN 2
        WHEN 'MEDIUM'   THEN 3
        WHEN 'LOW'      THEN 4
        ELSE 5
      END ASC,
      "createdAt" ASC
    LIMIT ${take} OFFSET ${skip}
  `;

  return { ids: rows.map((r) => r.id), total };
}

// ---------------------------------------------------------------------------
// Repository API
// ---------------------------------------------------------------------------

export const ticketsRepository = {
  // ---- Creation -----------------------------------------------------------

  async create(data: {
    authorId: string;
    bookId: string | null;
    subject: string;
    description: string;
    attachments: unknown;
  }) {
    return prisma.ticket.create({
      data: {
        authorId: data.authorId,
        bookId: data.bookId,
        subject: data.subject,
        description: data.description,
        attachments: data.attachments as Prisma.InputJsonValue,
        status: 'OPEN',
        aiStatus: 'PENDING',
        priority: 'MEDIUM',
        // category/priority will be set by AI job in Phase 8
      },
      select: TICKET_SELECT,
    });
  },

  // Also create the initial AUTHOR_MESSAGE (the description as first thread entry)
  async createInitialMessage(ticketId: string, senderId: string, body: string) {
    return prisma.ticketMessage.create({
      data: { ticketId, senderId, type: 'AUTHOR_MESSAGE', body },
      select: { id: true },
    });
  },

  // ---- Author list --------------------------------------------------------

  async findAuthorPage(authorId: string, q: AuthorListQuery) {
    const where: TicketWhereInput = { authorId };
    if (q.status) where.status = q.status;
    if (q.q) {
      const raw = q.q.trim();
      const numMatch = raw.replace(/^BL-/i, '');
      const numericSearch = /^\d+$/.test(numMatch) ? parseInt(numMatch, 10) : null;
      const orClauses: TicketWhereInput[] = [
        { subject: { contains: raw, mode: 'insensitive' } },
        { description: { contains: raw, mode: 'insensitive' } },
      ];
      if (numericSearch !== null) orClauses.push({ ticketNumber: numericSearch });
      where.OR = orClauses;
    }

    const orderBy: Prisma.TicketOrderByWithRelationInput =
      q.sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };

    const skip = (q.page - 1) * q.limit;
    const take = q.limit;

    const [rows, total] = await prisma.$transaction([
      prisma.ticket.findMany({ where, select: TICKET_SELECT, orderBy, skip, take }),
      prisma.ticket.count({ where }),
    ]);
    return { rows, total };
  },

  // ---- Admin list ---------------------------------------------------------

  async findAdminPage(q: AdminListQuery, resolvedAssigneeId?: string) {
    const where = buildAdminWhere(q, resolvedAssigneeId);
    const skip = (q.page - 1) * q.limit;
    const take = q.limit;

    if (q.sort === 'urgency') {
      const { ids, total } = await findUrgencyPage(where, skip, take);
      if (ids.length === 0) return { rows: [] as TicketRow[], total };
      // Fetch full rows in one IN query, then re-sort in JS to match id order
      const unordered = await prisma.ticket.findMany({
        where: { id: { in: ids } },
        select: TICKET_SELECT,
      });
      const byId = new Map(unordered.map((r) => [r.id, r]));
      const rows = ids.map((id) => byId.get(id)!);
      return { rows, total };
    }

    const orderBy: Prisma.TicketOrderByWithRelationInput =
      q.sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' };

    const [rows, total] = await prisma.$transaction([
      prisma.ticket.findMany({ where, select: TICKET_SELECT, orderBy, skip, take }),
      prisma.ticket.count({ where }),
    ]);
    return { rows, total };
  },

  // ---- Single ticket ------------------------------------------------------

  findById(id: string) {
    return prisma.ticket.findUnique({ where: { id }, select: TICKET_SELECT });
  },

  // ---- Messages -----------------------------------------------------------

  /** Messages for a ticket. Authors receive only AUTHOR_MESSAGE and ADMIN_REPLY (not INTERNAL_NOTE). */
  findMessages(ticketId: string, includeInternalNotes: boolean) {
    const where: Prisma.TicketMessageWhereInput = { ticketId };
    if (!includeInternalNotes) {
      where.type = { not: 'INTERNAL_NOTE' };
    }
    return prisma.ticketMessage.findMany({
      where,
      select: MESSAGE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  },

  // ---- Follow-up message + reopen -----------------------------------------

  async addAuthorMessage(ticketId: string, senderId: string, body: string) {
    return prisma.ticketMessage.create({
      data: { ticketId, senderId, type: 'AUTHOR_MESSAGE', body },
      select: { id: true, ticketId: true, type: true, senderId: true },
    });
  },

  async reopenTicket(ticketId: string) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'OPEN', resolvedAt: null },
      select: { id: true, status: true },
    });
  },

  // ---- Guards -------------------------------------------------------------

  /** Returns the bookId-to-authorId mapping so the service can validate ownership. */
  async findBookAuthor(bookId: string): Promise<{ authorId: string } | null> {
    return prisma.book.findUnique({ where: { id: bookId }, select: { authorId: true } });
  },
};
