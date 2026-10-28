import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { ticketCreateRateLimiter } from '../../middleware/rateLimiter';
import { ticketsController } from './tickets.controller';
import {
  adminListQuerySchema,
  authorListQuerySchema,
  createMessageBodySchema,
  createTicketBodySchema,
  ticketIdParamSchema,
} from './tickets.schema';

/**
 * Mounted at /api/v1/tickets in app.ts, AFTER the global authenticate middleware.
 * List query validation is role-specific: AUTHOR query schema for authors,
 * ADMIN query schema for admins. We handle this in the controller/service since
 * a single route must accept both; we validate with the union of both schemas
 * (paginationQuerySchema fields are shared) — per-role stricter validation lives
 * in the service layer (e.g., admins-only filters are simply ignored for authors).
 *
 * For simplicity the routes apply the admin schema (superset) to the query and
 * the service silently ignores admin-only filters for author callers.
 */
export const ticketsRouter = Router();

// POST /tickets – AUTHOR only, per-user rate limit
ticketsRouter.post(
  '/',
  ticketCreateRateLimiter,
  validate({ body: createTicketBodySchema }),
  ticketsController.create,
);

// GET /tickets – any authenticated role; admin schema is the superset
ticketsRouter.get('/', validate({ query: adminListQuerySchema }), ticketsController.list);

// GET /tickets/:id/messages — must be BEFORE /:id to avoid capturing "messages" as an id
ticketsRouter.get(
  '/:id/messages',
  validate({ params: ticketIdParamSchema }),
  ticketsController.getMessages,
);

// POST /tickets/:id/messages – AUTHOR follow-up
ticketsRouter.post(
  '/:id/messages',
  validate({ params: ticketIdParamSchema, body: createMessageBodySchema }),
  ticketsController.addMessage,
);

// GET /tickets/:id
ticketsRouter.get('/:id', validate({ params: ticketIdParamSchema }), ticketsController.getById);
