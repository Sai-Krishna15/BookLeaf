# BookLeaf Author Support & Communication Portal: Project Context

> Paste this file into Antigravity as the project rules/context. Every requirement in the assignment PDF is mapped to a section below. Build in the phase order in Section 15.

---

## 0. Goal in one paragraph

A web app with two interfaces (Author portal, Admin portal) where authors raise support tickets about their books/royalties, and BookLeaf ops staff manage them with AI help: auto-classification, priority scoring, and draft replies grounded in the BookLeaf Knowledge Base. **If the AI fails at any point, nothing breaks.** Tickets are still created, and admins triage and reply manually. Updates appear live via Socket.IO.

Evaluation weights: AI Integration 25%, Architecture & Code Quality 25%, API Design 15%, Functionality 15%, Product Thinking 10%, Docs 10%.

---

## 1. Requirements traceability (nothing may be skipped)

| # | PDF requirement | Where implemented |
|---|---|---|
| A1 | Email/password login, authors see only own data | §6 auth, §7 RBAC + ownership |
| A2 | My Books: title, ISBN, genre, pub date, status, MRP, copies sold, royalty earned/paid/pending | §10.2 Books page |
| A3 | Submit query: book dropdown (or "General / Account Level"), subject, description, optional attachment (UI only) | §10.3 |
| A4 | My Tickets: status (Open/In Progress/Resolved/Closed), original query, admin responses, live updates without refresh | §9 Socket.IO, §10.4 |
| B1 | Ticket queue, all authors, filter by status/category/priority/date, urgent + oldest easy to spot | §10.6 |
| B2 | AI auto-classification into 6 categories + admin override | §8.2, §6 PATCH |
| B3 | AI priority (Critical/High/Medium/Low) + admin override | §8.2 |
| B4 | AI draft on ticket open, using KB, editable, sent reply visible to author | §8.3 |
| B5 | Update status, internal notes (hidden from author), assign to self | §6, §10.7 |
| C1 | Consistent REST naming | §6 |
| C2 | Auth middleware on all routes | §7 |
| C3 | RBAC: authors own data, admins everything | §7 |
| C4 | Input validation + meaningful errors (no generic 500s) | §5.3, §5.4 |
| C5 | API docs (Swagger/OpenAPI, Postman, or README) | §13 |
| D1 | Prompt engineering, tone like real support rep | §8.4 |
| D2 | API key only in env vars, never in frontend | §8.7 |
| D3 | AI down/rate-limited: graceful degradation, manual replies | §8.5 |
| D4 | Cost awareness: no full history + full KB every call | §8.6 |
| D5 | Model choice justified in docs | §13 |
| E | Pagination, real-time via WebSocket/Socket.IO (your requirement) | §5.5, §9 |
| F | Seed with provided JSON, handle all edge cases | §4, §11 |
| G | Deploy, live URL, test credentials in README | §14 |
| H | Private repo, README, 1-page write-up, clean commits | §14 |

---

## 2. Tech stack

**Backend:** Node.js, Express, TypeScript (strict), Prisma, PostgreSQL (Neon/Render), Zod, Socket.IO, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, pino + pino-http, p-queue, swagger-ui-express, Vitest + Supertest.

**Frontend:** React + Vite + TypeScript, Tailwind CSS, shadcn/ui, lucide-react, sonner (toasts), TanStack Query, TanStack Table, React Router, react-hook-form + Zod resolver, socket.io-client, date-fns, Inter font.

**AI:** Google Gemini Flash / Flash-Lite (free tier via AI Studio) as primary, Groq (free, OpenAI-compatible) as secondary, keyword rules as last resort. Model names come from env vars.

**Deploy:** Single Node service on Render/Railway that serves the built React app and the API/WebSocket (needs a persistent server, not serverless).

---

## 3. Monorepo structure

