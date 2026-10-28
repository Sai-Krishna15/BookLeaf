/**
 * Admin service — business logic for admin-only ticket operations.
 * This layer never imports Prisma directly; all DB calls go through adminRepository.
 *
 * CONCURRENCY APPROACH (documented here per architecture spec):
 * We use targeted updates — prisma.ticket.update({ where: { id }, data: { onlyChangedFields } }).
 * This is a single atomic SQL UPDATE with no prior read of the row for the update itself.
 * Two admins acting at the same time on different fields will both succeed without either
 * overwriting the other's changes.
 * For replies, prisma.$transaction([...]) atomically writes message + firstResponseAt + status
 * in one commit so ticket state is always consistent with the message thread.
 */

import { ValidationError, ConflictError, NotFoundError } from '../../common/errors';
import { domainEvents } from '../../common/domainEvents';
import { aiService } from '../ai/ai.service';
import {
  toAdminTicketDto,
  toMessageDto,
  type AdminTicketDto,
  type MessageDto,
} from '../tickets/tickets.dto';
import { adminRepository, type AdminStats } from './admin.repository';
import type { PatchTicketBody, NoteBody, ReplyBody } from './admin.schema';
import type { TicketPatchData } from './admin.repository';

// Re-export AdminStats for controllers
export type { AdminStats };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const adminService = {
  // ---- PATCH /admin/tickets/:id ------------------------------------------

  /**
   * Patches a ticket with only the fields that actually changed.
   * - category/priority overrides set their source to ADMIN.
   * - Status→RESOLVED/CLOSED sets resolvedAt; OPEN/IN_PROGRESS clears it.
   * - needsManualTriage is cleared ONLY when BOTH categorySource AND prioritySource
   *   will be ADMIN after this update (either already were, or are being set now).
   * - assignedToId must be an ADMIN user (or null).
   * - No-op if nothing changed.
   */
  async patchTicket(adminId: string, ticketId: string, body: PatchTicketBody): Promise<AdminTicketDto> {
    const ticket = await adminRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    const now = new Date();
    const updateData: TicketPatchData = {};
    const changedFields: Record<string, unknown> = {};

    // ---- status
    if (body.status !== undefined && body.status !== ticket.status) {
      updateData.status = body.status;
      changedFields.status = body.status;

      if (body.status === 'RESOLVED' || body.status === 'CLOSED') {
        if (!ticket.resolvedAt) {
          updateData.resolvedAt = now;
        }
      } else {
        // OPEN or IN_PROGRESS: clear resolvedAt
        updateData.resolvedAt = null;
      }
    }

    // ---- category
    if (body.category !== undefined && body.category !== ticket.category) {
      updateData.category = body.category;
      updateData.categorySource = 'ADMIN';
      changedFields.category = body.category;
    }

    // ---- priority
    if (body.priority !== undefined && body.priority !== ticket.priority) {
      updateData.priority = body.priority;
      updateData.prioritySource = 'ADMIN';
      changedFields.priority = body.priority;
    }

    // ---- assignedToId
    if ('assignedToId' in body) {
      const newAssignee = body.assignedToId;
      if (newAssignee !== ticket.assignedToId) {
        if (newAssignee !== null && newAssignee !== undefined) {
          // Validate it's an ADMIN user
          const adminUser = await adminRepository.findAdminUser(newAssignee);
          if (!adminUser) {
            throw new ValidationError('assignedToId must be an ADMIN user');
          }
        }
        // Use Prisma's NullableStringFieldUpdateOperationsInput pattern
        updateData.assignedToId = newAssignee ?? null;
        changedFields.assignedToId = newAssignee ?? null;
      }
    }

    // No-op: nothing changed
    if (Object.keys(updateData).length === 0) {
      return toAdminTicketDto(ticket, now);
    }

    // ---- needsManualTriage: clear ONLY when BOTH category AND priority sources are ADMIN
    // after this update. We check what the sources will be after the update:
    //   - categorySource will be ADMIN if: (a) it was already ADMIN, or (b) we're setting category now
    //   - prioritySource will be ADMIN if: (a) it was already ADMIN, or (b) we're setting priority now
    const willCategoryBeAdmin =
      ticket.categorySource === 'ADMIN' || updateData.categorySource === 'ADMIN';
    const willPriorityBeAdmin =
      ticket.prioritySource === 'ADMIN' || updateData.prioritySource === 'ADMIN';

    if (willCategoryBeAdmin && willPriorityBeAdmin && ticket.needsManualTriage) {
      updateData.needsManualTriage = false;
    }

    const updatedTicket = await adminRepository.patchTicket(ticketId, updateData);

    // Emit ticket.updated with the changed fields
    domainEvents.emit('ticket.updated', {
      ticketId,
      ...changedFields,
    });

    return toAdminTicketDto(updatedTicket, new Date());
  },

  // ---- POST /admin/tickets/:id/assign-me ---------------------------------

  async assignMe(adminId: string, ticketId: string): Promise<AdminTicketDto> {
    const ticket = await adminRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    // Idempotent: already assigned to this admin
    if (ticket.assignedToId === adminId) {
      return toAdminTicketDto(ticket, new Date());
    }

    const updated = await adminRepository.assignTicket(ticketId, adminId);
    domainEvents.emit('ticket.updated', { ticketId, assignedToId: adminId });
    return toAdminTicketDto(updated, new Date());
  },

  // ---- POST /admin/tickets/:id/notes -------------------------------------

  async createNote(adminId: string, ticketId: string, body: NoteBody): Promise<MessageDto> {
    const ticket = await adminRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    const message = await adminRepository.createNote(ticketId, adminId, body.body);

    // Emit ticket.note.created (NOT ticket.message.created — internal notes are not user-facing)
    domainEvents.emit('ticket.note.created', {
      ticketId,
      messageId: message.id,
      senderId: adminId,
    });

    // forAdmin=true: real sender name shown for INTERNAL_NOTE
    return toMessageDto(message, true);
  },

  // ---- POST /admin/tickets/:id/reply -------------------------------------

  async adminReply(
    adminId: string,
    ticketId: string,
    body: ReplyBody,
  ): Promise<{ message: MessageDto; ticket: AdminTicketDto; editedFromDraft: boolean }> {
    const ticket = await adminRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    if (ticket.status === 'CLOSED') {
      throw new ConflictError('Ticket is closed. Please reopen it before replying.');
    }

    // Validate draftId if provided — must belong to this ticket
    let editedFromDraft = false;
    if (body.draftId !== undefined) {
      const draft = await adminRepository.findDraft(body.draftId, ticketId);
      if (!draft) {
        throw new ValidationError('draftId does not belong to this ticket');
      }
      editedFromDraft = draft.body.trim() !== body.body.trim();
    }

    const { message, ticket: updatedTicket, movedToInProgress } = await adminRepository.adminReplyTx({
      ticketId,
      senderId: adminId,
      body: body.body,
      draftId: body.draftId,
    });

    domainEvents.emit('ticket.message.created', {
      ticketId,
      messageId: message.id,
      type: 'ADMIN_REPLY',
      senderId: adminId,
    });

    if (movedToInProgress) {
      domainEvents.emit('ticket.updated', { ticketId, status: 'IN_PROGRESS' });
    }

    return {
      message: toMessageDto(message, true),
      ticket: toAdminTicketDto(updatedTicket, new Date()),
      editedFromDraft,
    };
  },

  // ---- GET /admin/admins -------------------------------------------------

  listAdmins(): Promise<Array<{ id: string; name: string }>> {
    return adminRepository.listAdmins();
  },

  // ---- GET /admin/stats --------------------------------------------------

  getStats(): Promise<AdminStats> {
    return adminRepository.getStats();
  },

  // ---- POST /admin/tickets/:id/reclassify ---------------------------------

  async reclassifyTicket(ticketId: string): Promise<AdminTicketDto> {
    const ticket = await adminRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');
    await aiService.reclassifyTicket(ticketId);
    return toAdminTicketDto(ticket, new Date());
  },

  // ---- GET /admin/tickets/:id/draft --------------------------------------

  getDraft(ticketId: string) {
    return aiService.getOrGenerateDraft(ticketId, false);
  },

  // ---- POST /admin/tickets/:id/draft/regenerate ---------------------------

  regenerateDraft(ticketId: string) {
    return aiService.getOrGenerateDraft(ticketId, true);
  },
};
