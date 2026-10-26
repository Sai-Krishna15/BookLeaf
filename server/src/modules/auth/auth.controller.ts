import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { UnauthorizedError } from '../../common/errors';
import type { LoginBody } from './auth.schema';
import { authService } from './auth.service';

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginBody; // validated + normalized by `validate`
    res.status(200).json(await authService.login(email, password));
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    res.status(200).json(await authService.me(req.user.id));
  }),
};
