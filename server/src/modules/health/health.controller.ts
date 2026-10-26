import type { Request, Response } from 'express';
import { asyncHandler } from '../../common/asyncHandler';
import { healthService } from './health.service';

export const healthController = {
  // 200 even when degraded so the probe itself stays readable; body carries the DB state.
  get: asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await healthService.getStatus());
  }),
};
