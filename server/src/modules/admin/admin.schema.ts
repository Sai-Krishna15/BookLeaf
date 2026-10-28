import { z } from 'zod';

// ---------------------------------------------------------------------------
// PATCH /admin/tickets/:id
// ---------------------------------------------------------------------------

export const patchTicketBodySchema = z
  .object({
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
    /**
     * null = unassign the ticket.
     * string = assign to user with that id.
     */
    assignedToId: z.string().nullable().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.category !== undefined ||
      data.priority !== undefined ||
      'assignedToId' in data,
    { message: 'At least one field must be provided' },
  );

export type PatchTicketBody = z.infer<typeof patchTicketBodySchema>;

// ---------------------------------------------------------------------------
// POST /admin/tickets/:id/notes
// ---------------------------------------------------------------------------

export const noteBodySchema = z.object({
  body: z.string().min(1, 'Note body cannot be empty').max(5000, 'Note body must be at most 5000 characters'),
});

export type NoteBody = z.infer<typeof noteBodySchema>;

// ---------------------------------------------------------------------------
// POST /admin/tickets/:id/reply
// ---------------------------------------------------------------------------

export const replyBodySchema = z.object({
  body: z.string().min(1, 'Reply body cannot be empty').max(5000, 'Reply body must be at most 5000 characters'),
  /** Optional: link an AI draft to this reply (marks aiAssisted=true). */
  draftId: z.string().optional(),
});

export type ReplyBody = z.infer<typeof replyBodySchema>;

// ---------------------------------------------------------------------------
// Shared ticket id param
// ---------------------------------------------------------------------------

export const adminTicketIdParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export type AdminTicketIdParam = z.infer<typeof adminTicketIdParamSchema>;
