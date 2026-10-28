/**
 * Admin repository — the ONLY layer that imports Prisma for admin operations.
 *
 * CONCURRENCY APPROACH:
 * ---------------------
 * All ticket updates use targeted prisma.ticket.update() that sets ONLY the
 * fields provided. This is a single atomic SQL UPDATE with no prior read of the
 * full row for the update itself. Two admins acting on different fields
 * simultaneously will both succeed without overwriting each other's changes.
 *
 * For admin replies, prisma.$transaction([...]) atomically writes the message,
 * updates firstResponseAt, and optionally moves status OPEN→IN_PROGRESS in one
 * commit — so the ticket state is always consistent with the message thread.
 */

import { prisma } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { SLA_HOURS } from '../../common/sla';
import { TICKET_SELECT, MESSAGE_SELECT } from '../tickets/tickets.repository';

export type { TicketRow, MessageRow } from '../tickets/tickets.repository';

// Re-export for convenience inside this module
import type { TicketRow, MessageRow } from '../tickets/tickets.repository';

// ---------------------------------------------------------------------------
// Patch data type for the service layer to use (no Prisma import needed in service)
// ---------------------------------------------------------------------------

export type TicketPatchData = Prisma.TicketUncheckedUpdateInput;

// ---------------------------------------------------------------------------
// AdminStats type
// ---------------------------------------------------------------------------

