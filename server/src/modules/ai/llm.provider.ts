/**
 * LLM Provider abstractions and typed errors (PROJECT_CONTEXT §8.1).
 *
 * SECURITY: Never include API keys in error messages, error properties, or logs.
 */

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface LLMResponse<T = unknown> {
  content: T;
  rawText: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generateJSON<T>(req: LLMRequest): Promise<LLMResponse<T>>;
  generateText(req: LLMRequest): Promise<LLMResponse<string>>;
}

// ---------------------------------------------------------------------------
// Typed AI Provider Errors
// ---------------------------------------------------------------------------

export class AiTimeoutError extends Error {
  constructor(message = 'AI provider request timed out') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

export class AiRateLimitError extends Error {
  readonly retryAfterMs?: number;

  constructor(message = 'AI provider rate limit reached (429)', retryAfterMs?: number) {
    super(message);
    this.name = 'AiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class AiProviderError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message = 'AI provider server error (5xx)') {
    super(message);
    this.name = 'AiProviderError';
    this.statusCode = statusCode;
  }
}

export class AiInvalidResponseError extends Error {
  readonly statusCode?: number;

  constructor(message = 'AI provider returned an invalid response', statusCode?: number) {
    super(message);
    this.name = 'AiInvalidResponseError';
    this.statusCode = statusCode;
  }
}

export class AiUnavailableError extends Error {
  constructor(message = 'All AI providers are currently unavailable') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}
