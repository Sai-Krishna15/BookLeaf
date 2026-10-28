import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initSocketServer, closeSocketServer } from './realtime/socket';
import { initRealtimeGateway } from './realtime/gateway';

const app = createApp();
// Plain http.Server so Socket.IO can attach to it.
const server = http.createServer(app);

// Initialize Socket.IO and Gateway (PROJECT_CONTEXT §9)
const io = initSocketServer(server);
initRealtimeGateway(io);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, `BookLeaf server listening on :${env.PORT}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully');

  await closeSocketServer();

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during server close');
      process.exit(1);
    }
    process.exit(0);
  });

  // Force exit if connections hang.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException');
});
