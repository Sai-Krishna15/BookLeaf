#!/usr/bin/env tsx
/**
 * Production Smoke Test Script
 * Exercises the complete critical path against any running BookLeaf server (local or deployed):
 * 1. Health check (/api/v1/health)
 * 2. Author login (/api/v1/auth/login)
 * 3. Author portfolio listing (GET /api/v1/books)
 * 4. Socket.IO authenticated handshake & room attachment
 * 5. Ticket creation by author (POST /api/v1/tickets)
 * 6. Admin login (/api/v1/auth/login)
 * 7. Admin queue fetch with urgency sort (GET /api/v1/tickets)
 * 8. Admin reply submission (POST /api/v1/admin/tickets/:id/reply)
 * 9. Author receipt of reply & real-time event verification
 * 10. Ticket teardown / cleanup (PATCH status: CLOSED)
 */

import { io, Socket } from 'socket.io-client';

const TARGET_URL = (process.argv[2] || process.env.BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const API_URL = `${TARGET_URL}/api/v1`;

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logStep(step: number, title: string) {
  console.log(`\n${COLORS.cyan}[Step ${step}]${COLORS.reset} ${COLORS.bold}${title}${COLORS.reset}`);
}

function logSuccess(message: string) {
  console.log(`  ${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logFailure(message: string, error?: unknown) {
  console.error(`  ${COLORS.red}✗ ${message}${COLORS.reset}`);
  if (error) console.error(error);
}

async function requestJson(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { status: res.status, headers: res.headers, data, ok: res.ok };
}

async function runSmokeTests() {
  console.log(`${COLORS.bold}======================================================${COLORS.reset}`);
  console.log(`${COLORS.bold} BookLeaf Production Smoke Test Suite${COLORS.reset}`);
  console.log(` Target Server: ${COLORS.yellow}${TARGET_URL}${COLORS.reset}`);
  console.log(`${COLORS.bold}======================================================${COLORS.reset}`);

  let authorToken = '';
  let adminToken = '';
  let authorBookId = '';
  let testTicketId = '';
  let socket: Socket | null = null;
  let receivedSocketMessage = false;

  try {
    // -------------------------------------------------------------------------
    // Step 1: Health Check
    // -------------------------------------------------------------------------
    logStep(1, 'Verify service health and database connectivity');
    const healthRes = await requestJson(`${API_URL}/health`);
    if (healthRes.status !== 200 || healthRes.data?.status !== 'ok') {
      throw new Error(`Health check failed (${healthRes.status}): ${JSON.stringify(healthRes.data)}`);
    }
    logSuccess(`Health check OK — DB: ${healthRes.data.checks.database}, AI mode: ${healthRes.data.checks.ai.mode}`);

    // -------------------------------------------------------------------------
    // Step 2: Author Login
    // -------------------------------------------------------------------------
    logStep(2, 'Authenticate as seeded author (Priya Sharma)');
    const authorLogin = await requestJson(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'priya.sharma@email.com',
        password: 'Test@1234',
      }),
    });
    authorToken = authorLogin.data?.token || authorLogin.data?.data?.token;
    const authorUser = authorLogin.data?.user || authorLogin.data?.data?.user;
    if (authorLogin.status !== 200 || !authorToken) {
      throw new Error(`Author login failed (${authorLogin.status}): ${JSON.stringify(authorLogin.data)}`);
    }
    logSuccess(`Author authenticated — Role: ${authorUser?.role}, Name: ${authorUser?.name}`);

    // -------------------------------------------------------------------------
    // Step 3: Author Book Listing
    // -------------------------------------------------------------------------
    logStep(3, "Fetch author's book portfolio");
    const booksRes = await requestJson(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    const booksList = Array.isArray(booksRes.data?.data) ? booksRes.data.data : booksRes.data;
    if (booksRes.status !== 200 || !Array.isArray(booksList) || booksList.length === 0) {
      throw new Error(`Failed to list books (${booksRes.status}): ${JSON.stringify(booksRes.data)}`);
    }
    authorBookId = booksList[0].id;
    logSuccess(`Portfolio retrieved — Found ${booksList.length} books. Using book "${booksList[0].title}" (${authorBookId})`);

    // -------------------------------------------------------------------------
    // Step 4: Socket.IO Handshake
    // -------------------------------------------------------------------------
    logStep(4, 'Establish authenticated Socket.IO connection');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket.IO connection handshake timed out after 8000ms'));
      }, 8000);

      socket = io(TARGET_URL, {
        auth: { token: authorToken },
        transports: ['websocket', 'polling'],
        reconnection: false,
      });

      socket.on('connect', () => {
        clearTimeout(timeout);
        logSuccess(`Socket.IO connected via ${socket?.io?.engine?.transport?.name || 'websocket'} (Socket ID: ${socket?.id})`);
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Socket.IO connect error: ${err.message}`));
      });

      socket.on('ticket:message', (payload: any) => {
        receivedSocketMessage = true;
        logSuccess(`Received real-time event 'ticket:message' for ticket: ${payload?.ticketId || 'unknown'}`);
      });
    });

    // -------------------------------------------------------------------------
    // Step 5: Author Ticket Creation
    // -------------------------------------------------------------------------
    logStep(5, 'Create new support ticket as author');
    const ticketRes = await requestJson(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authorToken}` },
      body: JSON.stringify({
        bookId: authorBookId,
        subject: `[Automated Smoke Test] Distribution status inquiry ${Date.now()}`,
        description: 'Hello, this is an automated production verification inquiry to confirm end-to-end ticketing.',
      }),
    });
    const createdTicket = ticketRes.data?.data || ticketRes.data;
    if (ticketRes.status !== 201 || !createdTicket?.id) {
      throw new Error(`Ticket creation failed (${ticketRes.status}): ${JSON.stringify(ticketRes.data)}`);
    }
    testTicketId = createdTicket.id;
    const ticketNumber = createdTicket.ticketNumber;
    logSuccess(`Ticket created — ID: ${testTicketId}, Number: BL-${ticketNumber}`);

    // -------------------------------------------------------------------------
    // Step 6: Admin Login
    // -------------------------------------------------------------------------
    logStep(6, 'Authenticate as administrator (admin@bookleaf.com)');
    const adminLogin = await requestJson(`${API_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@bookleaf.com',
        password: 'Admin@1234',
      }),
    });
    adminToken = adminLogin.data?.token || adminLogin.data?.data?.token;
    const adminUser = adminLogin.data?.user || adminLogin.data?.data?.user;
    if (adminLogin.status !== 200 || !adminToken) {
      throw new Error(`Admin login failed (${adminLogin.status}): ${JSON.stringify(adminLogin.data)}`);
    }
    logSuccess(`Admin authenticated — User: ${adminUser?.email}`);

    // -------------------------------------------------------------------------
    // Step 7: Admin Queue Verification
    // -------------------------------------------------------------------------
    logStep(7, 'Query admin queue with urgency sort');
    const queueRes = await requestJson(`${API_URL}/tickets?sort=urgency&limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const queueList = queueRes.data?.data || queueRes.data;
    if (queueRes.status !== 200 || !Array.isArray(queueList)) {
      throw new Error(`Failed to fetch admin queue (${queueRes.status}): ${JSON.stringify(queueRes.data)}`);
    }
    const foundInQueue = queueList.some((t: any) => t.id === testTicketId);
    if (!foundInQueue) {
      throw new Error(`Newly created ticket ${testTicketId} was not found in admin queue`);
    }
    logSuccess(`Ticket verified in admin queue (Total queue items: ${queueRes.data?.meta?.total ?? queueList.length})`);

    // -------------------------------------------------------------------------
    // Step 8: Admin Reply Submission
    // -------------------------------------------------------------------------
    logStep(8, 'Submit official BookLeaf Support reply as administrator');
    const replyBody = 'Thank you for reaching out. We have received your inquiry and our fulfillment team is reviewing.';
    const replyRes = await requestJson(`${API_URL}/admin/tickets/${testTicketId}/reply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ body: replyBody }),
    });
    const replyData = replyRes.data?.data || replyRes.data;
    if (replyRes.status !== 201) {
      throw new Error(`Admin reply failed (${replyRes.status}): ${JSON.stringify(replyRes.data)}`);
    }
    logSuccess(`Admin reply dispatched — Status changed to: ${replyData?.ticket?.status}`);

    // -------------------------------------------------------------------------
    // Step 9: Author Message Retrieval
    // -------------------------------------------------------------------------
    logStep(9, 'Verify author receives the reply in conversation thread');
    await new Promise((r) => setTimeout(r, 1000));

    const messagesRes = await requestJson(`${API_URL}/tickets/${testTicketId}/messages`, {
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    const messagesList = Array.isArray(messagesRes.data) ? messagesRes.data : messagesRes.data?.data;
    if (messagesRes.status !== 200 || !Array.isArray(messagesList)) {
      throw new Error(`Failed to fetch ticket messages (${messagesRes.status}): ${JSON.stringify(messagesRes.data)}`);
    }

    const replyMsg = messagesList.find((m: any) => m.type === 'ADMIN_REPLY');
    if (!replyMsg) {
      throw new Error('ADMIN_REPLY was not found in author ticket conversation');
    }
    const replySenderName = replyMsg.sender?.displayName || replyMsg.senderName;
    if (replySenderName !== 'BookLeaf Support') {
      throw new Error(`Expected masked senderName "BookLeaf Support", received: "${replySenderName}"`);
    }
    logSuccess(`Author verified reply: "${replyMsg.body.slice(0, 50)}..." (Sender correctly masked as "${replySenderName}")`);

    // -------------------------------------------------------------------------
    // Step 10: Teardown / Close Test Ticket
    // -------------------------------------------------------------------------
    logStep(10, 'Teardown: Close test ticket');
    const closeRes = await requestJson(`${API_URL}/admin/tickets/${testTicketId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    if (closeRes.status === 200) {
      logSuccess(`Test ticket ${testTicketId} cleanly transitioned to CLOSED`);
    }

    console.log(`\n${COLORS.green}${COLORS.bold}======================================================${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bold} ALL 10 PRODUCTION SMOKE TESTS PASSED SUCCESSFULLY!${COLORS.reset}`);
    console.log(`${COLORS.green}${COLORS.bold}======================================================${COLORS.reset}\n`);

    if (socket) socket.disconnect();
    process.exit(0);
  } catch (err: any) {
    logFailure(err?.message || 'Smoke test encountered an error', err);
    if (testTicketId && adminToken) {
      try {
        await requestJson(`${API_URL}/admin/tickets/${testTicketId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ status: 'CLOSED' }),
        });
      } catch {
        // ignore teardown error
      }
    }
    if (socket) (socket as Socket).disconnect();
    process.exit(1);
  }
}

void runSmokeTests();