```
bookleaf-portal/
├── server/
│   ├── prisma/ { schema.prisma, seed.ts, data/bookleaf_sample_data.json }
│   ├── src/
│   │   ├── config/        env.ts (Zod-validated), logger.ts, prisma.ts, constants.ts
│   │   ├── common/        errors/, pagination.ts, asyncHandler.ts, types/
│   │   ├── middleware/    authenticate, requireRole, validate, rateLimiter, errorHandler, notFound, requestId
│   │   ├── modules/
│   │   │   ├── auth/      routes, controller, service, schema
│   │   │   ├── books/     routes, controller, service, repository, schema
│   │   │   ├── tickets/   routes, controller, service, repository, schema
│   │   │   ├── admin/     routes, controller, service, schema  (admin-only ticket actions + AI usage)
│   │   │   └── ai/        see §8.1
│   │   ├── realtime/      socket.ts, gateway.ts, events.ts
│   │   ├── app.ts         express wiring
│   │   └── server.ts      http + socket attach + graceful shutdown
│   ├── tests/
│   ├── openapi.yaml
│   └── .env.example
├── client/
│   └── src/
│       ├── app/           router.tsx, providers/ (Query, Auth, Socket), layouts/
│       ├── features/      auth/, books/, tickets/, admin/
│       ├── components/ui/ (shadcn)
│       ├── lib/           api.ts (axios + interceptors), socket.ts, utils.ts, formatters.ts
│       └── hooks/
├── README.md
├── WRITEUP.md
└── PROJECT_CONTEXT.md
```

**Layering rule:** `route → middleware → controller → service → repository (Prisma)`. Controllers handle HTTP only; services contain business rules and emit domain events; repositories are the only code that touches Prisma. Services never import `socket.io` (they call `RealtimeGateway`). Controllers never call the LLM (they call `AiService` through `TicketService`).

---

## 4. Database schema (Prisma)

```prisma
enum Role { AUTHOR ADMIN }
enum TicketStatus { OPEN IN_PROGRESS RESOLVED CLOSED }
enum TicketCategory {
  ROYALTY_PAYMENTS
  ISBN_METADATA
  PRINTING_QUALITY
  DISTRIBUTION_AVAILABILITY
  BOOK_STATUS_PRODUCTION
  GENERAL_INQUIRY
}
enum Priority { CRITICAL HIGH MEDIUM LOW }
enum FieldSource { AI FALLBACK ADMIN }          // who set category/priority
enum AiStatus { PENDING DONE FAILED SKIPPED }   // classification job state
enum MessageType { AUTHOR_MESSAGE ADMIN_REPLY INTERNAL_NOTE }

model User {
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String
  name         String
  role         Role
  authorId     String? @unique
  author       Author? @relation(fields: [authorId], references: [id])
  assignedTickets Ticket[] @relation("Assignee")
  messages     TicketMessage[]
  createdAt    DateTime @default(now())
}

model Author {
  id         String @id            // AUTH001...
  name       String
  email      String @unique
  phone      String
  city       String
  joinedDate DateTime
  books      Book[]
  tickets    Ticket[]
  user       User?
}

model Book {
  id                    String  @id   // BK001...
  authorId              String
  title                 String
  isbn                  String
  genre                 String
  publicationDate       DateTime?     // null while in production
  status                String        // "Published & Live" | "In Production - Cover Design" ...
  mrp                   Int?
  authorRoyaltyPerCopy  Int?
  totalCopiesSold       Int     @default(0)
  totalRoyaltyEarned    Int     @default(0)
  royaltyPaid           Int     @default(0)
  royaltyPending        Int     @default(0)
  lastRoyaltyPayoutDate DateTime?
  printPartner          String?
  availableOn           String[]
  author                Author  @relation(fields: [authorId], references: [id])
  tickets               Ticket[]
  @@index([authorId])
}

model Ticket {
  id             String         @id @default(cuid())
  ticketNumber   Int            @unique @default(autoincrement())   // BL-1001 style display
  authorId       String
  bookId         String?        // null = General / Account Level
  subject        String
  description    String
  status         TicketStatus   @default(OPEN)
  category       TicketCategory?
  categorySource FieldSource?
  priority       Priority       @default(MEDIUM)
  prioritySource FieldSource?
  aiStatus       AiStatus       @default(PENDING)
  aiReasoning    String?
  aiError        String?
  needsManualTriage Boolean     @default(false)   // true when AI failed
  assignedToId   String?
  attachments    Json?          // [{name,size,type}] metadata only
  firstResponseAt DateTime?
  resolvedAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  author   Author @relation(fields: [authorId], references: [id])
  book     Book?  @relation(fields: [bookId], references: [id])
  assignee User?  @relation("Assignee", fields: [assignedToId], references: [id])
  messages TicketMessage[]
  drafts   AiDraft[]
  @@index([status, priority, createdAt])
  @@index([authorId, createdAt])
  @@index([category])
}

model TicketMessage {
  id        String      @id @default(cuid())
  ticketId  String
  senderId  String
  type      MessageType            // INTERNAL_NOTE is NEVER returned to authors
  body      String
  aiAssisted Boolean    @default(false)  // reply started from an AI draft
  draftId   String?
  createdAt DateTime    @default(now())
  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  sender User   @relation(fields: [senderId], references: [id])
  @@index([ticketId, createdAt])
}

model AiDraft {
  id            String   @id @default(cuid())
  ticketId      String
  body          String
  provider      String
  model         String
  promptVersion String
  inputTokens   Int?
  outputTokens  Int?
  createdAt     DateTime @default(now())
  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  @@index([ticketId, createdAt])
}

model AiCallLog {      // evidence for cost awareness + debugging
  id           String   @id @default(cuid())
  kind         String   // CLASSIFY | DRAFT
  provider     String
  model        String
  ticketId     String?
  latencyMs    Int
  inputTokens  Int?
  outputTokens Int?
  success      Boolean
  errorCode    String?
  createdAt    DateTime @default(now())
}
```

