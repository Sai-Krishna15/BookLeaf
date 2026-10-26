import { Router } from 'express';
import { healthController } from './health.controller';

export const healthRouter = Router();

// Public: no authenticate middleware (PROJECT_CONTEXT §7).
healthRouter.get('/', healthController.get);
