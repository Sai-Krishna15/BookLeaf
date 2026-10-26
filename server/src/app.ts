import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { API_PREFIX, JSON_BODY_LIMIT, REQUEST_ID_HEADER } from './config/constants';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { globalRateLimiter } from './middleware/rateLimiter';
import { requestId } from './middleware/requestId';
import { healthRouter } from './modules/health/health.routes';
import { authProtectedRouter, authPublicRouter } from './modules/auth/auth.routes';
import { authenticate } from './middleware/authenticate';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Assumption: deployed behind one reverse proxy (Render/Railway) so rate limiting sees client IPs.
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      customProps: (req) => ({ requestId: (req as express.Request).requestId }),
      // Only log safe request fields; auth headers and bodies are never serialized.
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
      exposedHeaders: [REQUEST_ID_HEADER],
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(API_PREFIX, globalRateLimiter);

  // ---- PUBLIC routes: the only two that skip authentication (PROJECT_CONTEXT §7) ----
  app.use(`${API_PREFIX}/health`, healthRouter);
  app.use(`${API_PREFIX}/auth`, authPublicRouter); // POST /login

  // ---- PROTECTED by default: everything mounted below this line requires a valid JWT. ----
  // To add a route, mount it below. Never mount a new router above this line unless it must be public.
  app.use(API_PREFIX, authenticate);
  app.use(`${API_PREFIX}/auth`, authProtectedRouter); // GET /me
  // Phase 4+: books, tickets, admin (admin routers also use requireRole('ADMIN')).

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