export interface AdminStats {
  total: number;
  byStatus: { OPEN: number; IN_PROGRESS: number; RESOLVED: number; CLOSED: number };
  byPriority: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number }; // unresolved only
  unassigned: number;    // unresolved and no assignee
  overdue: number;       // unresolved, no firstResponseAt, past SLA
  needsManualTriage: number; // unresolved
  avgFirstResponseHours: number | null;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const adminRepository = {
  // ---- Find ticket --------------------------------------------------------

  findById(id: string): Promise<TicketRow | null> {
    return prisma.ticket.findUnique({ where: { id }, select: TICKET_SELECT });
  },

  // ---- Patch ticket (targeted update — only changed fields) ---------------

  patchTicket(id: string, data: Prisma.TicketUncheckedUpdateInput): Promise<TicketRow> {
    return prisma.ticket.update({ where: { id }, data, select: TICKET_SELECT });
  },

  // ---- Assign ticket to a user -------------------------------------------

  assignTicket(id: string, userId: string): Promise<TicketRow> {
    return prisma.ticket.update({
      where: { id },
      data: { assignedToId: userId },
      select: TICKET_SELECT,
    });
  },

  // ---- Create internal note ----------------------------------------------

  async createNote(ticketId: string, senderId: string, body: string): Promise<MessageRow> {
    return prisma.ticketMessage.create({
      data: { ticketId, senderId, type: 'INTERNAL_NOTE', body },
      select: MESSAGE_SELECT,
    });
  },

  // ---- Admin reply transaction --------------------------------------------

  /**
   * Atomically:
   *  1. Creates the ADMIN_REPLY message (optionally marks it aiAssisted if draftId provided).
   *  2. Sets firstResponseAt on the ticket if setFirstResponseAt=true.
   *  3. Moves ticket status OPEN→IN_PROGRESS if moveToInProgress=true.
   *
   * Uses prisma.$transaction([...]) — one atomic commit.
   */
  async adminReplyTx(params: {
    ticketId: string;
    senderId: string;
    body: string;
    draftId?: string;
    setFirstResponseAt: boolean;
    moveToInProgress: boolean;
  }): Promise<{ message: MessageRow; ticket: TicketRow }> {
    const { ticketId, senderId, body, draftId, setFirstResponseAt, moveToInProgress } = params;

    const ticketUpdateData: Prisma.TicketUpdateInput = {};
    if (setFirstResponseAt) ticketUpdateData.firstResponseAt = new Date();
    if (moveToInProgress) ticketUpdateData.status = 'IN_PROGRESS';

    const [message, ticket] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId,
          senderId,
          type: 'ADMIN_REPLY',
          body,
          aiAssisted: draftId !== undefined,
          draftId: draftId ?? null,
        },
        select: MESSAGE_SELECT,
      }),
      prisma.ticket.update({
        where: { id: ticketId },
        data: Object.keys(ticketUpdateData).length > 0 ? ticketUpdateData : { updatedAt: new Date() },
        select: TICKET_SELECT,
      }),
    ]);

    return { message, ticket };
  },

  // ---- Validate draft ownership ------------------------------------------

  findDraft(draftId: string, ticketId: string): Promise<{ id: string } | null> {
    return prisma.aiDraft.findFirst({
      where: { id: draftId, ticketId },
      select: { id: true },
    });
  },

  // ---- Validate admin user -----------------------------------------------

  findAdminUser(userId: string): Promise<{ id: string; role: string } | null> {
    return prisma.user.findFirst({
      where: { id: userId, role: 'ADMIN' },
      select: { id: true, role: true },
    });
  },

  // ---- List admin users (for dropdown) -----------------------------------

  listAdmins(): Promise<Array<{ id: string; name: string }>> {
    return prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  },

  // ---- Stats --------------------------------------------------------------

  /**
   * Computes all stats IN THE DATABASE using Prisma aggregations and raw queries.
   * BigInt from COUNT(*) is always converted with Number().
   */
  async getStats(): Promise<AdminStats> {
    const now = new Date();

    // byStatus: group by status — all tickets
    const byStatusRows = await prisma.ticket.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const byStatus = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
    for (const row of byStatusRows) {
      byStatus[row.status] = row._count._all;
    }

    const total = byStatus.OPEN + byStatus.IN_PROGRESS + byStatus.RESOLVED + byStatus.CLOSED;

    // byPriority: unresolved only
    const byPriorityRows = await prisma.ticket.groupBy({
      by: ['priority'],
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      _count: { _all: true },
    });
    const byPriority = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const row of byPriorityRows) {
      byPriority[row.priority] = row._count._all;
    }

    // unassigned: unresolved with no assignee
    const unassigned = await prisma.ticket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        assignedToId: null,
      },
    });

    // overdue: unresolved, no firstResponseAt, past SLA by priority
    // SLA_HOURS from common/sla.ts is the single source of truth
    const overdueRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "Ticket"
      WHERE status IN ('OPEN', 'IN_PROGRESS')
        AND "firstResponseAt" IS NULL
        AND (
          (priority = 'CRITICAL' AND "createdAt" < NOW() - (${SLA_HOURS.CRITICAL} * INTERVAL '1 hour')) OR
          (priority = 'HIGH'     AND "createdAt" < NOW() - (${SLA_HOURS.HIGH} * INTERVAL '1 hour')) OR
          (priority = 'MEDIUM'   AND "createdAt" < NOW() - (${SLA_HOURS.MEDIUM} * INTERVAL '1 hour')) OR
          (priority = 'LOW'      AND "createdAt" < NOW() - (${SLA_HOURS.LOW} * INTERVAL '1 hour'))
        )
    `;
    const overdue = Number(overdueRows[0]!.count);

    // needsManualTriage: unresolved
    const needsManualTriage = await prisma.ticket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        needsManualTriage: true,
      },
    });

    // avgFirstResponseHours: average across all tickets that have a firstResponseAt
    const avgRows = await prisma.$queryRaw<Array<{ avg_hours: number | string | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 3600)::float as avg_hours
      FROM "Ticket" WHERE "firstResponseAt" IS NOT NULL
    `;
    const rawAvg = avgRows[0]?.avg_hours;
    const avgNumber = rawAvg !== null && rawAvg !== undefined ? Number(rawAvg) : null;
    const avgFirstResponseHours = avgNumber !== null && !isNaN(avgNumber) ? Math.round(avgNumber * 10) / 10 : null;

    return {
      total,
      byStatus,
      byPriority,
      unassigned,
      overdue,
      needsManualTriage,
      avgFirstResponseHours,
    };
  },
};
