# BookLeaf Client

Interactive author portal and operations triage workspace built with React, Vite, TypeScript, and Tailwind CSS.

## Frontend Architecture

### 1. Technology Choices & Libraries
- **Build & Framework**: Vite + React 18 + TypeScript in strict mode.
- **Design System & Styling**: Tailwind CSS v3.4 + PostCSS with HSL CSS variables, custom typography via `@fontsource/inter`, and Radix UI primitives (`@radix-ui/*`) styled following shadcn/ui conventions.
- **State & Data Fetching**: TanStack Query (`@tanstack/react-query` v5) with query key factories per feature, 30s stale time, window refetch, and 4xx failure bypassing.
- **Form Handling & Validation**: `react-hook-form` with `@hookform/resolvers/zod` and schema-driven field validation.
- **Routing & Guards**: `react-router-dom` v7 `createBrowserRouter` with lazy-loaded route segments, `<RequireAuth>`, and `<RequireRole>` guards.
- **Real-Time Foundation**: `socket.io-client` with typed server/client event interfaces, automated reconnection, and query invalidation on reconnection.

### 2. Directory Structure (`src/`)
```
src/
├── app/
│   ├── layouts/       # AuthorLayout & AdminLayout (collapsible sidebars, topbar, theme toggle)
│   ├── providers/     # QueryProvider, AuthProvider, SocketProvider, ThemeProvider
│   └── router.tsx     # Route definitions, guards, lazy suspense wrappers
├── features/
│   ├── auth/          # Login page, types, auth API, RequireAuth & RequireRole guards
│   ├── books/         # Books catalog, summary, types, API & query keys (Phase 10)
│   ├── tickets/       # Author ticket list, creation form, details, types & API (Phase 10)
│   └── admin/         # Admin ticket queue, triage details, types & API (Phase 11)
├── components/
│   ├── common/        # StatusBadge, PriorityBadge, CategoryBadge, Pagination,
│   │                  # EmptyState, ErrorState, PageHeader, LiveIndicator, ThemeToggle
│   └── ui/            # Reusable shadcn/ui primitives (button, input, card, table, etc.)
├── hooks/             # useAuth, useTheme, useSocketEvent
├── lib/               # api.ts (axios client & ApiError), socket.ts, formatters.ts, utils.ts
└── test/              # Unit & integration test suites (Vitest + React Testing Library)
```

### 3. Authentication & Security
- **Token Storage**: JWT access tokens are stored in `sessionStorage`.
  - *Trade-off*: Survives page refreshes within the active browser tab session, but is cleared immediately when the tab is closed.
  - *XSS Exposure & Mitigation*: Accessible to client-side scripts on the origin; mitigated by server-side CSP headers, strict HTML sanitization, and short token lifespans.
- **Session Hydration**: On mount, `AuthProvider` calls `GET /api/v1/auth/me` with the stored token. If the token is expired or the account no longer exists, the session is cleared and the user is redirected to `/login`.
- **401 Global Interception**: Axios response interceptor intercepts non-login 401s, displays an expiration toast, purges credentials, and routes to `/login`.

### 4. Running Locally
```bash
# Start Vite development server on port 5173
npm run dev

# Run TypeScript checks
npm run typecheck

# Run linter
npm run lint

# Run Vitest test suite
npm test

# Build production bundle
npm run build
```
