import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderChain } from '../src/modules/ai/provider.chain';
import type { LLMProvider, LLMRequest, LLMResponse } from '../src/modules/ai/llm.provider';
import { AiInvalidResponseError, AiUnavailableError } from '../src/modules/ai/llm.provider';

class MockProvider implements LLMProvider {
  name: string;
  model: string;
  callCount = 0;
  calls: LLMRequest[] = [];
  responseQueue: Array<LLMResponse<unknown> | Error> = [];

  constructor(name = 'mock-primary', model = 'mock-model-v1') {
    this.name = name;
    this.model = model;
  }

  queueError(err: Error) {
    this.responseQueue.push(err);
  }

  async generateJSON<T>(req: LLMRequest): Promise<LLMResponse<T>> {
    this.callCount++;
    this.calls.push(req);
    const item = this.responseQueue.shift();
    if (item instanceof Error) {
      throw item;
    }
    return {
      content: {} as T,
      rawText: '{}',
      inputTokens: 10,
      outputTokens: 10,
    };
  }

  async generateText(req: LLMRequest): Promise<LLMResponse<string>> {
    this.callCount++;
    this.calls.push(req);
    const item = this.responseQueue.shift();
    if (item instanceof Error) {
      throw item;
    }
    return {
      content: 'Mock text',
      rawText: 'Mock text',
      inputTokens: 10,
      outputTokens: 10,
    };
  }
}

function listEndpoints(app: any) {
  const routes: Array<{ path: string; method: string }> = [];
  const knownPrefixes = [
    '/api/v1/health',
    '/api/v1/auth',
    '/api/v1/books',
    '/api/v1/tickets',
    '/api/v1/admin',
  ];

  for (const layer of app.router.stack) {
    if (layer.name === 'router' && layer.handle?.stack) {
      let matchedPrefix = '';
      for (const prefix of knownPrefixes) {
        if (layer.matchers?.[0]?.(prefix)) {
          matchedPrefix = prefix;
          break;
        }
      }
      for (const subLayer of layer.handle.stack) {
        if (subLayer.route) {
          const subPath = subLayer.route.path === '/' ? '' : subLayer.route.path;
          const fullPath = (matchedPrefix + subPath).replace(/\/+/g, '/');
          for (const method of Object.keys(subLayer.route.methods)) {
            routes.push({ path: fullPath, method: method.toUpperCase() });
          }
        }
      }
    }
  }
  return routes;
}

describe('Security Audit & Authentication Guards', () => {
  it('enumerates all Express routes and asserts that unauthenticated requests get 401 (except /health and /auth/login)', async () => {
    const app = createApp();
    const routes = listEndpoints(app);

    expect(routes.length).toBeGreaterThanOrEqual(18);

    for (const r of routes) {
      const isPublic = r.path === '/api/v1/health' || r.path === '/api/v1/auth/login';
      const testPath = r.path.replace(':id', 'test-id-123');
      const method = r.method.toLowerCase();

      // @ts-expect-error supertest method indexing
      const res = await request(app)[method](testPath);

      if (isPublic) {
        expect(res.status).not.toBe(401);
      } else {
        expect(res.status, `Expected 401 for unauthenticated ${r.method} ${r.path}`).toBe(401);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    }
  });

  it('verifies AI circuit breaker excludes 4xx client errors from tripping', async () => {
    const mock = new MockProvider();
    const chain = new ProviderChain([mock]);

    // Send 5 consecutive 4xx invalid response errors
    for (let i = 0; i < 5; i++) {
      mock.queueError(new AiInvalidResponseError('Client validation / prompt formatting error', 400));
      await expect(
        chain.generateJSON({ systemPrompt: 'test system', userPrompt: 'test user' }),
      ).rejects.toThrow(AiUnavailableError);
    }

    // Circuit breaker state must remain CLOSED with 0 consecutive failures
    const state = chain.getCircuitBreakerState();
    expect(state.state).toBe('CLOSED');
    expect(state.consecutiveFailures).toBe(0);
  });
});
