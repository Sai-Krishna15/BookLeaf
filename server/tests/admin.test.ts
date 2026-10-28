/**
 * Admin module integration tests — supertest against the test DB.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { domainEvents } from '../src/common/domainEvents';
import { prisma } from '../src/config/prisma';
import { adminRepository } from '../src/modules/admin/admin.repository';

const app = createApp();

const tokens: Record<string, string> = {};

async function login(key: string, email: string, password: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    if (res.status === 200) {
      tokens[key] = res.body.token as string;
      return;
    }
    if (attempt === 3) {
      expect(res.status, `login failed for ${key}: ${JSON.stringify(res.body)}`).toBe(200);
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

const get = (url: string, who?: string) => {
  const req = request(app).get(url);
  return who ? req.set('Authorization', `Bearer ${tokens[who]}`) : req;
};

const post = (url: string, who: string | undefined, body: unknown) => {
  const req = request(app).post(url);
  return who ? req.set('Authorization', `Bearer ${tokens[who]}`).send(body as object) : req.send(body as object);
};

const patch = (url: string, who: string | undefined, body: unknown) => {
  const req = request(app).patch(url);
  return who ? req.set('Authorization', `Bearer ${tokens[who]}`).send(body as object) : req.send(body as object);
};

// Test ticket holders
let testTicketOpenId: string;
let testTicketClosedId: string;
let foreignTicketId: string;
let testDraftId: string;
let foreignDraftId: string;
let admin1Id: string;
let admin2Id: string;
let authorUserId: string;

beforeAll(async () => {
  for (const [key, email, pw] of [
    ['admin', 'admin@bookleaf.com', 'Admin@1234'],
    ['ops', 'ops@bookleaf.com', 'Admin@1234'],
    ['ananya', 'ananya.reddy@email.com', 'Test@1234'],
  ] as const) {
    await login(key, email, pw);
  }

  const admin1User = await prisma.user.findUnique({ where: { email: 'admin@bookleaf.com' } });
  const admin2User = await prisma.user.findUnique({ where: { email: 'ops@bookleaf.com' } });
  const authorUser = await prisma.user.findUnique({ where: { email: 'ananya.reddy@email.com' } });
  admin1Id = admin1User!.id;
  admin2Id = admin2User!.id;
  authorUserId = authorUser!.id;

  // Reset seed-ticket-1009 to its original state so manual triage tests have predictable baseline
  await prisma.ticket.update({
    where: { id: 'seed-ticket-1009' },
    data: {
      category: 'ROYALTY_PAYMENTS',
      categorySource: 'FALLBACK',
      priority: 'MEDIUM',
      prioritySource: 'FALLBACK',
      needsManualTriage: true,
      status: 'OPEN',
      resolvedAt: null,
      assignedToId: null,
    },
  });

  // Create dedicated test tickets
  const tOpen = await prisma.ticket.create({
    data: {
      authorId: 'AUTH003', // Ananya Reddy
      subject: 'Admin test open ticket',
      description: 'Test description for admin operations that starts as OPEN.',
      status: 'OPEN',
      category: 'GENERAL_INQUIRY',
      categorySource: 'AI',
      priority: 'MEDIUM',
      prioritySource: 'AI',
      firstResponseAt: null,
    },
  });
  testTicketOpenId = tOpen.id;

  const tClosed = await prisma.ticket.create({
    data: {
      authorId: 'AUTH003', // Ananya Reddy
      subject: 'Admin test closed ticket',
      description: 'Test description for admin operations that is CLOSED.',
      status: 'CLOSED',
      category: 'GENERAL_INQUIRY',
      categorySource: 'AI',
      priority: 'LOW',
      prioritySource: 'AI',
    },
  });
  testTicketClosedId = tClosed.id;

  const tForeign = await prisma.ticket.create({
    data: {
      authorId: 'AUTH002',
      subject: 'Foreign test ticket',
      description: 'Foreign test ticket description.',
      status: 'OPEN',
      category: 'ISBN_METADATA',
      priority: 'HIGH',
    },
  });
  foreignTicketId = tForeign.id;

  // Create drafts for draftId validation
  const draft1 = await prisma.aiDraft.create({
    data: {
      ticketId: testTicketOpenId,
      body: 'Valid AI draft for open ticket.',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      promptVersion: '1',
    },
  });
  testDraftId = draft1.id;

  const draft2 = await prisma.aiDraft.create({
    data: {
      ticketId: foreignTicketId,
      body: 'AI draft for foreign ticket.',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      promptVersion: '1',
    },
  });
  foreignDraftId = draft2.id;
}, 60_000);

// ---------------------------------------------------------------------------
// 1. RBAC & Auth guards
// ---------------------------------------------------------------------------

describe('Admin RBAC and Auth guards', () => {
  it('returns 401 when no token is provided for all admin endpoints', async () => {
    const endpoints = [
      () => get('/api/v1/admin/admins'),
      () => get('/api/v1/admin/stats'),
      () => patch(`/api/v1/admin/tickets/${testTicketOpenId}`, undefined, { priority: 'HIGH' }),
      () => post(`/api/v1/admin/tickets/${testTicketOpenId}/assign-me`, undefined, {}),
      () => post(`/api/v1/admin/tickets/${testTicketOpenId}/notes`, undefined, { body: 'test note' }),
      () => post(`/api/v1/admin/tickets/${testTicketOpenId}/reply`, undefined, { body: 'test reply' }),
    ];

    for (const ep of endpoints) {
      const res = await ep();
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns 403 when an author tries to access any admin endpoint', async () => {
    const endpoints = [
      () => get('/api/v1/admin/admins', 'ananya'),
      () => get('/api/v1/admin/stats', 'ananya'),
      () => patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'ananya', { priority: 'HIGH' }),
      () => post(`/api/v1/admin/tickets/${testTicketOpenId}/assign-me`, 'ananya', {}),
      () => post(`/api/v1/admin/tickets/${testTicketOpenId}/notes`, 'ananya', { body: 'test note' }),
      () => post(`/api/v1/admin/tickets/${testTicketOpenId}/reply`, 'ananya', { body: 'test reply' }),
    ];

    for (const ep of endpoints) {
      const res = await ep();
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. GET /admin/admins
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/admins', () => {
  it('returns a list of admin users with only id and name (no emails or passwords)', async () => {
    const res = await get('/api/v1/admin/admins', 'admin');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);

    for (const admin of res.body) {
      expect(admin).toHaveProperty('id');
      expect(admin).toHaveProperty('name');
      expect(admin).not.toHaveProperty('email');
      expect(admin).not.toHaveProperty('passwordHash');
      expect(admin).not.toHaveProperty('authorId');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. PATCH /admin/tickets/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/admin/tickets/:id', () => {
  it('returns 400 when body is empty', async () => {
    const res = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 on invalid enum value', async () => {
    const res = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      status: 'NON_EXISTENT_STATUS',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 on unknown ticket id', async () => {
    const res = await patch('/api/v1/admin/tickets/non-existent-ticket-id', 'admin', {
      priority: 'HIGH',
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when assignedToId points at an author user', async () => {
    const res = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      assignedToId: authorUserId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('ADMIN user');
  });

  it('overrides category and sets categorySource to ADMIN', async () => {
    const res = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      category: 'PRINTING_QUALITY',
    });
    expect(res.status).toBe(200);
    expect(res.body.category).toBe('PRINTING_QUALITY');
    expect(res.body.categorySource).toBe('ADMIN');
  });

  it('overrides priority and sets prioritySource to ADMIN', async () => {
    const res = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      priority: 'CRITICAL',
    });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('CRITICAL');
    expect(res.body.prioritySource).toBe('ADMIN');
  });

  it('same-value update is a no-op: returns 200 without emitting ticket.updated', async () => {
    // Current priority is CRITICAL from previous test
    let eventFired = false;
    const listener = () => {
      eventFired = true;
    };
    domainEvents.on('ticket.updated', listener);

    try {
      const res = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
        priority: 'CRITICAL',
      });
      expect(res.status).toBe(200);
      expect(eventFired).toBe(false);
    } finally {
      domainEvents.off('ticket.updated', listener);
    }
  });

  it('status change: moving to RESOLVED sets resolvedAt; moving back to OPEN clears it', async () => {
    // Move to RESOLVED
    const res1 = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      status: 'RESOLVED',
    });
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('RESOLVED');
    expect(res1.body.resolvedAt).not.toBeNull();
    const resolvedAtTimestamp = res1.body.resolvedAt;

    // Moving to CLOSED should preserve resolvedAt
    const res2 = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      status: 'CLOSED',
    });
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('CLOSED');
    expect(res2.body.resolvedAt).toBe(resolvedAtTimestamp);

    // Moving back to IN_PROGRESS clears resolvedAt
    const res3 = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      status: 'IN_PROGRESS',
    });
    expect(res3.status).toBe(200);
    expect(res3.body.status).toBe('IN_PROGRESS');
    expect(res3.body.resolvedAt).toBeNull();
  });

  it('unassigns ticket when assignedToId is null', async () => {
    // First assign to admin1
    await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      assignedToId: admin1Id,
    });

    // Then unassign
    const res = await patch(`/api/v1/admin/tickets/${testTicketOpenId}`, 'admin', {
      assignedToId: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.assignedTo).toBeNull();
  });

  it('needsManualTriage rule on BL-1009: cleared ONLY when BOTH category and priority sources are ADMIN', async () => {
    // BL-1009 is seeded with category: ROYALTY_PAYMENTS (FALLBACK), priority: MEDIUM (FALLBACK), needsManualTriage: true
    const check1 = await get('/api/v1/tickets/seed-ticket-1009', 'admin');
    expect(check1.body.needsManualTriage).toBe(true);
    expect(check1.body.categorySource).toBe('FALLBACK');
    expect(check1.body.prioritySource).toBe('FALLBACK');

    // Step 1: Override only category -> needsManualTriage must remain true
    const res1 = await patch('/api/v1/admin/tickets/seed-ticket-1009', 'admin', {
      category: 'GENERAL_INQUIRY',
    });
    expect(res1.status).toBe(200);
    expect(res1.body.category).toBe('GENERAL_INQUIRY');
    expect(res1.body.categorySource).toBe('ADMIN');
    expect(res1.body.prioritySource).toBe('FALLBACK');
    expect(res1.body.needsManualTriage).toBe(true);

    // Step 2: Override priority as well -> now both are ADMIN -> needsManualTriage must become false
    const res2 = await patch('/api/v1/admin/tickets/seed-ticket-1009', 'admin', {
      priority: 'HIGH',
    });
    expect(res2.status).toBe(200);
    expect(res2.body.priority).toBe('HIGH');
    expect(res2.body.prioritySource).toBe('ADMIN');
    expect(res2.body.categorySource).toBe('ADMIN');
    expect(res2.body.needsManualTriage).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. POST /admin/tickets/:id/assign-me
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/tickets/:id/assign-me', () => {
  it('assigns ticket to caller and emits ticket.updated', async () => {
    let emittedPayload: Record<string, unknown> | null = null;
    const listener = (payload: unknown) => {
      emittedPayload = payload as Record<string, unknown>;
    };
    domainEvents.on('ticket.updated', listener);

    try {
      const res = await post(`/api/v1/admin/tickets/${testTicketOpenId}/assign-me`, 'admin', {});
      expect(res.status).toBe(200);
      expect(res.body.assignedTo?.id).toBe(admin1Id);
      expect(emittedPayload).not.toBeNull();
      expect(emittedPayload!.ticketId).toBe(testTicketOpenId);
      expect(emittedPayload!.assignedToId).toBe(admin1Id);
    } finally {
      domainEvents.off('ticket.updated', listener);
    }
  });

  it('is idempotent: calling assign-me again when already assigned returns 200 with no event', async () => {
    let eventFired = false;
    const listener = () => {
      eventFired = true;
    };
    domainEvents.on('ticket.updated', listener);

    try {
      const res = await post(`/api/v1/admin/tickets/${testTicketOpenId}/assign-me`, 'admin', {});
      expect(res.status).toBe(200);
      expect(res.body.assignedTo?.id).toBe(admin1Id);
      expect(eventFired).toBe(false);
    } finally {
      domainEvents.off('ticket.updated', listener);
    }
  });

  it('allows takeover when assigned to another admin', async () => {
    // ops admin takes over
    const res = await post(`/api/v1/admin/tickets/${testTicketOpenId}/assign-me`, 'ops', {});
    expect(res.status).toBe(200);
    expect(res.body.assignedTo?.id).toBe(admin2Id);
  });
});

// ---------------------------------------------------------------------------
// 5. POST /admin/tickets/:id/notes
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/tickets/:id/notes', () => {
  it('creates an INTERNAL_NOTE with real admin name and emits ticket.note.created (never ticket.message.created)', async () => {
    let noteCreatedFired = false;
    let messageCreatedFired = false;

    const noteListener = () => {
      noteCreatedFired = true;
    };
    const messageListener = () => {
      messageCreatedFired = true;
    };

    domainEvents.on('ticket.note.created', noteListener);
    domainEvents.on('ticket.message.created', messageListener);

    try {
      const res = await post(`/api/v1/admin/tickets/${testTicketOpenId}/notes`, 'admin', {
        body: 'Internal note for test verification: check author details.',
      });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('INTERNAL_NOTE');
      expect(res.body.body).toBe('Internal note for test verification: check author details.');
      expect(res.body.sender.displayName).toBe('BookLeaf Admin');
      expect(noteCreatedFired).toBe(true);
      expect(messageCreatedFired).toBe(false);
    } finally {
      domainEvents.off('ticket.note.created', noteListener);
      domainEvents.off('ticket.message.created', messageListener);
    }
  });

  it('internal note is visible to admin but NEVER to the ticket author', async () => {
    // Admin reads messages
    const adminMsgs = await get(`/api/v1/tickets/${testTicketOpenId}/messages`, 'admin');
    expect(adminMsgs.status).toBe(200);
    const hasNoteAdmin = adminMsgs.body.some(
      (m: { type: string; body: string }) =>
        m.type === 'INTERNAL_NOTE' && m.body.includes('Internal note for test verification'),
    );
    expect(hasNoteAdmin).toBe(true);

    // Author reads messages
    const authorMsgs = await get(`/api/v1/tickets/${testTicketOpenId}/messages`, 'ananya');
    expect(authorMsgs.status).toBe(200);
    const hasNoteAuthor = authorMsgs.body.some((m: { type: string }) => m.type === 'INTERNAL_NOTE');
    expect(hasNoteAuthor).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. POST /admin/tickets/:id/reply
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/tickets/:id/reply', () => {
  let replyTicketId: string;

  beforeAll(async () => {
    // Dedicated fresh ticket in OPEN status with no first response
    const t = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003', // Ananya Reddy
        subject: 'Fresh ticket for reply test',
        description: 'Original author inquiry.',
        status: 'OPEN',
        category: 'ROYALTY_PAYMENTS',
        priority: 'MEDIUM',
        firstResponseAt: null,
      },
    });
    replyTicketId = t.id;
  });

  it('returns 409 Conflict when replying to a CLOSED ticket', async () => {
    const res = await post(`/api/v1/admin/tickets/${testTicketClosedId}/reply`, 'admin', {
      body: 'Attempt to reply to closed ticket.',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('reopen');
  });

  it('returns 400 when draftId belongs to a different ticket', async () => {
    const res = await post(`/api/v1/admin/tickets/${replyTicketId}/reply`, 'admin', {
      body: 'Replying with foreign draft.',
      draftId: foreignDraftId,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('draftId');
  });

  it('first reply: sets firstResponseAt, moves OPEN to IN_PROGRESS, emits events, masks name as BookLeaf Support for author', async () => {
    let messageEventFired = false;
    let ticketUpdatedFired = false;
    let updatedStatus: string | undefined;

    const msgListener = () => {
      messageEventFired = true;
    };
    const updateListener = (payload: unknown) => {
      ticketUpdatedFired = true;
      updatedStatus = (payload as Record<string, unknown>).status as string;
    };

    domainEvents.on('ticket.message.created', msgListener);
    domainEvents.on('ticket.updated', updateListener);

    try {
      const res = await post(`/api/v1/admin/tickets/${replyTicketId}/reply`, 'admin', {
        body: 'Hello Ananya, we have verified your royalty payment details.',
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('ticket');

      expect(res.body.ticket.status).toBe('IN_PROGRESS');
      expect(res.body.ticket.firstResponseAt).not.toBeNull();
      expect(messageEventFired).toBe(true);
      expect(ticketUpdatedFired).toBe(true);
      expect(updatedStatus).toBe('IN_PROGRESS');

      // Check author sees "BookLeaf Support" as sender name
      const authorView = await get(`/api/v1/tickets/${replyTicketId}/messages`, 'ananya');
      expect(authorView.status).toBe(200);
      const replyMsg = authorView.body.find((m: { type: string }) => m.type === 'ADMIN_REPLY');
      expect(replyMsg).toBeDefined();
      expect(replyMsg.sender.displayName).toBe('BookLeaf Support');
    } finally {
      domainEvents.off('ticket.message.created', msgListener);
      domainEvents.off('ticket.updated', updateListener);
    }
  });

  it('second reply: does NOT change firstResponseAt', async () => {
    const beforeReply = await get(`/api/v1/tickets/${replyTicketId}`, 'admin');
    const originalFirstResponseAt = beforeReply.body.firstResponseAt;
    expect(originalFirstResponseAt).not.toBeNull();

    const res = await post(`/api/v1/admin/tickets/${replyTicketId}/reply`, 'ops', {
      body: 'Second follow-up reply from BookLeaf ops.',
    });
    expect(res.status).toBe(201);
    expect(res.body.ticket.firstResponseAt).toBe(originalFirstResponseAt);
  });

  it('reply with valid draftId marks message aiAssisted=true', async () => {
    const res = await post(`/api/v1/admin/tickets/${testTicketOpenId}/reply`, 'admin', {
      body: 'Reply assisted by AI draft.',
      draftId: testDraftId,
    });
    expect(res.status).toBe(201);
    expect(res.body.message.aiAssisted).toBe(true);
  });

  it('reply transaction atomicity: failure mid-way rolls back and persists nothing', async () => {
    // Calling adminReplyTx with a non-existent senderId triggers a Foreign Key violation in the transaction
    const initialTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: replyTicketId } });
    const initialFirstResponse = initialTicket.firstResponseAt;
    const testBody = 'Atomic rollback test message that must never persist';

    await expect(
      adminRepository.adminReplyTx({
        ticketId: replyTicketId,
        senderId: 'non-existent-user-id',
        body: testBody,
      }),
    ).rejects.toThrow();

    // Verify message was not saved
    const msg = await prisma.ticketMessage.findFirst({
      where: { body: testBody },
    });
    expect(msg).toBeNull();

    // Verify ticket was not changed
    const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: replyTicketId } });
    expect(ticketAfter.firstResponseAt).toEqual(initialFirstResponse);
  });

  it('fires two replies concurrently (Promise.all): firstResponseAt is preserved and ticket is not forced back from RESOLVED', async () => {
    // Create a fresh ticket in OPEN status
    const freshTicket = await prisma.ticket.create({
      data: {
        authorId: 'AUTH003',
        subject: 'Concurrent replies race test ticket',
        description: 'Testing concurrent reply race safety and RESOLVED status preservation.',
        status: 'OPEN',
        priority: 'MEDIUM',
      },
    });

    // Fire two replies concurrently
    const [res1, res2] = await Promise.all([
      post(`/api/v1/admin/tickets/${freshTicket.id}/reply`, 'admin', { body: 'Concurrent reply 1' }),
      post(`/api/v1/admin/tickets/${freshTicket.id}/reply`, 'ops', { body: 'Concurrent reply 2' }),
    ]);

    expect(res1.status, `res1 failed: ${res1.text}`).toBe(201);
    expect(res2.status, `res2 failed: ${res2.text}`).toBe(201);

    // Fetch the ticket from DB
    const updated = await prisma.ticket.findUnique({
      where: { id: freshTicket.id },
      include: { messages: { where: { type: 'ADMIN_REPLY' }, orderBy: { createdAt: 'asc' } } },
    });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('IN_PROGRESS');
    expect(updated!.firstResponseAt).not.toBeNull();
    // Earliest admin reply timestamp matches or precedes firstResponseAt
    const earliestReplyTime = updated!.messages[0]!.createdAt.getTime();
    expect(Math.abs(updated!.firstResponseAt!.getTime() - earliestReplyTime)).toBeLessThan(2000);

    // Now set the ticket to RESOLVED
    await prisma.ticket.update({
      where: { id: freshTicket.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    // Send another reply to the RESOLVED ticket: must stay RESOLVED
    const res3 = await post(`/api/v1/admin/tickets/${freshTicket.id}/reply`, 'admin', {
      body: 'Follow-up reply on resolved ticket',
    });
    expect(res3.status).toBe(201);
    expect(res3.body.ticket.status).toBe('RESOLVED'); // NOT forced back to IN_PROGRESS

    const finalTicket = await prisma.ticket.findUnique({ where: { id: freshTicket.id } });
    expect(finalTicket!.status).toBe('RESOLVED');
  });
});

// ---------------------------------------------------------------------------
// 7. GET /admin/stats
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/stats', () => {
  it('returns valid database-computed stats matching actual counts', async () => {
    const res = await get('/api/v1/admin/stats', 'admin');
    expect(res.status).toBe(200);

    const stats = res.body;
    expect(typeof stats.total).toBe('number');
    expect(stats.total).toBeGreaterThanOrEqual(9);

    // Verify status breakdown
    expect(typeof stats.byStatus.OPEN).toBe('number');
    expect(typeof stats.byStatus.IN_PROGRESS).toBe('number');
    expect(typeof stats.byStatus.RESOLVED).toBe('number');
    expect(typeof stats.byStatus.CLOSED).toBe('number');

    const sumStatus =
      stats.byStatus.OPEN + stats.byStatus.IN_PROGRESS + stats.byStatus.RESOLVED + stats.byStatus.CLOSED;
    expect(stats.total).toBe(sumStatus);

    // Verify priority breakdown (unresolved only)
    expect(typeof stats.byPriority.CRITICAL).toBe('number');
    expect(typeof stats.byPriority.HIGH).toBe('number');
    expect(typeof stats.byPriority.MEDIUM).toBe('number');
    expect(typeof stats.byPriority.LOW).toBe('number');

    const unresolvedCount = stats.byStatus.OPEN + stats.byStatus.IN_PROGRESS;
    const sumPriority =
      stats.byPriority.CRITICAL + stats.byPriority.HIGH + stats.byPriority.MEDIUM + stats.byPriority.LOW;
    expect(sumPriority).toBe(unresolvedCount);

    // Verify unassigned count matches DB count of unresolved unassigned tickets
    const expectedUnassigned = await prisma.ticket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        assignedToId: null,
      },
    });
    expect(stats.unassigned).toBe(expectedUnassigned);

    // Verify needsManualTriage matches DB count
    const expectedNeedsManualTriage = await prisma.ticket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        needsManualTriage: true,
      },
    });
    expect(stats.needsManualTriage).toBe(expectedNeedsManualTriage);

    // Overdue is a non-negative number
    expect(typeof stats.overdue).toBe('number');
    expect(stats.overdue).toBeGreaterThanOrEqual(0);

    // avgFirstResponseHours is a number or null
    if (stats.avgFirstResponseHours !== null) {
      expect(typeof stats.avgFirstResponseHours).toBe('number');
    }
  });

  it('GET /api/v1/tickets?overdue=true matches /admin/stats overdue count on seeded data', async () => {
    const statsRes = await get('/api/v1/admin/stats', 'admin');
    expect(statsRes.status).toBe(200);
    const expectedOverdueCount = statsRes.body.overdue;

    const listRes = await get('/api/v1/tickets?overdue=true&limit=100', 'admin');
    expect(listRes.status).toBe(200);
    expect(listRes.body.meta.total).toBe(expectedOverdueCount);
    expect(listRes.body.data.length).toBe(expectedOverdueCount);

    // Every item in the list must satisfy overdue criteria
    for (const ticket of listRes.body.data) {
      expect(ticket.isOverdue).toBe(true);
      expect(ticket.firstResponseAt).toBeNull();
      expect(['OPEN', 'IN_PROGRESS']).toContain(ticket.status);
    }
  });

  it('GET /api/v1/tickets?overdue=true accurately matches fixed-time edge cases', async () => {
    const now = new Date();
    // 25h ago (CRITICAL SLA is 24h -> overdue)
    const t25hAgo = new Date(now.getTime() - 25 * 3600 * 1000);
    // 23h ago (CRITICAL SLA is 24h -> not overdue)
    const t23hAgo = new Date(now.getTime() - 23 * 3600 * 1000);

    const createdIds: string[] = [];

    // Overdue ticket
    const overdueTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 9991,
        authorId: 'AUTH003',
        subject: 'Overdue Edge Case Ticket 1',
        description: 'Testing overdue edge case with 25h old critical ticket',
        status: 'OPEN',
        priority: 'CRITICAL',
        category: 'GENERAL_INQUIRY',
        createdAt: t25hAgo,
        firstResponseAt: null,
      },
    });
    createdIds.push(overdueTicket.id);

    // Not overdue (under SLA)
    const underSlaTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 9992,
        authorId: 'AUTH003',
        subject: 'Under SLA Edge Case Ticket 2',
        description: 'Testing under SLA edge case with 23h old critical ticket',
        status: 'OPEN',
        priority: 'CRITICAL',
        category: 'GENERAL_INQUIRY',
        createdAt: t23hAgo,
        firstResponseAt: null,
      },
    });
    createdIds.push(underSlaTicket.id);

    // Not overdue (firstResponseAt present)
    const repliedTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 9993,
        authorId: 'AUTH003',
        subject: 'Replied Edge Case Ticket 3',
        description: 'Testing replied edge case with firstResponseAt set',
        status: 'OPEN',
        priority: 'CRITICAL',
        category: 'GENERAL_INQUIRY',
        createdAt: t25hAgo,
        firstResponseAt: new Date(now.getTime() - 24 * 3600 * 1000),
      },
    });
    createdIds.push(repliedTicket.id);

    // Not overdue (resolved)
    const resolvedTicket = await prisma.ticket.create({
      data: {
        ticketNumber: 9994,
        authorId: 'AUTH003',
        subject: 'Resolved Edge Case Ticket 4',
        description: 'Testing resolved edge case',
        status: 'RESOLVED',
        priority: 'CRITICAL',
        category: 'GENERAL_INQUIRY',
        createdAt: t25hAgo,
        firstResponseAt: null,
        resolvedAt: now,
      },
    });
    createdIds.push(resolvedTicket.id);

    try {
      const statsRes = await get('/api/v1/admin/stats', 'admin');
      const overdueListRes = await get('/api/v1/tickets?overdue=true&limit=100', 'admin');

      expect(overdueListRes.status).toBe(200);
      expect(overdueListRes.body.meta.total).toBe(statsRes.body.overdue);

      const returnedIds = overdueListRes.body.data.map((t: { id: string }) => t.id);
      expect(returnedIds).toContain(overdueTicket.id);
      expect(returnedIds).not.toContain(underSlaTicket.id);
      expect(returnedIds).not.toContain(repliedTicket.id);
      expect(returnedIds).not.toContain(resolvedTicket.id);
    } finally {
      await prisma.ticket.deleteMany({
        where: { id: { in: createdIds } },
      });
    }
  });

  it('author calling GET /api/v1/tickets?overdue=true ignores overdue filter', async () => {
    const res = await get('/api/v1/tickets?overdue=true', 'ananya');
    expect(res.status).toBe(200);
    // Authors only see their own tickets, overdue filter is ignored
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
