/**
 * Real-time (Socket.IO) integration tests.
 * Connects socket.io-client to an ephemeral HTTP server attached to Socket.IO.
 * PROJECT_CONTEXT §9 Real-time design.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { domainEvents } from '../src/common/domainEvents';
import { signAccessToken } from '../src/common/jwt';
import { prisma } from '../src/config/prisma';
import { initRealtimeGateway } from '../src/realtime/gateway';
import { closeSocketServer, initSocketServer } from '../src/realtime/socket';

let server: http.Server;
let serverUrl: string;
const clientSockets: ClientSocket[] = [];

// Tokens and user IDs
let adminToken: string;
let adminId: string;
let author1Token: string;
let author1UserId: string;
let author2Token: string;
let author2UserId: string;

function createClient(token?: string, extraOptions?: Record<string, unknown>): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = Client(serverUrl, {
      auth: token !== undefined ? { token } : {},
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false,
      ...extraOptions,
    });
    clientSockets.push(socket);

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

function onceEvent<T = unknown>(
  socket: ClientSocket,
  event: string,
  filterOrTimeout?: ((payload: T) => boolean) | number,
  timeoutMs = 6000,
): Promise<T> {
  const filter = typeof filterOrTimeout === 'function' ? filterOrTimeout : undefined;
  const timeout = typeof filterOrTimeout === 'number' ? filterOrTimeout : timeoutMs;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for event "${event}" after ${timeout}ms`));
    }, timeout);

    const handler = (payload: T) => {
      if (!filter || filter(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };

    socket.on(event, handler);
  });
}

beforeAll(async () => {
  const app = createApp();
  server = http.createServer(app);
  const io = initSocketServer(server);
  initRealtimeGateway(io);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  serverUrl = `http://localhost:${port}`;

  // Log in users via REST API with retry for Neon cold start
  const login = async (email: string, pw: string) => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await request(app).post('/api/v1/auth/login').send({ email, password: pw });
        if (res.status === 200) {
          return res.body as { token: string; user: { id: string; role: string; authorId: string | null } };
        }
        if (attempt === 4) {
          expect(res.status, `Login failed for ${email}: ${JSON.stringify(res.body)}`).toBe(200);
        }
      } catch (e) {
        if (attempt === 4) throw e;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    throw new Error(`Failed to login ${email}`);
  };

  const adminAuth = await login('admin@bookleaf.com', 'Admin@1234');
  adminToken = adminAuth.token;
  adminId = adminAuth.user.id;

  const a1Auth = await login('ananya.reddy@email.com', 'Test@1234');
  author1Token = a1Auth.token;
  author1UserId = a1Auth.user.id;

  const a2Auth = await login('priya.sharma@email.com', 'Test@1234');
  author2Token = a2Auth.token;
  author2UserId = a2Auth.user.id;
}, 60_000);

afterEach(() => {
  while (clientSockets.length > 0) {
    const socket = clientSockets.pop();
    if (socket && socket.connected) {
      socket.disconnect();
    }
  }
});

afterAll(async () => {
  for (const socket of clientSockets) {
    if (socket.connected) socket.disconnect();
  }
  await closeSocketServer();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

// ---------------------------------------------------------------------------
// 1. Handshake Authentication
// ---------------------------------------------------------------------------

describe('Socket.IO Handshake Authentication', () => {
  it('rejects connection when no token is provided', async () => {
    await expect(createClient(undefined)).rejects.toThrow('Authentication required');
  });

  it('rejects connection when token is malformed', async () => {
    await expect(createClient('malformed-token')).rejects.toThrow('Invalid token');
  });

  it('rejects connection when token is signed with wrong secret', async () => {
    const forgedToken = jwt.sign(
      { sub: adminId, role: 'ADMIN', authorId: null },
      'wrong-secret-that-does-not-match-env-key-1234567890',
      { algorithm: 'HS256' },
    );
    await expect(createClient(forgedToken)).rejects.toThrow('Invalid token');
  });

  it('rejects connection when token is expired', async () => {
    const expiredToken = signAccessToken({ id: adminId, role: 'ADMIN', authorId: null }, '-1s');
    await expect(createClient(expiredToken)).rejects.toThrow('Token expired');
  });

  it('rejects connection when token belongs to a deleted user', async () => {
    // Create temporary user in DB, sign token, then delete the user
    const tempUser = await prisma.user.create({
      data: {
        email: `temp-${Date.now()}@test.com`,
        name: 'Temp User',
        role: 'ADMIN',
        passwordHash: 'dummy-hash',
      },
    });

    const tempToken = signAccessToken({ id: tempUser.id, role: 'ADMIN', authorId: null });

    // Delete user from DB
    await prisma.user.delete({ where: { id: tempUser.id } });

    await expect(createClient(tempToken)).rejects.toThrow('User not found');
  });

  it('connects successfully with valid admin token', async () => {
    const socket = await createClient(adminToken);
    expect(socket.connected).toBe(true);
  });

  it('connects successfully with valid author token', async () => {
    const socket = await createClient(author1Token);
    expect(socket.connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Author Event Scoping and Forbidden Keys
// ---------------------------------------------------------------------------

describe('Author Event Scoping and Information Masking', () => {
  it('author receives events ONLY for their own tickets; a second author receives nothing', async () => {
    const author1Socket = await createClient(author1Token);
    const author2Socket = await createClient(author2Token);

    let author2Received = false;
    author2Socket.on('ticket:updated', () => {
      author2Received = true;
    });

    const updatePromise = onceEvent(author1Socket, 'ticket:updated');

    // Create a ticket for Author 1 (Ananya / AUTH003)
    const t = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003',
        subject: 'Author 1 ticket for realtime test',
        description: 'Test description for author 1 scoping.',
        status: 'OPEN',
      },
    });

    // Move status to IN_PROGRESS
    await prisma.ticket.update({
      where: { id: t.id },
      data: { status: 'IN_PROGRESS' },
    });

    // Trigger update domain event
    domainEvents.emit('ticket.updated', { ticketId: t.id, status: 'IN_PROGRESS' });

    const received = await updatePromise;
    expect(received).toBeDefined();

    // Give author2 a moment to confirm it never received the event
    await new Promise((r) => setTimeout(r, 200));
    expect(author2Received).toBe(false);
  });

  it('author NEVER receives ticket:note, ticket:ai_ready, or ticket:created', async () => {
    const authorSocket = await createClient(author1Token);

    let forbiddenEventReceived = false;
    authorSocket.on('ticket:note', () => {
      forbiddenEventReceived = true;
    });
    authorSocket.on('ticket:ai_ready', () => {
      forbiddenEventReceived = true;
    });
    authorSocket.on('ticket:created', () => {
      forbiddenEventReceived = true;
    });

    // Create a note and emit note event
    domainEvents.emit('ticket.note.created', {
      ticketId: 'seed-ticket-1001',
      messageId: 'seed-msg-1001-1',
      senderId: adminId,
    });

    // Emit ai.ready event
    domainEvents.emit('ticket.ai.ready', {
      ticketId: 'seed-ticket-1001',
      category: 'ROYALTY_PAYMENTS',
      priority: 'HIGH',
      aiStatus: 'DONE',
    });

    // Emit created event
    domainEvents.emit('ticket.created', {
      ticketId: 'seed-ticket-1001',
      ticketNumber: 1001,
      authorId: 'AUTH003',
    });

    await new Promise((r) => setTimeout(r, 400));
    expect(forbiddenEventReceived).toBe(false);
  });

  it('ticket:updated payload for authors contains exact AuthorTicketDto keys (NO forbidden keys)', async () => {
    const authorSocket = await createClient(author1Token);

    const t = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003',
        subject: 'Author DTO verification ticket',
        description: 'Verify author payload keys.',
        status: 'OPEN',
        category: 'ROYALTY_PAYMENTS',
        categorySource: 'AI',
        priority: 'CRITICAL',
        prioritySource: 'AI',
        needsManualTriage: true,
      },
    });

    const updatePromise = onceEvent<Record<string, unknown>>(authorSocket, 'ticket:updated');

    await prisma.ticket.update({
      where: { id: t.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    domainEvents.emit('ticket.updated', { ticketId: t.id, status: 'RESOLVED' });

    const authorPayload = await updatePromise;
    expect(authorPayload).not.toBeNull();
    const keys = Object.keys(authorPayload).sort();
    const expectedKeys = [
      'attachments',
      'book',
      'createdAt',
      'description',
      'id',
      'status',
      'subject',
      'ticketNumber',
      'ticketNumberRaw',
      'updatedAt',
    ];
    expect(keys).toEqual(expectedKeys);

    // Explicitly verify absence of forbidden keys
    const forbiddenKeys = [
      'category',
      'categorySource',
      'priority',
      'prioritySource',
      'assignee',
      'assignedTo',
      'aiStatus',
      'aiReasoning',
      'aiError',
      'needsManualTriage',
    ];
    for (const forbidden of forbiddenKeys) {
      expect(authorPayload).not.toHaveProperty(forbidden);
    }
  });

  it('category-only PATCH sends no event to the author but DOES send to admins', async () => {
    const authorSocket = await createClient(author1Token);
    const adminSocket = await createClient(adminToken);

    let authorReceived = false;
    authorSocket.on('ticket:updated', () => {
      authorReceived = true;
    });
    const adminPromise = onceEvent(adminSocket, 'ticket:updated');

    const t = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003',
        subject: 'Category-only update ticket',
        description: 'Testing category update routing.',
        status: 'OPEN',
      },
    });

    await prisma.ticket.update({
      where: { id: t.id },
      data: { category: 'ISBN_METADATA', categorySource: 'ADMIN' },
    });

    // Domain event with category change but NO status change
    domainEvents.emit('ticket.updated', { ticketId: t.id, category: 'ISBN_METADATA' });

    const adminPayload = await adminPromise;
    expect(adminPayload).toBeDefined();

    await new Promise((r) => setTimeout(r, 200));
    expect(authorReceived).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Admin Event Delivery
// ---------------------------------------------------------------------------

describe('Admin Event Delivery', () => {
  it('admin socket receives created, updated, message, note, and ai_ready', async () => {
    const adminSocket = await createClient(adminToken);

    // Create an isolated ticket and messages for event delivery
    const adminEventTicket = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003',
        subject: 'Admin event delivery test ticket',
        description: 'Testing realtime event delivery to admin room.',
        status: 'OPEN',
      },
    });

    const adminEventMsg = await prisma.ticketMessage.create({
      data: {
        ticketId: adminEventTicket.id,
        senderId: author1UserId,
        type: 'AUTHOR_MESSAGE',
        body: 'Admin event test public author message',
      },
    });

    const adminEventNote = await prisma.ticketMessage.create({
      data: {
        ticketId: adminEventTicket.id,
        senderId: adminId,
        type: 'INTERNAL_NOTE',
        body: 'Admin event test staff internal note',
      },
    });

    const createdPromise = onceEvent(adminSocket, 'ticket:created');
    const updatedPromise = onceEvent(adminSocket, 'ticket:updated');
    const messagePromise = onceEvent(adminSocket, 'ticket:message');
    const notePromise = onceEvent(adminSocket, 'ticket:note');
    const aiReadyPromise = onceEvent(adminSocket, 'ticket:ai_ready');

    // 1. ticket.created
    domainEvents.emit('ticket.created', {
      ticketId: adminEventTicket.id,
      ticketNumber: adminEventTicket.ticketNumberRaw,
      authorId: 'AUTH003',
    });

    // 2. ticket.updated
    domainEvents.emit('ticket.updated', {
      ticketId: adminEventTicket.id,
      priority: 'HIGH',
    });

    // 3. ticket.message.created
    domainEvents.emit('ticket.message.created', {
      ticketId: adminEventTicket.id,
      messageId: adminEventMsg.id,
      type: 'AUTHOR_MESSAGE',
      senderId: author1UserId,
    });

    // 4. ticket.note.created
    domainEvents.emit('ticket.note.created', {
      ticketId: adminEventTicket.id,
      messageId: adminEventNote.id,
      senderId: adminId,
    });

    // 5. ticket.ai.ready
    domainEvents.emit('ticket.ai.ready', {
      ticketId: adminEventTicket.id,
      category: 'ROYALTY_PAYMENTS',
      priority: 'HIGH',
      aiStatus: 'DONE',
    });

    const [created, updated, message, note, aiReady] = await Promise.all([
      createdPromise,
      updatedPromise,
      messagePromise,
      notePromise,
      aiReadyPromise,
    ]);

    expect(created).toBeDefined();
    expect(updated).toBeDefined();
    expect(message).toBeDefined();
    expect(note).toBeDefined();
    expect(aiReady).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. End-to-End REST -> Socket Interactions
// ---------------------------------------------------------------------------

describe('REST Actions Trigger Real-time Events', () => {
  it('admin reply -> author receives ticket:message ("BookLeaf Support") and ticket:updated (status IN_PROGRESS)', async () => {
    const authorSocket = await createClient(author1Token);

    // Create an OPEN ticket for Author 1
    const t = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003',
        subject: 'Admin reply realtime test ticket',
        description: 'Author waiting for reply.',
        status: 'OPEN',
      },
    });

    const msgPromise = onceEvent<Record<string, unknown>>(
      authorSocket,
      'ticket:message',
      (p) => (p as any).ticketId === t.id,
    );
    const updatePromise = onceEvent<Record<string, unknown>>(
      authorSocket,
      'ticket:updated',
      (p) => (p as any).id === t.id,
    );

    // Admin replies via REST API
    const replyRes = await request(server)
      .post(`/api/v1/admin/tickets/${t.id}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Hello Ananya, BookLeaf support is here to help.' });

    expect(replyRes.status).toBe(201);

    const receivedMsg = await msgPromise;
    const receivedUpdate = await updatePromise;

    expect(receivedMsg).not.toBeNull();
    expect((receivedMsg as any).body).toBe('Hello Ananya, BookLeaf support is here to help.');
    expect((receivedMsg as any).sender.displayName).toBe('BookLeaf Support');

    expect(receivedUpdate).not.toBeNull();
    expect((receivedUpdate as any).status).toBe('IN_PROGRESS');
  });

  it('author follow-up -> admins receive ticket:message', async () => {
    const adminSocket = await createClient(adminToken);

    // Create an OPEN ticket for Author 1
    const t = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003',
        subject: 'Author follow up test',
        description: 'Initial query.',
        status: 'OPEN',
      },
    });

    const msgPromise = onceEvent<Record<string, unknown>>(
      adminSocket,
      'ticket:message',
      (p) => (p as any).ticketId === t.id,
    );

    // Author posts follow-up via REST API
    const msgRes = await request(server)
      .post(`/api/v1/tickets/${t.id}/messages`)
      .set('Authorization', `Bearer ${author1Token}`)
      .send({ body: 'Follow up from author.' });

    expect(msgRes.status).toBe(201);

    const receivedMsg = await msgPromise;
    expect(receivedMsg).not.toBeNull();
    expect((receivedMsg as any).body).toBe('Follow up from author.');
    expect((receivedMsg as any).sender.displayName).toBe('Ananya Reddy');
  });
});

// ---------------------------------------------------------------------------
// 5. Security & Expiry Edge Cases
// ---------------------------------------------------------------------------

describe('Security & Lifecycle Edge Cases', () => {
  it('author cannot self-join the "admins" room (emit join attempt is ignored)', async () => {
    const authorSocket = await createClient(author1Token);

    let receivedAdminNote = false;
    authorSocket.on('ticket:note', () => {
      receivedAdminNote = true;
    });

    // Author attempts unauthorized self-join
    authorSocket.emit('join', 'admins');
    await new Promise((r) => setTimeout(r, 100));

    // Admin creates an internal note
    domainEvents.emit('ticket.note.created', {
      ticketId: 'seed-ticket-1001',
      messageId: 'seed-msg-1001-1',
      senderId: adminId,
    });

    await new Promise((r) => setTimeout(r, 300));
    expect(receivedAdminNote).toBe(false);
  });

  it('server-side expiry disconnect emits auth:expired and disconnects socket', async () => {
    // Generate a token that expires in 2 seconds
    const shortToken = signAccessToken(
      { id: author1UserId, role: 'AUTHOR', authorId: 'AUTH003' },
      '2s',
    );

    const socket = await createClient(shortToken);
    expect(socket.connected).toBe(true);

    let expiredEventReceived = false;
    socket.on('auth:expired', (payload) => {
      expiredEventReceived = true;
      expect(payload.message).toContain('expired');
    });

    // Wait 2.5 seconds for token expiration
    await new Promise((r) => setTimeout(r, 2500));

    expect(expiredEventReceived).toBe(true);
    expect(socket.connected).toBe(false);
  }, 10_000);

  it('a throwing gateway emit does not fail the HTTP request', async () => {
    // Register a throwing listener on domainEvents to simulate socket/gateway failure
    const badListener = () => {
      throw new Error('Exploding socket gateway listener');
    };
    domainEvents.on('ticket.created', badListener);

    try {
      const res = await request(server)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${author1Token}`)
        .send({
          bookId: null,
          subject: 'Resilience test query subject',
          description: 'Testing that domain event failures never fail HTTP creation.',
        });

      expect(res.status).toBe(201);
    } finally {
      domainEvents.off('ticket.created', badListener);
    }
  });
});
