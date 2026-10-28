import { io, Socket } from 'socket.io-client';

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
  'ticket:created': (payload: unknown) => void;
  'ticket:updated': (payload: unknown) => void;
  'ticket:message': (payload: unknown) => void;
  'ticket:note': (payload: unknown) => void;
  'ticket:ai_ready': (payload: TicketAiReadyPayload) => void;
  'auth:expired': (payload: AuthExpiredPayload) => void;
}

export type ClientToServerEvents = Record<string, never>;

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket | null {
  return socket;
}

export function createSocket(token: string): AppSocket {
  if (socket) {
    socket.disconnect();
  }

  // Uses current origin or proxy path
  socket = io(window.location.origin, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
