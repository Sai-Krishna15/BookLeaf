/**
 * Typed Socket.IO event contracts (server -> client and client -> server).
 * PROJECT_CONTEXT §9 Real-time design.
 */
import type { AuthorTicketDto, AdminTicketDto, MessageDto } from '../modules/tickets/tickets.dto';

export interface TicketAiReadyPayload {
  ticketId: string;
  category: string;
  priority: string;
  aiStatus: string;
}

export interface AuthExpiredPayload {
  message: string;
}

export interface ServerToClientEvents {
  'ticket:created': (payload: AdminTicketDto) => void;
  'ticket:updated': (payload: AdminTicketDto | AuthorTicketDto) => void;
  'ticket:message': (payload: MessageDto) => void;
  'ticket:note': (payload: MessageDto) => void;
  'ticket:ai_ready': (payload: TicketAiReadyPayload) => void;
  'auth:expired': (payload: AuthExpiredPayload) => void;
}

export interface ClientToServerEvents {
  // No client-to-server custom events allowed. Clients only receive events.
}

export interface InterServerEvents {
  // For potential multi-instance Redis adapter.
}

export interface SocketData {
  user: {
    id: string;
    role: 'AUTHOR' | 'ADMIN';
    authorId: string | null;
  };
  exp?: number;
}
