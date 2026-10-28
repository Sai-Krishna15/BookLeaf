import { z } from 'zod';
import { paginationQuerySchema } from '../../common/pagination';

// ---------------------------------------------------------------------------
// POST /tickets – create
// ---------------------------------------------------------------------------

const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  /** bytes, max 10 MB */
  size: z.number().int().min(1).max(10 * 1024 * 1024),
  type: z.string().min(1).max(127),
});

export const createTicketBodySchema = z.object({
  bookId: z.string().min(1).max(50).nullable().default(null),
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(150, 'Subject must be at most 150 characters')
    .transform((s) => s.trim()),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be at most 5000 characters')
    .transform((s) => s.trim()),
  attachments: z
    .array(attachmentSchema)
    .max(5, 'At most 5 attachments')
    .optional()
    .default([]),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;

// ---------------------------------------------------------------------------
// GET /tickets – list (shared ticket-id param)
// ---------------------------------------------------------------------------

const ticketIdParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export type TicketIdParam = z.infer<typeof ticketIdParamSchema>;
export { ticketIdParamSchema };

const sortValues = ['newest', 'oldest', 'urgency'] as const;

/** Query string for an AUTHOR listing tickets. */
export const authorListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export type AuthorListQuery = z.infer<typeof authorListQuerySchema>;

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

/** Query string for an ADMIN listing tickets. */
export const adminListQuerySchema = paginationQuerySchema
  .extend({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
    category: z
      .enum([
        'ROYALTY_PAYMENTS',
        'ISBN_METADATA',
        'PRINTING_QUALITY',
        'DISTRIBUTION_AVAILABILITY',
        'BOOK_STATUS_PRODUCTION',
        'GENERAL_INQUIRY',
      ])
      .optional(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    authorId: z.string().max(50).optional(),
    bookId: z.string().max(50).optional(),
    /**
     * me | unassigned | <userId>
     * "me" is resolved in the service layer where req.user is available.
     */
    assignedTo: z.string().max(128).optional(),
    needsManualTriage: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    from: isoDateString.optional(),
    to: isoDateString.optional(),
    q: z.string().max(200).optional(),
    sort: z.enum(sortValues).default('urgency'),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'from must not be after to',
      });
    }
  });

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

// ---------------------------------------------------------------------------
// POST /tickets/:id/messages
// ---------------------------------------------------------------------------

export const createMessageBodySchema = z.object({
  body: z
    .string()
    .min(1, 'Message body cannot be empty')
    .max(5000, 'Message body must be at most 5000 characters'),
});

export type CreateMessageBody = z.infer<typeof createMessageBodySchema>;
