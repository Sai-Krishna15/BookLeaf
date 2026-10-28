import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';

export interface LogAiCallParams {
  kind: 'CLASSIFY' | 'DRAFT';
  provider: string;
  model: string;
  ticketId?: string | null;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  success: boolean;
  errorCode?: string | null;
}

/**
 * Persists an AI call audit record in AiCallLog.
 *
 * Logging failures are non-fatal and will never propagate to the caller or fail the request.
 */
export async function logAiCall(params: LogAiCallParams): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        kind: params.kind,
        provider: params.provider,
        model: params.model,
        ticketId: params.ticketId ?? null,
        latencyMs: Math.max(0, Math.round(params.latencyMs)),
        inputTokens: params.inputTokens ?? null,
        outputTokens: params.outputTokens ?? null,
        success: params.success,
        errorCode: params.errorCode ?? null,
      },
    });
  } catch (err: unknown) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), params },
      'Failed to record AiCallLog entry in database',
    );
  }
}