---

## 5. Cross-cutting backend rules

### 5.1 Env (validated at boot, fail fast)
`NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGIN, GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY (optional), GROQ_MODEL, AI_TIMEOUT_MS=10000, AI_MAX_RETRIES=1, AI_RPM_LIMIT=10, AI_ENABLED=true`. Ship `.env.example`; `.env` in `.gitignore` before the first commit.

### 5.2 Security middleware
helmet, CORS limited to `CLIENT_ORIGIN`, JSON body limit 100kb, `express-rate-limit` (global + stricter on `/auth/login`), bcrypt cost 10, JWT in `Authorization: Bearer` header, request-id header, pino-http logging that never logs passwords/tokens.

### 5.3 Error model
Custom `AppError(code, message, status, details?)` with subclasses `ValidationError(400)`, `UnauthorizedError(401)`, `ForbiddenError(403)`, `NotFoundError(404)`, `ConflictError(409)`, `RateLimitError(429)`, `AiUnavailableError(503, internal only)`.

Every error response: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...], "requestId": "..." } }`. The central `errorHandler` maps Zod, Prisma (P2002 → 409, P2025 → 404) and unknown errors (logged, sanitized 500). Unknown routes → `notFound`.

### 5.4 Validation
Zod schemas per module (body, params, query), applied by `validate({ body, params, query })` middleware. Subject 5-150 chars, description 20-5000 chars, bookId must belong to the author, `limit` max 100.

### 5.5 Pagination (all list endpoints)
`?page=1&limit=20` returns `{ data: [], meta: { page, limit, total, totalPages, hasNext, hasPrev } }`. Shared helper in `common/pagination.ts`.

---

## 6. REST API (prefix `/api/v1`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | public | DB + AI provider status |
| POST | `/auth/login` | public | `{email,password}` → `{token,user}`; rate limited |
| GET | `/auth/me` | any | current user (+ author profile) |
| GET | `/books` | author | own books, paginated. Admin may pass `?authorId=` |
| GET | `/books/:id` | author/admin | ownership enforced |
| POST | `/tickets` | author | creates ticket (returns 201 immediately); AI classification runs async afterward |
| GET | `/tickets` | any | author: own only. admin: all. Filters: `status, category, priority, authorId, assignedTo (me\|unassigned\|id), from, to, q (search), sort (urgency\|newest\|oldest), page, limit` |
| GET | `/tickets/:id` | any | ownership enforced (author gets 404, not 403, for others' tickets) |
| GET | `/tickets/:id/messages` | any | **authors never receive `INTERNAL_NOTE`** (filtered in the repository query, not in the UI) |
| POST | `/tickets/:id/messages` | author | optional follow-up message (stretch: reopens a RESOLVED ticket) |
| PATCH | `/admin/tickets/:id` | admin | any of `status, category, priority, assignedToId` (sets source=ADMIN on override) |
| POST | `/admin/tickets/:id/assign-me` | admin | assigns to caller |
| POST | `/admin/tickets/:id/notes` | admin | internal note |
| POST | `/admin/tickets/:id/reply` | admin | public reply `{body, draftId?}`; sets `firstResponseAt`; OPEN → IN_PROGRESS |
| GET | `/admin/tickets/:id/draft` | admin | returns cached draft or generates one on first open |
| POST | `/admin/tickets/:id/draft/regenerate` | admin | forces a new draft |
| POST | `/admin/tickets/:id/reclassify` | admin | retries AI classification (used after AI failure) |
| GET | `/admin/stats` | admin | counts by status/priority, unassigned, overdue, avg first-response time |
| GET | `/admin/ai/usage` | admin | totals from `AiCallLog` (calls, failures, tokens) |
| GET | `/admin/admins` | admin | list of admins for the assignee dropdown |

Naming: plural nouns, lowercase, kebab-case for multi-word, correct verbs and status codes (201 create, 204 no body, 400/401/403/404/409/422/429/503).

---

## 7. Auth and RBAC

1. `authenticate` verifies the JWT, loads `{id, role, authorId}` onto `req.user`. Applied to everything except `/health` and `/auth/login`.
2. `requireRole('ADMIN')` guards every `/admin/*` route.
3. **Ownership checks live in the service layer** (not only in routes): authors can only read tickets/books where `authorId === req.user.authorId`. Return 404 for other authors' resources so IDs can't be probed.
4. Author ticket creation validates that `bookId` belongs to that author.
5. Socket.IO handshake runs the same JWT verification; authors join only `user:{userId}`, admins join `admins`.
6. Tests required: author A cannot GET author B's ticket (404), authors get 403 on `/admin/*`, internal notes never appear for authors.

---

## 8. AI design

### 8.1 Module layout
```
modules/ai/
├── llm.provider.ts          interface LLMProvider { name; generateJSON<T>(req); generateText(req) }
├── providers/gemini.provider.ts
├── providers/groq.provider.ts
├── provider.chain.ts        Gemini → Groq → throws AiUnavailableError
├── ai.queue.ts              p-queue (concurrency 2, intervalCap = AI_RPM_LIMIT/min)
├── fallback.classifier.ts   deterministic keyword rules
├── priority.guardrails.ts   deterministic priority floors (§8.2)
├── context.builder.ts       builds book facts + KB slice (§8.4)
├── kb/                      typed KB constants split by category + company overview + tone
├── prompts/                 classify.prompt.ts, draft.prompt.ts (versioned: PROMPT_VERSION)
├── ai.service.ts            classifyTicket(), draftReply()
└── ai.schemas.ts            Zod schema for model output
```

### 8.2 Classification + priority (one call)
- Trigger: after ticket is saved (async job, never blocks `POST /tickets`).
- Input: subject, description, and the linked book's `status` only (no KB, no history).
- Output JSON (validated with Zod): `{ category, priority, reasoning }`. Use the provider's JSON mode/response schema, `temperature ≈ 0.1`, `max_tokens ≈ 150`.
- Invalid category → `GENERAL_INQUIRY`. Invalid priority → `MEDIUM`. Both marked `FALLBACK` source.
- **Priority rubric given to the model:**
  - **CRITICAL:** payment overdue ≥ ~6 months or "never received", legal/financial threats, data loss, wrong book published
  - **HIGH:** ISBN errors (KB says always high), misprints/defects, book unavailable on a platform, royalty overdue past the 45-day window
  - **MEDIUM:** royalty calculation questions, status/timeline checks, distribution questions
  - **LOW:** how-to/general info (e.g., updating bio/description)
- **Deterministic guardrails** (`priority.guardrails.ts`) run *after* the model: ISBN category with "wrong/duplicate/different/mismatch" → at least HIGH. Printing category with "defect/misprint/blurry/damaged" → at least HIGH. The model can raise but never lower below the floor.
- On success: set `category/priority`, `categorySource/prioritySource = AI`, `aiStatus = DONE`, store `aiReasoning`, emit `ticket:ai_ready`.
- Admin override sets the source to `ADMIN`, and later AI retries must **not** overwrite an admin-set field.

### 8.3 Draft reply
- Trigger: when an admin opens a ticket (`GET /admin/tickets/:id/draft`). If a cached draft exists and no new author message since, return it. Otherwise generate. "Regenerate" button forces a new one.
- Stored in `AiDraft` (with provider, model, prompt version, tokens).
- The UI shows the draft in an **editable textarea** with an "AI draft" badge and a "Regenerate" button. Sending posts `reply` with `draftId`, so the message is marked `aiAssisted`.
- If generation fails: the editor opens **empty** with a banner (see §8.5).

### 8.4 Prompt strategy
**System prompt** (static, short): role (BookLeaf author-support representative), tone rules, hard rules.

Tone rules, taken verbatim from the KB:
1. Empathetic and professional; authors are partners, not customers to be managed.
2. Acknowledge the concern before solutions.
3. Be specific: real numbers, dates, statuses. No vague reassurance.
4. Own BookLeaf's mistakes directly. No corporate deflection.
5. For escalations give a clear timeline ("within 48 hours").
6. Always end with a clear next step.

Hard rules: use **only** the provided facts/policies; never invent numbers, dates or policies; if data is missing, say what the team will check; never blame the author; sign off as "BookLeaf Author Support Team"; plain text, under ~200 words; no markdown.

**Per-call context (small, assembled by `context.builder.ts`):**
1. Company overview (≈60 tokens)
2. **Only the KB section for the ticket's category**
3. **Book facts** for the linked book, computed in code (see below)
4. Ticket subject + description (+ last 2-3 messages only, if any)
5. 1-2 few-shot Query → Response examples for that category (from the PDF table)

**Book facts block (computed server-side, injected as ground truth):**
`title, status, publicationDate, copiesSold, mrp, royaltyPerCopy, totalEarned, paid, pending, lastPayoutDate, printPartner, availableOn, isInProduction, neverPaid (paid=0), belowPayoutThreshold (pending < 1000), nextPayoutWindow` (calendar-quarter end + 45 days; computed relative to today; the assumption is documented in the README). Do **not** send the author's email/phone to the model.

**Category-specific behavior to encode (from the KB sample table):**
- Royalty "none received": acknowledge, explain quarterly cycle + 45-day window, mention bank details check, give next payout date, escalate with 48h if genuinely overdue.
- Royalty "too low": explain net-profit formula (MRP − printing − platform commission − shipping; 80/20 split), offer line-by-line breakdown, don't be defensive.
- ISBN: high priority, escalate to production team, 48h timeline.
- Printing: apologise, request photos, free reprint after verification, 5-7 business days.
- Distribution: stock-sync issue, re-sync triggered, 24-48h.
- Production: use the real stage; if delayed, say why collaboratively (Cover Design = awaiting approval, Proofreading = revision rounds), give a specific timeline.
- General: e.g., metadata update via dashboard/email, 3-5 business days.

### 8.5 Graceful degradation (the "if AI fails" requirement)
Failure ladder per call: **timeout 10s → 1 retry with exponential backoff (honour 429 `retry-after`) → next provider (Groq) → deterministic fallback**.

When all AI paths fail:
- **Ticket creation is unaffected** (201 already returned; classification is async).
- Classification: run `fallback.classifier.ts` (keywords, e.g. royalty/payment/payout → ROYALTY_PAYMENTS; isbn/barcode → ISBN_METADATA; print/blurry/binding/misprint → PRINTING_QUALITY; amazon/flipkart/unavailable/listing → DISTRIBUTION_AVAILABILITY; status/stage/typesetting/cover → BOOK_STATUS_PRODUCTION; else GENERAL_INQUIRY). Priority defaults to MEDIUM, bumped by guardrails. Sources = `FALLBACK`. Set `aiStatus = FAILED`, `needsManualTriage = true`, store `aiError`.
- Admin UI: yellow banner "AI is currently unavailable. Category and priority were assigned by basic rules. Please review." and a **Retry AI** button (`/reclassify`), a "Needs triage" badge in the queue, and a filter for it.
- Draft: editor opens empty with a banner "AI draft unavailable. Write your reply manually", plus **Quick insert snippets** (canned templates from the KB per category) so manual handling is still fast. Replying, notes, status, assign all work without AI.
- A global `AI_ENABLED=false` switch forces this mode (for demo/testing); `/health` reports AI status.
- Optional circuit breaker: after N consecutive failures, skip AI calls for 60 seconds.

### 8.6 Cost awareness (write this up in the README)
- Free-tier model (Flash/Flash-Lite), `max_tokens` caps on every call.
- Classification uses ticket text only (no KB). Draft uses only the category's KB slice + facts.
- Drafts are generated **on admin open only** and cached; regenerate is explicit.
- History trimmed to the last 2-3 messages.
- `p-queue` rate limiting to stay under free-tier RPM; bursts queue instead of failing.
- `AiCallLog` records tokens/latency/failures; `/admin/ai/usage` exposes it.
- No PII sent to the model (free tier may use prompts for product improvement).

### 8.7 API key security
Keys only in server env, validated in `config/env.ts`, never logged, never sent to the client, no AI calls from the browser, `.env` git-ignored, `.env.example` committed, and the repo history is checked for leaks before submission.

### 8.8 Evaluation script
`server/scripts/ai-eval.ts` runs the 6 PDF sample queries through classify + draft and prints category, priority and the draft, so you can tune prompts and show results in the README.

---

## 9. Real-time (Socket.IO)

- Handshake auth: `io(url, { auth: { token } })`; server middleware verifies the JWT and attaches the user. Reject on failure.
- Rooms: `user:{userId}` (author), `admins`.
- Events (server → client):

| Event | To | Payload |
|---|---|---|
| `ticket:created` | `admins` | ticket summary |
| `ticket:updated` | author room + `admins` | `{ticketId, status, category, priority, assignedTo}` |
| `ticket:message` | author room + `admins` | public message (reply / author follow-up) |
| `ticket:note` | `admins` only | internal note |
| `ticket:ai_ready` | `admins` | `{ticketId, category, priority, aiStatus}` |

- `RealtimeGateway` is the only class that emits. Services call `gateway.ticketUpdated(...)`.
- Client: `SocketProvider` connects on login, disconnects on logout, reconnects automatically. Hooks (`useTicketRealtime`) update the TanStack Query cache; show a small "Live / Reconnecting" indicator. On reconnect, invalidate queries to catch missed events.
- Toast for authors: "New response on BL-1042". Admins get a toast for new tickets, plus a subtle highlight on new queue rows.

---

## 10. Frontend pages and UX

### 10.1 Shared
Login page (with a demo-credentials hint), protected routes by role, app shell (sidebar + topbar + user menu + logout), consistent status/priority/category badges, skeleton loaders, empty states, error boundary, toasts, responsive layout, 401 interceptor redirects to login.

**Badge colors:** Critical = red, High = orange, Medium = amber, Low = slate. Status: Open = blue, In Progress = violet, Resolved = green, Closed = gray.

### 10.2 Author: My Books
Cards or table with title, ISBN (shown as stored, including `XXXX` placeholders), genre, publication date, status, MRP, copies sold, royalty earned / paid / pending. Summary strip at top (total earned, paid, pending). **Edge cases:**
- In production (BK013, BK015): show "Not yet published", "—" for MRP/royalty, and a **production stage tracker** (Manuscript → Editing → Cover Design → Typesetting → Proofreading → ISBN → Printing → Distribution → Live) with the current stage highlighted.
- Zero payout ever (last payout date null): "No payout yet".
- Pending below ₹1,000 (BK016: ₹850): note "Below ₹1,000 minimum payout; rolls over to next quarter".
- Author with no books: empty state.
- Format money as ₹ with Indian digit grouping; show available platforms as chips.

### 10.3 Author: Submit a Support Query
Fields: book dropdown (**General / Account Level** + all the author's books including in-production ones), subject, description, **file attachment UI** (drag & drop, shows filename/size, remove button; UI only, metadata stored; real upload = bonus). Zod validation with inline errors, character counters, submit loading state, success toast, redirect to the ticket. No AI result is shown to the author, and ticket creation never waits for AI.

### 10.4 Author: My Tickets
Paginated list (ticket number, subject, book, status badge, last updated), status filter, empty state. Ticket detail shows a conversation thread: original query, admin replies (with timestamps, "BookLeaf Support" as sender), live updates via Socket.IO. **Never shows internal notes, AI category, priority or reasoning.**

### 10.5 Admin: Dashboard header
Stat cards from `/admin/stats`: open, in progress, unassigned, overdue, "needs triage".

### 10.6 Admin: Ticket Queue
TanStack Table, server-side pagination/sorting/filtering. Filters: status, category, priority, assigned (me / unassigned / anyone), date range, text search, "needs triage". **Default sort = urgency:** unresolved first, priority weight (Critical→Low), then oldest first. Visual urgency: priority badge, an **age column** ("3d 4h"), overdue highlight (SLA: Critical 24h, High 48h, Medium 5d, Low 7d without first response), "AI" vs "Manual" source marker on category/priority, and live row insertion on `ticket:created`.

### 10.7 Admin: Ticket Detail
Two-column layout:
- **Left:** conversation thread (author messages + public replies + internal notes in a visually distinct style), author and book facts card (royalty numbers, status).
- **Right:** controls: status dropdown, **category dropdown (AI-suggested badge + override)**, **priority dropdown (override)**, assignee ("Assign to me" button + dropdown), AI reasoning (collapsible).
- **Reply composer:** AI draft pre-filled and editable, badges for "AI draft" / "Edited", Regenerate, Send reply (confirm), and the fallback banner with manual entry and snippets when AI fails.
- **Internal notes** tab with an "Only visible to admins" label.

---

## 11. Seed data (from `bookleaf_sample_data.json`)

- Seed all **10 authors and 18 books** exactly as given (the JSON uses a curly apostrophe in "Durga’s Daughters", so keep UTF-8). Parse dates; null values stay null.
- Create a **User per author** (email from JSON, password `Test@1234`) and **2 admins** (`admin@bookleaf.com`, `ops@bookleaf.com`, password `Admin@1234`). Put all credentials in the README.
- Seed **~8-10 sample tickets** across categories/statuses/priorities (with pre-set classification) so the queue and drafts are demo-ready even if AI is down. Include: Ananya (no royalty yet), Kavita (₹850 below threshold, plus a typesetting query on BK015), Sneha (BK013 in cover design), Diya (ISBN mismatch), Priya (a resolved ticket with a reply).
- The seed script must be idempotent (`upsert`).

**Data observations to handle gracefully:**
- `total_royalty_earned = copies_sold × royalty_per_copy` for all published books. Keep stored values as source of truth.
- BK013 and BK015 are in production but already have an ISBN, even though the KB lists ISBN assignment *after* Proofreading. Display as-is and don't treat it as an error.
- The dataset's payout dates are in 2025 while the app runs in 2026, so compute "next payout window" dynamically from today's date and never hardcode.
- Royalty per copy (e.g. ₹35 on ₹399) is the author's share, so the AI should not recompute the net-profit formula from it. Use the KB explanation and offer a breakdown.

---

## 12. Testing

Vitest + Supertest, minimal but meaningful: login success/failure; author cannot read another author's ticket; author gets 403 on admin routes; internal notes never returned to authors; pagination meta; ticket creation succeeds when the AI provider throws (**fallback test**); admin override isn't overwritten by an AI retry; priority guardrail floors; Zod rejects bad input with 400 and the standard error shape.

---

## 13. Documentation deliverables

**README.md:** overview, live URL + test credentials, local setup (env, `prisma migrate`, seed, run), architecture and why, layering diagram, **AI integration** (model choice justification, prompt strategy, KB slicing, fallback ladder, cost management, API key handling), real-time design, API docs (link to `/api/docs` Swagger plus an endpoint table), testing, known limitations, future improvements.

**Model justification:** Gemini Flash has a free tier without billing, fast responses, native JSON-schema output, and strong instruction-following for short replies. The provider interface means swapping to Claude Haiku or gpt-4o-mini in production is one new class plus env vars.

**openapi.yaml** served by swagger-ui-express at `/api/docs`.

**WRITEUP.md (max 1 page):** what you prioritised (ticket flow + AI + fallback), trade-offs (free-tier model, polling-free Socket.IO on a single instance, UI-only attachments), production evolution (BullMQ job queue for AI, Socket.IO Redis adapter for multiple instances, real file storage on S3, audit log, RAG over a larger KB, refresh tokens, SLA alerts, analytics on AI draft edit-rate, evals).

---

## 14. Submission checklist

- [ ] Private repo; collaborator added once BookLeaf sends the email
- [ ] Clean, incremental commits (conventional messages)
- [ ] No secrets in code or git history; `.env.example` present
- [ ] Live URL deployed and pre-seeded; author + admin credentials in README
- [ ] Both portals work end-to-end; real-time verified with two browsers
- [ ] AI fallback demonstrated (`AI_ENABLED=false` still allows full manual flow)
- [ ] README, API docs, WRITEUP.md complete
- [ ] You can explain every line (review all generated code)
- [ ] Hit the live URL right before submitting (free hosts sleep)

---

## 15. Build phases (one Antigravity prompt each, test after each, commit after each)

1. Server scaffold: config/env, logger, errors, middleware, app/server, health route
2. Prisma schema + migration + idempotent seed from JSON
3. Auth module (login, `/me`, JWT, authenticate/requireRole) + tests
4. Books module (author-scoped, pagination)
5. Tickets module (create, list with filters/pagination, detail, messages, ownership)
6. Admin module (patch/override, assign, notes, reply, stats)
7. Socket.IO gateway + events wired into services
8. AI module: providers, chain, queue, prompts, KB, guardrails, fallback, draft caching, usage log, eval script
9. Client scaffold: Vite, Tailwind, shadcn, router, providers, auth, layouts
10. Author pages: Books, Submit Query, My Tickets (+ realtime)
11. Admin pages: Queue, Ticket detail, composer, notes, fallback banners (+ realtime)
12. Tests, OpenAPI, README, WRITEUP, deploy, smoke test both roles

**If time runs short, cut in this order:** real file upload, dark mode, circuit breaker, Groq secondary provider, Postman collection. **Never cut:** ticket lifecycle, classification, priority, draft, AI fallback, RBAC/ownership, pagination, Socket.IO updates, seed edge cases, README.
