/**
 * Socket.IO Real-time CLI Listener for BookLeaf
 * ----------------------------------------------
 * Demo real-time events across multiple terminal sessions (e.g., author in Terminal 1, admin in Terminal 2).
 *
 * Usage:
 *   # Listen as an admin (default: admin@bookleaf.com / Admin@1234)
 *   npx tsx scripts/socket-listen.ts admin@bookleaf.com Admin@1234
 *
 *   # Listen as an author (e.g. ananya.reddy@email.com / Test@1234)
 *   npx tsx scripts/socket-listen.ts ananya.reddy@email.com Test@1234
 *
 *   # Optional custom port (default 4000):
 *   PORT=4000 npx tsx scripts/socket-listen.ts admin@bookleaf.com Admin@1234
 */
import { io, type Socket } from 'socket.io-client';

const API_BASE = process.env.API_BASE ?? `http://localhost:${process.env.PORT ?? 4000}`;
const email = process.argv[2] ?? 'admin@bookleaf.com';
const password = process.argv[3] ?? 'Admin@1234';

async function main() {
  console.log(`\n======================================================`);
  console.log(`🔌 BookLeaf Real-time Socket Listener`);
  console.log(`   Connecting to: ${API_BASE}`);
  console.log(`   Logging in as: ${email}`);
  console.log(`======================================================\n`);

  // 1. Authenticate via REST API
  let token: string;
  let user: { id: string; name: string; role: string; authorId?: string | null };

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error(`❌ Login failed (${res.status}):`, errBody);
      process.exit(1);
    }

    const data = (await res.json()) as {
      token: string;
      user: { id: string; name: string; role: string; authorId?: string | null };
    };
    token = data.token;
    user = data.user;
    console.log(`✅ Authenticated successfully!`);
    console.log(`   User ID:   ${user.id}`);
    console.log(`   Name:      ${user.name}`);
    console.log(`   Role:      ${user.role}`);
    console.log(`   Author ID: ${user.authorId ?? 'None (Admin)'}\n`);
  } catch (err) {
    console.error(`❌ Could not connect to API server at ${API_BASE}:`, (err as Error).message);
    process.exit(1);
  }

  // 2. Connect to Socket.IO
  const socket: Socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  const timestamp = () => new Date().toLocaleTimeString();

  socket.on('connect', () => {
    console.log(`🟢 [${timestamp()}] Connected to Socket.IO (Socket ID: ${socket.id})`);
    console.log(`   Rooms joined: user:${user.id}${user.role === 'ADMIN' ? ', admins' : ''}`);
    console.log(`   Listening for real-time events... Press Ctrl+C to exit.\n`);
  });

  socket.on('connect_error', (err) => {
    console.error(`🔴 [${timestamp()}] Connection Error:`, err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log(`🟡 [${timestamp()}] Disconnected: ${reason}`);
  });

  // 3. Register real-time event listeners
  socket.on('ticket:created', (payload) => {
    console.log(`\n📬 [${timestamp()}] EVENT: ticket:created`);
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('ticket:updated', (payload) => {
    console.log(`\n🔄 [${timestamp()}] EVENT: ticket:updated`);
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('ticket:message', (payload) => {
    console.log(`\n💬 [${timestamp()}] EVENT: ticket:message`);
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('ticket:note', (payload) => {
    console.log(`\n📝 [${timestamp()}] EVENT: ticket:note (Admin Internal Note)`);
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('ticket:ai_ready', (payload) => {
    console.log(`\n🤖 [${timestamp()}] EVENT: ticket:ai_ready`);
    console.log(JSON.stringify(payload, null, 2));
  });

  socket.on('auth:expired', (payload) => {
    console.log(`\n⚠️ [${timestamp()}] EVENT: auth:expired -`, payload.message);
  });

  process.on('SIGINT', () => {
    console.log('\nClosing socket connection...');
    socket.close();
    process.exit(0);
  });
}

main().catch(console.error);
