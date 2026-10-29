/**
 * Ticket DTOs — two shapes:
 *
 * AuthorTicketDto: safe for authors. NEVER exposes category, priority, aiStatus,
 *   aiReasoning, aiError, needsManualTriage, assignee or any internal field.
 *
 * AdminTicketDto: everything above plus admin-only fields.
 *
 * Message DTO: admin replies shown to authors use "BookLeaf Support" as sender name.
 *   Admin's real name/email is never exposed to authors.
 */

import { formatTicketNumber } from '../../common/ticketNumber';
import { ageHours, isOverdue } from '../../common/sla';
import type { TicketRow, MessageRow } from './tickets.repository';
import type { MessageType, Role } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Author DTO
// ---------------------------------------------------------------------------

export interface AuthorTicketDto {
  id: string;
  ticketNumber: string;      // "BL-1001"
  ticketNumberRaw: number;   // 1001
  subject: string;
  description: string;
  status: string;
  book: { id: string; title: string } | null;
  attachments: unknown;
  createdAt: string;
  updatedAt: string;
}

export function toAuthorTicketDto(row: TicketRow): AuthorTicketDto {
  return {
    id: row.id,
    ticketNumber: formatTicketNumber(row.ticketNumber),
    ticketNumberRaw: row.ticketNumber,
    subject: row.subject,
    description: row.description,
    status: row.status,
    book: row.book ?? null,
    attachments: row.attachments ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Admin DTO
// ---------------------------------------------------------------------------

export interface AdminTicketDto extends AuthorTicketDto {
  author: { id: string; name: string; email: string };
  category: string | null;
  categorySource: string | null;
  priority: string;
  prioritySource: string | null;
  aiStatus: string;
  aiReasoning: string | null;
  aiError: string | null;
  needsManualTriage: boolean;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  ageHours: number;
  isOverdue: boolean;
  messageCount: number;
}

export function toAdminTicketDto(row: TicketRow, now: Date): AdminTicketDto {
  const base = toAuthorTicketDto(row);
  return {
    ...base,
    author: row.author,
    category: row.category ?? null,
    categorySource: row.categorySource ?? null,
    priority: row.priority,
    prioritySource: row.prioritySource ?? null,
    aiStatus: row.aiStatus,
    aiReasoning: row.aiReasoning ?? null,
    aiError: row.aiError ?? null,
    needsManualTriage: row.needsManualTriage,
    assignedToId: row.assignedToId ?? row.assignee?.id ?? null,
    assignedTo: row.assignee ?? null,
    firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    ageHours: Math.round(ageHours(row.createdAt, now) * 10) / 10,
    isOverdue: isOverdue(row, now),
    messageCount: row._count.messages,
  };
}

// ---------------------------------------------------------------------------
// Message DTO
// ---------------------------------------------------------------------------

export interface MessageDto {
  id: string;
  ticketId: string;
  type: MessageType;
  body: string;
  aiAssisted: boolean;
  createdAt: string;
  sender: {
    id: string;
    /** "BookLeaf Support" for ADMIN_REPLY when shown to authors; real name for INTERNAL_NOTE (admins only). */
    displayName: string;
  };
}

/**
 * @param forAdmin  When false, ADMIN_REPLY sender name is replaced with "BookLeaf Support"
 *                  and the admin's email is never included.
 */
export function toMessageDto(
  row: MessageRow,
  forAdmin: boolean,
): MessageDto {
  const isAdminReply = row.type === ('ADMIN_REPLY' as MessageType);
  const senderRole: Role = row.sender.role;
  const isAdminSender = senderRole === 'ADMIN';

  const displayName =
    !forAdmin && isAdminReply && isAdminSender
      ? 'BookLeaf Support'
      : row.sender.name;

  return {
    id: row.id,
    ticketId: row.ticketId,
    type: row.type,
    body: row.body,
    aiAssisted: row.aiAssisted,
    createdAt: row.createdAt.toISOString(),
    sender: { id: row.senderId, displayName },
  };
}
