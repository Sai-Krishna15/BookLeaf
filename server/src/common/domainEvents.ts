import { EventEmitter } from 'node:events';
import { logger } from '../config/logger';

// ---------------------------------------------------------------------------
// Event payload types (PROJECT_CONTEXT §9)
// ---------------------------------------------------------------------------

export interface TicketCreatedPayload {
  ticketId: string;
  ticketNumber: number;
  authorId: string;
}

export interface TicketUpdatedPayload {
  ticketId: string;
  status?: string;
  category?: string | null;
  priority?: string;
  assignedToId?: string | null;
}

export interface TicketMessageCreatedPayload {
  ticketId: string;
  messageId: string;
  type: string; // MessageType value
  senderId: string;
}

export interface TicketNoteCreatedPayload {
  ticketId: string;
  messageId: string;
  senderId: string;
}

export interface TicketAiReadyPayload {
  ticketId: string;
  category: string;
  priority: string;
  aiStatus: string;
}

// ---------------------------------------------------------------------------
// Typed event map
// ---------------------------------------------------------------------------

interface DomainEventMap {
  'ticket.created': [TicketCreatedPayload];
  'ticket.updated': [TicketUpdatedPayload];
  'ticket.message.created': [TicketMessageCreatedPayload];
  'ticket.note.created': [TicketNoteCreatedPayload];
  'ticket.ai.ready': [TicketAiReadyPayload];
}

// ---------------------------------------------------------------------------
// Wrapper: catches + logs throwing listeners, never propagates to caller
// ---------------------------------------------------------------------------

class DomainEventBus {
  private readonly emitter = new EventEmitter({ captureRejections: false });

  /**
   * Emit an event synchronously. All listeners run in call order.
   *
   * CONTRACT: A listener that throws or rejects must NOT fail the HTTP request.
   * We wrap each listener so any exception is caught and logged here.
   */
  emit<K extends keyof DomainEventMap>(event: K, payload: DomainEventMap[K][0]): void {
    // Collect listeners registered for this event, wrap each call individually
    const listeners = this.emitter.rawListeners(event as string);
    for (const raw of listeners) {
      try {
        // raw may be the listener itself or a once-wrapper; call it directly
        const result = (raw as Function).call(this.emitter, payload);
        // Catch async listeners that return a rejected promise
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            logger.error({ event, err }, 'domain-event listener rejected (ignored)');
          });
        }
      } catch (err) {
        logger.error({ event, err }, 'domain-event listener threw (ignored)');
      }
    }
  }

  on<K extends keyof DomainEventMap>(event: K, listener: (payload: DomainEventMap[K][0]) => unknown): this {
    this.emitter.on(event as string, listener as (...args: unknown[]) => unknown);
    return this;
  }

  once<K extends keyof DomainEventMap>(event: K, listener: (payload: DomainEventMap[K][0]) => unknown): this {
    this.emitter.once(event as string, listener as (...args: unknown[]) => unknown);
    return this;
  }

  off<K extends keyof DomainEventMap>(event: K, listener: (payload: DomainEventMap[K][0]) => unknown): this {
    this.emitter.off(event as string, listener as (...args: unknown[]) => unknown);
    return this;
  }
}

/** Singleton in-process event bus. Phase 7 (sockets) and Phase 8 (AI) subscribe here. */
export const domainEvents = new DomainEventBus();
