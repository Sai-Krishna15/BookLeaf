/**
 * RealtimeGateway — the ONLY place in the system that emits real-time events to Socket.IO.
 * Subscribes to in-process domain events (ticket.created, ticket.updated, etc.) from domainEvents.ts.
 * Services do NOT import Socket.IO or RealtimeGateway.
 * PROJECT_CONTEXT §9 Real-time design.
 */
import { domainEvents } from '../common/domainEvents';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import {
  toAdminTicketDto,
  toAuthorTicketDto,
  toMessageDto,
} from '../modules/tickets/tickets.dto';
import { MESSAGE_SELECT, ticketsRepository } from '../modules/tickets/tickets.repository';
import type {
  TicketCreatedPayload,
  TicketUpdatedPayload,
  TicketMessageCreatedPayload,
  TicketNoteCreatedPayload,
  TicketAiReadyPayload,
} from '../common/domainEvents';
import type { AppSocketServer } from './socket';

export class RealtimeGateway {
  // In-memory cache for authorId -> userId to minimize database queries
  private authorUserCache = new Map<string, string>();

  constructor(private readonly io: AppSocketServer) {
    this.subscribeToDomainEvents();
  }

  /**
   * Resolves the author's user ID so we can target their private room `user:{userId}`.
   */
  private async getAuthorUserId(authorId: string): Promise<string | null> {
    const cached = this.authorUserCache.get(authorId);
    if (cached) return cached;

    const user = await prisma.user.findFirst({
      where: { authorId },
      select: { id: true },
    });

    if (user) {
      this.authorUserCache.set(authorId, user.id);
      return user.id;
    }
    return null;
  }

  private subscribeToDomainEvents(): void {
    domainEvents.on('ticket.created', (payload) => this.handleTicketCreated(payload));
    domainEvents.on('ticket.updated', (payload) => this.handleTicketUpdated(payload));
    domainEvents.on('ticket.message.created', (payload) => this.handleMessageCreated(payload));
    domainEvents.on('ticket.note.created', (payload) => this.handleNoteCreated(payload));
    domainEvents.on('ticket.ai.ready', (payload) => this.handleAiReady(payload));
  }

  /**
   * ticket.created -> 'ticket:created' to room 'admins' (Admin ticket summary DTO).
   */
  private async handleTicketCreated(payload: TicketCreatedPayload): Promise<void> {
    try {
      const ticket = await ticketsRepository.findById(payload.ticketId);
      if (!ticket) return;

      const adminDto = toAdminTicketDto(ticket, new Date());
      this.io.to('admins').emit('ticket:created', adminDto);
    } catch (err) {
      logger.error({ err, payload }, 'Failed to emit ticket:created event');
    }
  }

  /**
   * ticket.updated -> 'ticket:updated' to 'admins' (admin payload)
   * AND to the ticket author's room ONLY IF a field visible to authors changed (status, updatedAt).
   * The author payload MUST be built with the AUTHOR DTO shape and contain NO admin-only fields.
   * A category/priority/assignee-only change sends nothing to the author.
   */
  private async handleTicketUpdated(payload: TicketUpdatedPayload): Promise<void> {
    try {
      const ticket = await ticketsRepository.findById(payload.ticketId);
      if (!ticket) return;

      const now = new Date();
      const adminDto = toAdminTicketDto(ticket, now);

      // Always notify admins of any ticket update
      this.io.to('admins').emit('ticket:updated', adminDto);

      // Notify the author ONLY if status changed (visible to author)
      if (payload.status !== undefined) {
        const authorUserId = await this.getAuthorUserId(ticket.authorId);
        if (authorUserId) {
          const authorDto = toAuthorTicketDto(ticket);
          this.io.to(`user:${authorUserId}`).emit('ticket:updated', authorDto);
        }
      }
    } catch (err) {
      logger.error({ err, payload }, 'Failed to emit ticket:updated event');
    }
  }

  /**
   * ticket.message.created -> 'ticket:message' to author's room and 'admins' (public messages only).
   * ADMIN_REPLY sender shown as 'BookLeaf Support' to authors, real name to admins.
   */
  private async handleMessageCreated(payload: TicketMessageCreatedPayload): Promise<void> {
    try {
      // Internal notes are never emitted as ticket:message (they have their own ticket:note event)
      if (payload.type === 'INTERNAL_NOTE') return;

      const msgRow = await prisma.ticketMessage.findUnique({
        where: { id: payload.messageId },
        select: MESSAGE_SELECT,
      });
      if (!msgRow) return;

      const adminMsgDto = toMessageDto(msgRow, true);
      const authorMsgDto = toMessageDto(msgRow, false);

      // Emit to admins with real name
      this.io.to('admins').emit('ticket:message', adminMsgDto);

      // Resolve author and emit to author room with "BookLeaf Support"
      const ticket = await ticketsRepository.findById(payload.ticketId);
      if (ticket) {
        const authorUserId = await this.getAuthorUserId(ticket.authorId);
        if (authorUserId) {
          this.io.to(`user:${authorUserId}`).emit('ticket:message', authorMsgDto);
        }
      }
    } catch (err) {
      logger.error({ err, payload }, 'Failed to emit ticket:message event');
    }
  }

  /**
   * ticket.note.created -> 'ticket:note' to 'admins' ONLY. Never to any author room.
   */
  private async handleNoteCreated(payload: TicketNoteCreatedPayload): Promise<void> {
    try {
      const noteRow = await prisma.ticketMessage.findUnique({
        where: { id: payload.messageId },
        select: MESSAGE_SELECT,
      });
      if (!noteRow) return;

      const noteDto = toMessageDto(noteRow, true);
      this.io.to('admins').emit('ticket:note', noteDto);
    } catch (err) {
      logger.error({ err, payload }, 'Failed to emit ticket:note event');
    }
  }

  /**
   * ticket.ai.ready -> 'ticket:ai_ready' to 'admins' only (wire it now, Phase 8 will emit the event).
   */
  private handleAiReady(payload: TicketAiReadyPayload): void {
    try {
      this.io.to('admins').emit('ticket:ai_ready', payload);
    } catch (err) {
      logger.error({ err, payload }, 'Failed to emit ticket:ai_ready event');
    }
  }
}

let gatewayInstance: RealtimeGateway | null = null;

export function initRealtimeGateway(io: AppSocketServer): RealtimeGateway {
  if (!gatewayInstance) {
    gatewayInstance = new RealtimeGateway(io);
  }
  return gatewayInstance;
}

export function getRealtimeGateway(): RealtimeGateway | null {
  return gatewayInstance;
}
