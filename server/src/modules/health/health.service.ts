import { env } from '../../config/env';
import { healthRepository } from './health.repository';
import { getProviderChain, type CircuitBreakerState } from '../ai/provider.chain';

export type DatabaseState = 'connected' | 'unreachable';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  checks: {
    database: DatabaseState;
    ai: {
      enabled: boolean;
      primary: 'gemini';
      secondary: 'groq' | null;
      mode: 'ai' | 'manual_fallback';
      configuredProviders: string[];
      circuitBreaker: CircuitBreakerState;
    };
  };
}

export const healthService = {
  async getStatus(): Promise<HealthReport> {
    const dbUp = await healthRepository.pingDatabase();
    const chain = getProviderChain();
    const breakerState = chain.getCircuitBreakerState();
    const configuredProviders = chain.getProviders().map((p) => p.name);
    const aiOn = env.AI_ENABLED && Boolean(env.GEMINI_API_KEY);

    return {
      // Assumption: AI being off is a supported mode, not degradation. Only the DB affects status.
      status: dbUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: dbUp ? 'connected' : 'unreachable',
        ai: {
          enabled: aiOn,
          primary: 'gemini',
          secondary: env.GROQ_API_KEY ? 'groq' : null,
          mode: aiOn ? 'ai' : 'manual_fallback',
          configuredProviders,
          circuitBreaker: breakerState,
        },
      },
    };
  },
};

