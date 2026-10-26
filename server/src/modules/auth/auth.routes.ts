import { Router } from 'express';
import { loginRateLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';
import { authController } from './auth.controller';
import { loginBodySchema } from './auth.schema';

/** Mounted BEFORE the global `authenticate`: reachable without a token. */
export const authPublicRouter = Router();
authPublicRouter.post('/login', loginRateLimiter, validate({ body: loginBodySchema }), authController.login);

/** Mounted AFTER the global `authenticate`: protected by default. */
export const authProtectedRouter = Router();
authProtectedRouter.get('/me', authController.me);
