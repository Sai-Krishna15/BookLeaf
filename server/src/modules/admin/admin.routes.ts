import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { draftRegenerateRateLimiter } from '../../middleware/rateLimiter';
import { adminController } from './admin.controller';
import {
  patchTicketBodySchema,
  noteBodySchema,
  replyBodySchema,
  adminTicketIdParamSchema,
  aiUsageQuerySchema,
} from './admin.schema';

const router = Router();

// All admin routes require ADMIN role (authenticate is applied globally in app.ts before this router)
router.use(requireRole('ADMIN'));

router.patch(
  '/tickets/:id',
  validate({ params: adminTicketIdParamSchema, body: patchTicketBodySchema }),
  adminController.patchTicket,
);

router.post(
  '/tickets/:id/assign-me',
  validate({ params: adminTicketIdParamSchema }),
  adminController.assignMe,
);

router.post(
  '/tickets/:id/notes',
  validate({ params: adminTicketIdParamSchema, body: noteBodySchema }),
  adminController.createNote,
);

router.post(
  '/tickets/:id/reply',
  validate({ params: adminTicketIdParamSchema, body: replyBodySchema }),
  adminController.adminReply,
);

router.get(
  '/tickets/:id/draft',
  validate({ params: adminTicketIdParamSchema }),
  adminController.getDraft,
);

router.post(
  '/tickets/:id/draft/regenerate',
  draftRegenerateRateLimiter,
  validate({ params: adminTicketIdParamSchema }),
  adminController.regenerateDraft,
);

router.post(
  '/tickets/:id/reclassify',
  validate({ params: adminTicketIdParamSchema }),
  adminController.reclassify,
);

router.get('/admins', adminController.listAdmins);

router.get('/stats', adminController.getStats);

router.get(
  '/ai/usage',
  validate({ query: aiUsageQuerySchema }),
  adminController.getAiUsage,
);

export { router as adminRouter };

