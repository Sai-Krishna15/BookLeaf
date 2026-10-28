/**
 * Socket.IO server initialization, handshake authentication, and room management.
 * Attached to the HTTP server in server.ts (keeping app.ts free of sockets for testability).
 * PROJECT_CONTEXT §9 Real-time design.
 */
import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { UnauthorizedError } from '../common/errors';
import { verifyAccessTokenWithExpiry } from '../common/jwt';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from './events';

export type AppSocketServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let ioInstance: AppSocketServer | null = null;

export function getSocketServer(): AppSocketServer | null {
  return ioInstance;
}

/**
 * Initializes and attaches the Socket.IO server to the HTTP server.
 */
export function initSocketServer(server: HttpServer): AppSocketServer {
  const io: AppSocketServer = new SocketIOServer(server, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e4, // 10KB
  });

  // Handshake authentication middleware
  io.use(async (socket, next) => {
    const rawToken = socket.handshake.auth?.token ?? socket.handshake.headers?.authorization;
    if (!rawToken || typeof rawToken !== 'string') {
      return next(new Error('Authentication required'));
    }

    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

    try {
      const { user, exp } = verifyAccessTokenWithExpiry(token);

      // Confirm user still exists in DB (stateless tokens must not allow deleted users)
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, authorId: true },
      });

      if (!dbUser) {
        return next(new Error('User not found'));
      }

      socket.data.user = {
        id: dbUser.id,
        role: dbUser.role,
        authorId: dbUser.authorId,
      };
      socket.data.exp = exp;
      next();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return next(new Error(err.message));
      }
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Every socket joins user:{userId}
    socket.join(`user:${user.id}`);

    // ADMIN sockets also join "admins"
    if (user.role === 'ADMIN') {
      socket.join('admins');
    }

    // Clients cannot join arbitrary rooms: ignore/disallow any client-sent join events
    socket.onAny((event) => {
      if (event === 'join') {
        logger.warn({ userId: user.id }, 'Ignored unauthorized client-side room join request');
      }
    });

    // Token expiry scheduling: disconnect when JWT expires
    if (socket.data.exp) {
      const expiryMs = socket.data.exp * 1000 - Date.now();
      if (expiryMs <= 0) {
        socket.emit('auth:expired', { message: 'Token expired' });
        socket.disconnect(true);
      } else {
        const timer = setTimeout(() => {
          socket.emit('auth:expired', { message: 'Token expired' });
          socket.disconnect(true);
        }, expiryMs);

        socket.on('disconnect', () => {
          clearTimeout(timer);
        });
      }
    }
  });

  ioInstance = io;
  return io;
}

/**
 * Closes the Socket.IO server gracefully.
 */
export async function closeSocketServer(): Promise<void> {
  if (ioInstance) {
    await new Promise<void>((resolve) => {
      ioInstance!.close(() => resolve());
    });
    ioInstance = null;
  }
}
