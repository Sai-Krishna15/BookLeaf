import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { UnauthorizedError } from '../../common/errors';
import type { AuthUser } from '../../common/jwt';
import type {
  AdminListQuery,
  AuthorListQuery,
  CreateMessageBody,
  CreateTicketBody,
  TicketIdParam,
} from './tickets.schema';
import { ticketsService } from './tickets.service';

const userOf = (req: Request): AuthUser => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const ticketsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as CreateTicketBody;
    const dto = await ticketsService.create(userOf(req), body);
    res.status(201).json(dto);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const user = userOf(req);
    const query = req.query as unknown as AuthorListQuery | AdminListQuery;
    res.status(200).json(await ticketsService.list(user, query));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as TicketIdParam;
    res.status(200).json(await ticketsService.getById(userOf(req), id));
  }),

  getMessages: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as TicketIdParam;
    const messages = await ticketsService.getMessages(userOf(req), id);
    res.status(200).json(messages);
  }),

  addMessage: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as TicketIdParam;
    const body = req.body as CreateMessageBody;
    const dto = await ticketsService.addMessage(userOf(req), id, body);
    res.status(201).json(dto);
  }),
};
