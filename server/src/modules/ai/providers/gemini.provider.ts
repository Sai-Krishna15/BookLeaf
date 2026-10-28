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
 * Primary LLM Provider: Google Gemini API (v1beta REST API).
 *
 * Why REST over the Node SDK:
 * 1. Native Node.js `fetch` with AbortSignal gives deterministic timeout and cancellation handling.
 * 2. API key is passed via the `x-goog-api-key` header rather than URL query parameters or SDK config objects,
 *    preventing accidental token leakage in URL logs, proxy traces, or stack traces.
 * 3. Exact control over HTTP status codes (distinguishing 429 rate limits, 4xx schema/prompt invalidity,
 *    and 5xx server errors).
 * 4. Zero additional heavy SDK dependencies, matching the project's minimal footprint.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? env.GEMINI_API_KEY ?? '';
    this.model = model ?? env.GEMINI_MODEL;
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
  }

  async generateJSON<T>(req: LLMRequest): Promise<LLMResponse<T>> {
    const rawRes = await this.executeCall(req, {
      responseMimeType: 'application/json',
      responseSchema: req.jsonSchema,
    });

    try {
      const content = JSON.parse(rawRes.rawText) as T;
      return {
        ...rawRes,
        content,
      };
    } catch {
      throw new AiInvalidResponseError('Failed to parse Gemini response as JSON');
    }
  }

  async generateText(req: LLMRequest): Promise<LLMResponse<string>> {
    const rawRes = await this.executeCall(req, {
      responseMimeType: 'text/plain',
    });

    return {
      ...rawRes,
      content: rawRes.rawText,
    };
  }

  private async executeCall(
    req: LLMRequest,
    formatConfig: { responseMimeType: string; responseSchema?: Record<string, unknown> },
  ): Promise<LLMResponse<null>> {
    if (!this.apiKey) {
      throw new AiInvalidResponseError('GEMINI_API_KEY is not configured', 400);
    }

    const timeoutMs = req.timeoutMs ?? env.AI_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // If caller provided an AbortSignal, abort when that aborts too
    if (req.signal) {
      req.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: req.userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: req.systemPrompt }],
      },
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        maxOutputTokens: req.maxOutputTokens ?? 150,
        responseMimeType: formatConfig.responseMimeType,
        ...(formatConfig.responseSchema ? { responseSchema: formatConfig.responseSchema } : {}),
      },
    };

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        await this.handleHttpError(res);
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (text === undefined || text === null) {
        throw new AiInvalidResponseError('Gemini response returned no text candidates');
      }

      return {
        content: null,
        rawText: text.trim(),
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      };
    } catch (err: unknown) {
      if (err instanceof AiTimeoutError || err instanceof AiRateLimitError ||
          err instanceof AiProviderError || err instanceof AiInvalidResponseError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new AiTimeoutError(`Gemini request timed out after ${timeoutMs}ms`);
      }

      throw new AiProviderError(500, err instanceof Error ? err.message : 'Unknown network error');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleHttpError(res: Response): Promise<never> {
    let sanitizedMsg = `Gemini HTTP ${res.status}`;
    let retryAfterMs: number | undefined;

    const retryHeader = res.headers.get('retry-after');
    if (retryHeader) {
      const parsedSec = Number(retryHeader);
      if (!Number.isNaN(parsedSec) && parsedSec > 0) {
        retryAfterMs = parsedSec * 1000;
      }
    }

    try {
      const errJson = (await res.json()) as {
        error?: {
          message?: string;
          status?: string;
          details?: Array<{ retryDelay?: string; [key: string]: unknown }>;
        };
      };
      if (errJson.error?.message) {
        sanitizedMsg = errJson.error.message.replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
      }
      if (!retryAfterMs && errJson.error?.details) {
        for (const d of errJson.error.details) {
          if (d.retryDelay && typeof d.retryDelay === 'string') {
            const sec = parseFloat(d.retryDelay.replace('s', ''));
            if (!Number.isNaN(sec)) {
              retryAfterMs = Math.round(sec * 1000);
            }
          }
        }
      }
    } catch {
      // Ignore body parsing failures on error responses
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
