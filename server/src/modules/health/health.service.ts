import { env } from '../../config/env';

export type DependencyState = 'up' | 'down' | 'not_configured';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    // Assumption: DB check is wired in Phase 2 once Prisma exists.
    database: DependencyState;
    ai: { enabled: boolean; primary: 'gemini'; secondary: 'groq' | null; mode: 'ai' | 'manual_fallback' };
  };
}

export const healthService = {
  getStatus(): HealthReport {
    const aiOn = env.AI_ENABLED && Boolean(env.GEMINI_API_KEY);
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: 'not_configured',
        ai: {
          enabled: aiOn,
          primary: 'gemini',
          secondary: env.GROQ_API_KEY ? 'groq' : null,
          mode: aiOn ? 'ai' : 'manual_fallback',
        },
      },
    };
  },
};
