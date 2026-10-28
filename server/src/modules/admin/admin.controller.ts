import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { UnauthorizedError } from '../../common/errors';
import type { PatchTicketBody, NoteBody, ReplyBody, AdminTicketIdParam, AiUsageQuery } from './admin.schema';
import { adminService } from './admin.service';
import { getAiUsageReport } from '../ai/ai.usage.service';

const adminIdOf = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

export const adminController = {
  // PATCH /admin/tickets/:id
  patchTicket: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AdminTicketIdParam;
    const body = req.body as PatchTicketBody;
    const adminId = adminIdOf(req);
    const dto = await adminService.patchTicket(adminId, id, body);
    res.status(200).json(dto);
  }),

  // POST /admin/tickets/:id/assign-me
  assignMe: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AdminTicketIdParam;
    const adminId = adminIdOf(req);
    const dto = await adminService.assignMe(adminId, id);
    res.status(200).json(dto);
  }),

  // POST /admin/tickets/:id/notes
  createNote: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AdminTicketIdParam;
    const body = req.body as NoteBody;
    const adminId = adminIdOf(req);
    const dto = await adminService.createNote(adminId, id, body);
    res.status(201).json(dto);
  }),

  // POST /admin/tickets/:id/reply
  adminReply: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AdminTicketIdParam;
    const body = req.body as ReplyBody;
    const adminId = adminIdOf(req);
    const result = await adminService.adminReply(adminId, id, body);
    res.status(201).json(result);
  }),

  // GET /admin/admins
  listAdmins: asyncHandler(async (_req: Request, res: Response) => {
    const admins = await adminService.listAdmins();
    res.status(200).json(admins);
  }),

  // GET /admin/stats
  getStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await adminService.getStats();
    res.status(200).json(stats);
  }),

  // POST /admin/tickets/:id/reclassify
  reclassify: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as AdminTicketIdParam;
    const dto = await adminService.reclassifyTicket(id);
    res.status(202).json(dto);
  }),

  // GET /admin/ai/usage
  getAiUsage: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as AiUsageQuery;
    const days = query.days !== undefined ? Number(query.days) : 7;
    const report = await getAiUsageReport(days);
    res.status(200).json(report);
  }),
};
