# BookLeaf Real-Time Architecture (Socket.IO)

This document describes the real-time event architecture, room topology, authentication handshake, event contracts, security rules, and scaling considerations for the BookLeaf Author Support Portal.

---

## 1. Architecture Overview

Real-time capabilities are powered by **Socket.IO** attached directly to the core HTTP server (`src/server.ts`), keeping the Express REST application (`src/app.ts`) decoupled and testable.

### Event Decoupling via Domain Events
Services do **not** import or invoke Socket.IO directly. Instead:
1. Controllers execute business logic via Services.
2. Services perform database writes via Repositories.
3. Upon successful transaction commit, Services emit in-process domain events using the typed singleton event bus (`src/common/domainEvents.ts`).
4. The **`RealtimeGateway`** (`src/realtime/gateway.ts`) subscribes to these domain events, resolves the destination rooms and DTOs, and emits the outward Socket.IO messages.
5. All gateway emissions are wrapped in error handling to guarantee that real-time delivery issues never impact HTTP request/response lifecycles.

```mermaid
flowchart LR
    Client[HTTP Client] --> Controller[Controller]
    Controller --> Service[Service]
    Service --> Repository[Repository (Prisma / Postgres)]
    Service -.->|After DB Write| DomainEvents[DomainEventBus]
    DomainEvents --> Gateway[RealtimeGateway]
    Gateway --> SocketServer[Socket.IO Server]
    SocketServer --> SocketClient[Connected Browser / Client]
```

---

## 2. Authentication Handshake & Token Lifecycle

### Handshake Authentication
When establishing a connection, clients pass their JWT in `auth.token`:
```ts
import { io } from 'socket.io-client';

const socket = io('https://api.bookleaf.com', {
  auth: { token: 'Bearer <jwt_token>' },
  transports: ['websocket', 'polling'],
});
```

The server handshake middleware (`src/realtime/socket.ts`):
1. Extracts the token from `socket.handshake.auth.token` (or `Authorization` header).
2. Verifies the token using `verifyAccessTokenWithExpiry` (verifies `HS256`, signature, expiration, and payload structure).
3. Queries PostgreSQL to confirm the user still exists (invalidates stateless tokens for deleted or deactivated users).
4. Attaches `{ id, role, authorId }` and the token `exp` timestamp to `socket.data.user`.
5. Rejects with explicit errors on failure:
   - `Authentication required` (missing token)
   - `Token expired` (expired token)
   - `Invalid token` (malformed, forged, or wrong secret)
   - `User not found` (user deleted in database)

### Expiration & Disconnect Scheduling
To prevent stale connections when a token expires:
1. The server reads the `exp` claim during handshake.
2. A timer (`setTimeout`) is scheduled for the remaining lifespan of the token.
3. When the token expires:
   - Emits an `auth:expired` event to the client with payload `{ message: 'Token expired' }`.
   - Disconnects the socket server-side (`socket.disconnect(true)`).
4. If the client disconnects before expiration, the timer is cleared immediately (`clearTimeout`).

---

## 3. Room Topology & Access Control

### Room Assignments
Upon successful handshake, the server automatically assigns rooms:
- **`user:{userId}`**: Every connected socket joins its own private user room. Authors receive personal updates exclusively in this room.
- **`admins`**: All sockets authenticated with `role === 'ADMIN'` join the shared `admins` room.

### RBAC Security Constraints
- **Authors Never Join `admins`**: Only users with verified `role === 'ADMIN'` are joined to the `admins` room.
- **No Client-Initiated Room Joins**: The server registers no client-to-server join events. Arbitrary client `socket.emit('join', ...)` calls are completely ignored.
- **Information Masking for Authors**:
  - `ticket:note` (internal notes) is strictly sent to `admins` only.
  - `ticket:ai_ready` is sent to `admins` only.
  - `ticket:created` is sent to `admins` only.
  - `ticket:message` displays `"BookLeaf Support"` as the sender name for authors when the sender is an admin, masking individual admin identities and emails.
  - `ticket:updated` is only dispatched to authors if a field visible to them changed (e.g. `status`). Updates to internal fields (`category`, `priority`, `assignedToId`) send events exclusively to `admins`.

---

## 4. Server-to-Client Event Specifications

| Event | Target Room | Payload Type | Description |
|---|---|---|---|
| `ticket:created` | `admins` | `AdminTicketDto` | New ticket raised by an author. |
| `ticket:updated` | `admins` | `AdminTicketDto` | Any ticket field updated (status, category, priority, assignment). |
| `ticket:updated` | `user:{authorUserId}` | `AuthorTicketDto` | Ticket status change visible to author (clean DTO with zero internal fields). |
| `ticket:message` | `admins` | `MessageDto` | Public reply or author follow-up with real sender details. |
| `ticket:message` | `user:{authorUserId}` | `MessageDto` | Public reply with sender masked as `"BookLeaf Support"`. |
| `ticket:note` | `admins` | `MessageDto` | Internal note created by an admin. Never sent to authors. |
| `ticket:ai_ready` | `admins` | `{ ticketId, category, priority, aiStatus }` | Async AI classification/triage completed. |
| `auth:expired` | Socket sender | `{ message: string }` | Token has reached expiration; prompts client to re-login. |

---

## 5. Horizontal Scaling & Production Deployment

In the current single-instance deployment, all rooms and connections are tracked in Node.js process memory.

When scaling horizontally across multiple server instances (e.g., Kubernetes, Render multiple instances, AWS ECS):
1. Socket.IO instances across nodes cannot communicate by default.
2. **Socket.IO Redis Adapter** (`@socket.io/redis-adapter` or `@socket.io/redis-streams-adapter`) must be mounted:
   ```ts
   import { createClient } from 'redis';
   import { createAdapter } from '@socket.io/redis-adapter';

   const pubClient = createClient({ url: process.env.REDIS_URL });
   const subClient = pubClient.duplicate();

   await Promise.all([pubClient.connect(), subClient.connect()]);
   io.adapter(createAdapter(pubClient, subClient));
   ```
3. Load balancers must enable sticky sessions (or rely exclusively on WebSocket transport without HTTP polling fallback) so handshakes stay pinned to the same node.
