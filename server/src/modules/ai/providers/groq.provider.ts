import { env } from '../../../config/env';
import {
  AiInvalidResponseError,
  AiProviderError,
  AiRateLimitError,
  AiTimeoutError,
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from '../llm.provider';

/**
 * Secondary LLM Provider: Groq API (OpenAI-compatible HTTP endpoint).
 *
 * Used as fallback when Gemini fails or is rate-limited.
 * Only enabled when GROQ_API_KEY is configured.
 */
export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? env.GROQ_API_KEY ?? '';
    this.model = model ?? env.GROQ_MODEL;
  }

  async generateJSON<T>(req: LLMRequest): Promise<LLMResponse<T>> {
    const rawRes = await this.executeCall(req, true);

    try {
      const content = JSON.parse(rawRes.rawText) as T;
      return {
        ...rawRes,
        content,
      };
    } catch {
      throw new AiInvalidResponseError('Failed to parse Groq response as JSON');
    }
  }

  async generateText(req: LLMRequest): Promise<LLMResponse<string>> {
    const rawRes = await this.executeCall(req, false);

    return {
      ...rawRes,
      content: rawRes.rawText,
    };
  }

  private async executeCall(req: LLMRequest, jsonMode: boolean): Promise<LLMResponse<null>> {
    if (!this.apiKey) {
      throw new AiInvalidResponseError('GROQ_API_KEY is not configured', 400);
    }

    const timeoutMs = req.timeoutMs ?? env.AI_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (req.signal) {
      req.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? 0.1,
      max_tokens: req.maxOutputTokens ?? 150,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        await this.handleHttpError(res);
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };

      const text = data.choices?.[0]?.message?.content;
      if (text === undefined || text === null) {
        throw new AiInvalidResponseError('Groq response returned no message content');
      }

      return {
        content: null,
        rawText: text.trim(),
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      };
    } catch (err: unknown) {
      if (
        err instanceof AiTimeoutError ||
        err instanceof AiRateLimitError ||
        err instanceof AiProviderError ||
        err instanceof AiInvalidResponseError
      ) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new AiTimeoutError(`Groq request timed out after ${timeoutMs}ms`);
      }

      throw new AiProviderError(500, err instanceof Error ? err.message : 'Unknown network error');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleHttpError(res: Response): Promise<never> {
    let sanitizedMsg = `Groq HTTP ${res.status}`;
    let retryAfterMs: number | undefined;

    const retryHeader = res.headers.get('retry-after');
    if (retryHeader) {
      const parsedSec = Number(retryHeader);
      if (!Number.isNaN(parsedSec) && parsedSec > 0) {
        retryAfterMs = parsedSec * 1000;
      }
    }

    try {
      const errJson = (await res.json()) as { error?: { message?: string; type?: string } };
      if (errJson.error?.message) {
        sanitizedMsg = errJson.error.message.replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED]');
      }
    } catch {
      // Ignore body parsing failures
    }

    if (res.status === 429) {
      throw new AiRateLimitError(sanitizedMsg, retryAfterMs);
    }
    if (res.status >= 500) {
      throw new AiProviderError(res.status, sanitizedMsg);
    }
    throw new AiInvalidResponseError(sanitizedMsg, res.status);
  }
}
