import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  AiInvalidResponseError,
  AiRateLimitError,
  AiTimeoutError,
  AiUnavailableError,
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from './llm.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN';
  consecutiveFailures: number;
  resetAt?: string;
}

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

export class ProviderChain {
  private readonly providers: LLMProvider[];
  private consecutiveFailures = 0;
  private breakerState: 'CLOSED' | 'OPEN' = 'CLOSED';
  private cooldownUntil = 0;

  constructor(customProviders?: LLMProvider[]) {
    if (customProviders) {
      this.providers = customProviders;
    } else {
      const list: LLMProvider[] = [];
      if (env.GEMINI_API_KEY) {
        list.push(new GeminiProvider());
      }
      if (env.GROQ_API_KEY) {
        list.push(new GroqProvider());
      }
      this.providers = list;
    }
  }

  getCircuitBreakerState(): CircuitBreakerState {
    this.checkCooldownTransition();
    return {
      state: this.breakerState,
      consecutiveFailures: this.consecutiveFailures,
      ...(this.breakerState === 'OPEN'
        ? { resetAt: new Date(this.cooldownUntil).toISOString() }
        : {}),
    };
  }

  resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.breakerState = 'CLOSED';
    this.cooldownUntil = 0;
  }

  getProviders(): readonly LLMProvider[] {
    return this.providers;
  }

  async generateJSON<T>(req: LLMRequest): Promise<LLMResponse<T>> {
    return this.executeWithFailover((provider) => provider.generateJSON<T>(req));
  }

  async generateText(req: LLMRequest): Promise<LLMResponse<string>> {
    return this.executeWithFailover((provider) => provider.generateText(req));
  }

  private checkCooldownTransition(): void {
    if (this.breakerState === 'OPEN' && Date.now() >= this.cooldownUntil) {
      // Half-open / cooldown elapsed: allows trial call
      this.breakerState = 'CLOSED';
      this.consecutiveFailures = 0;
    }
  }

  private async executeWithFailover<T>(
    operation: (provider: LLMProvider) => Promise<LLMResponse<T>>,
  ): Promise<LLMResponse<T>> {
    this.checkCooldownTransition();

    if (this.breakerState === 'OPEN') {
      logger.warn(
        { cooldownUntil: new Date(this.cooldownUntil).toISOString() },
        'AI circuit breaker is OPEN, failing fast to fallback',
      );
      throw new AiUnavailableError('Circuit breaker is open. AI is temporarily paused.');
    }

    if (this.providers.length === 0) {
      throw new AiUnavailableError('No AI providers configured or available');
    }

    const errors: Array<{ provider: string; error: Error }> = [];

    for (const provider of this.providers) {
      try {
        const result = await this.executeWithRetry(provider, operation);
        // Successful call resets consecutive failure counter & circuit breaker
        this.consecutiveFailures = 0;
        this.breakerState = 'CLOSED';
        return result;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push({ provider: provider.name, error });
        logger.warn(
          { provider: provider.name, error: error.message },
          `Provider ${provider.name} failed. Attempting next provider if available.`,
        );
      }
    }

    // If we reach here, all configured providers failed
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.breakerState = 'OPEN';
      this.cooldownUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      logger.error(
        { consecutiveFailures: this.consecutiveFailures, cooldownUntil: new Date(this.cooldownUntil).toISOString() },
        `AI circuit breaker TRIPPED to OPEN after ${this.consecutiveFailures} consecutive failures`,
      );
    }

    const summary = errors.map((e) => `${e.provider}: ${e.error.message}`).join('; ');
    throw new AiUnavailableError(`All AI providers failed: ${summary}`);
  }

  private async executeWithRetry<T>(
    provider: LLMProvider,
    operation: (provider: LLMProvider) => Promise<LLMResponse<T>>,
  ): Promise<LLMResponse<T>> {
    const maxRetries = env.AI_MAX_RETRIES;
    let attempt = 0;

    while (true) {
      try {
        return await operation(provider);
      } catch (err: unknown) {
        const isRateLimit = err instanceof AiRateLimitError;
        const isTimeout = err instanceof AiTimeoutError;
        const isInvalidResponse = err instanceof AiInvalidResponseError;

        // Do NOT retry on 4xx invalid request / bad response format
        if (isInvalidResponse) {
          throw err;
        }

        if (attempt >= maxRetries) {
          throw err;
        }

        attempt++;

        let backoffMs: number;
        if (isRateLimit && err.retryAfterMs && err.retryAfterMs > 0) {
          backoffMs = err.retryAfterMs;
        } else {
          // Exponential backoff with jitter: 200ms * 2^(attempt - 1) + 0..100ms jitter
          const base = 200 * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 100;
          backoffMs = Math.min(base + jitter, 5000);
        }

        logger.info(
          { provider: provider.name, attempt, maxRetries, backoffMs, error: (err as Error).message },
          `Retrying AI provider ${provider.name} after backoff`,
        );

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
}

let defaultChainInstance: ProviderChain | null = null;

export function getProviderChain(): ProviderChain {
  if (!defaultChainInstance) {
    defaultChainInstance = new ProviderChain();
  }
  return defaultChainInstance;
}

export function setProviderChain(chain: ProviderChain | null): void {
  defaultChainInstance = chain;
}
