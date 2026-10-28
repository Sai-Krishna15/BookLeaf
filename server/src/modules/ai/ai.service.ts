import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { domainEvents } from '../../common/domainEvents';
import { ConflictError, NotFoundError } from '../../common/errors';
import { AiStatus, FieldSource, Priority, TicketCategory } from '../../generated/prisma/enums';
import { aiQueue } from './ai.queue';
import { logAiCall } from './ai.logging';
import { getProviderChain } from './provider.chain';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFY_JSON_SCHEMA,
  buildClassifyUserPrompt,
} from './prompts/classify.prompt';
import { parseAndNormalizeClassification } from './ai.schemas';
import { classifyWithFallback } from './fallback.classifier';
import { applyPriorityGuardrails } from './priority.guardrails';

export class AiService {
  private readonly inFlightClassifications = new Set<string>();

  /**
   * Returns true if a ticket classification is actively running in background.
   */
  isClassifying(ticketId: string): boolean {
    return this.inFlightClassifications.has(ticketId);
  }

  /**
   * Main classification pipeline orchestrator (PROJECT_CONTEXT §8.2, §8.5).
   *
   * Subscribed to domain event `ticket.created` and called by reclassify endpoint.
   * Runs asynchronously: never blocks HTTP ticket creation.
   */
  async classifyTicket(ticketId: string): Promise<void> {
    if (this.inFlightClassifications.has(ticketId)) {
      logger.info({ ticketId }, 'Ticket classification already in flight, skipping duplicate trigger');
      return;
    }

    this.inFlightClassifications.add(ticketId);

    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { book: true },
      });

      if (!ticket) {
        logger.warn({ ticketId }, 'Ticket not found for AI classification');
        return;
      }

      const chain = getProviderChain();
      const hasProviders = chain.getProviders().length > 0;
      const aiActive = env.AI_ENABLED && hasProviders;

      // -----------------------------------------------------------------------
      // Path 1: AI Disabled or No Providers Configured -> SKIPPED
      // -----------------------------------------------------------------------
      if (!aiActive) {
        logger.info({ ticketId }, 'AI is disabled or unconfigured, running deterministic fallback');
        const fallback = classifyWithFallback(ticket.subject, ticket.description);
        const guardedPriority = applyPriorityGuardrails({
          category: fallback.category,
          currentPriority: fallback.priority,
          subject: ticket.subject,
          description: ticket.description,
        });

        await this.persistClassification(ticketId, {
          category: fallback.category,
          categorySource: FieldSource.FALLBACK,
          priority: guardedPriority,
          prioritySource: FieldSource.FALLBACK,
          aiStatus: AiStatus.SKIPPED,
          aiReasoning: fallback.reasoning,
          aiError: null,
          needsManualTriage: true,
        });
        return;
      }

      // -----------------------------------------------------------------------
      // Path 2: AI Enabled -> Run LLM Pipeline via Rate-Limiting Queue
      // -----------------------------------------------------------------------
      const userPrompt = buildClassifyUserPrompt({
        subject: ticket.subject,
        description: ticket.description,
        bookStatus: ticket.book?.status,
      });

      const startTime = Date.now();
      let rawResult: { content: unknown; rawText: string; inputTokens?: number; outputTokens?: number } | null = null;
      let primaryProviderName = chain.getProviders()[0]?.name ?? 'gemini';
      let primaryModelName = chain.getProviders()[0]?.model ?? env.GEMINI_MODEL;

      try {
        rawResult = await aiQueue.add(() =>
          chain.generateJSON({
            systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
            userPrompt,
            jsonSchema: CLASSIFY_JSON_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 150,
          }),
        );

        const latencyMs = Date.now() - startTime;

        await logAiCall({
          kind: 'CLASSIFY',
          provider: primaryProviderName,
          model: primaryModelName,
          ticketId,
          latencyMs,
          inputTokens: rawResult.inputTokens,
          outputTokens: rawResult.outputTokens,
          success: true,
        });

        const normalized = parseAndNormalizeClassification(rawResult.content);
        const guardedPriority = applyPriorityGuardrails({
          category: normalized.category,
          currentPriority: normalized.priority,
          subject: ticket.subject,
          description: ticket.description,
        });

        await this.persistClassification(ticketId, {
          category: normalized.category,
          categorySource: normalized.categorySource as FieldSource,
          priority: guardedPriority,
          prioritySource: normalized.prioritySource as FieldSource,
          aiStatus: AiStatus.DONE,
          aiReasoning: normalized.reasoning,
          aiError: null,
          needsManualTriage: false,
        });
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        const errMessage = err instanceof Error ? err.message : String(err);
        const errCode = (err as { name?: string }).name ?? 'AI_ERROR';

        logger.error({ ticketId, err: errMessage, errCode }, 'AI classification failed across all providers, falling back');

        await logAiCall({
          kind: 'CLASSIFY',
          provider: primaryProviderName,
          model: primaryModelName,
          ticketId,
          latencyMs,
          success: false,
          errorCode: errCode,
        });

        // Deterministic Fallback on Failure
        const fallback = classifyWithFallback(ticket.subject, ticket.description);
        const guardedPriority = applyPriorityGuardrails({
          category: fallback.category,
          currentPriority: fallback.priority,
          subject: ticket.subject,
          description: ticket.description,
        });

        await this.persistClassification(ticketId, {
          category: fallback.category,
          categorySource: FieldSource.FALLBACK,
          priority: guardedPriority,
          prioritySource: FieldSource.FALLBACK,
          aiStatus: AiStatus.FAILED,
          aiReasoning: fallback.reasoning,
          aiError: errMessage.slice(0, 500),
          needsManualTriage: true,
        });
      }
    } finally {
      this.inFlightClassifications.delete(ticketId);
    }
  }

  /**
   * Safely updates ticket classification fields.
   *
   * HARD RULE: NEVER overwrite a field whose source is ADMIN.
   * If an admin edited category or priority while the AI call was in flight,
   * the admin's changes and ADMIN source are strictly preserved.
   */
  private async persistClassification(
    ticketId: string,
    params: {
      category: TicketCategory;
      categorySource: FieldSource;
      priority: Priority;
      prioritySource: FieldSource;
      aiStatus: AiStatus;
      aiReasoning: string;
      aiError: string | null;
      needsManualTriage: boolean;
    },
  ): Promise<void> {
    // Re-fetch current ticket state to inspect existing sources
    const current = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { categorySource: true, prioritySource: true, category: true, priority: true },
    });

    if (!current) return;

    const data: Record<string, unknown> = {
      aiStatus: params.aiStatus,
      aiReasoning: params.aiReasoning,
      aiError: params.aiError,
      needsManualTriage: params.needsManualTriage,
    };

    // Only update category if not set by an admin
    if (current.categorySource !== FieldSource.ADMIN) {
      data.category = params.category;
      data.categorySource = params.categorySource;
    }

    // Only update priority if not set by an admin
    if (current.prioritySource !== FieldSource.ADMIN) {
      data.priority = params.priority;
      data.prioritySource = params.prioritySource;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data,
    });

    // Notify listeners (gateway forwards to admins via ticket:ai_ready)
    domainEvents.emit('ticket.ai.ready', {
      ticketId: updated.id,
      category: updated.category ?? TicketCategory.GENERAL_INQUIRY,
      priority: updated.priority,
      aiStatus: updated.aiStatus,
    });
  }

  /**
   * Re-triggers ticket classification (admin action).
   * Throws ConflictError (409) if a classification is already in progress.
   */
  async reclassifyTicket(ticketId: string) {
    if (this.isClassifying(ticketId)) {
      throw new ConflictError('A classification is already in progress for this ticket');
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        author: true,
        book: true,
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Trigger classification asynchronously in the background
    setImmediate(() => {
      this.classifyTicket(ticketId).catch((err) => {
        logger.error({ err: (err as Error).message, ticketId }, 'Reclassification failed in background');
      });
    });

    return ticket;
  }

  /**
   * Startup recovery: re-queues any tickets stuck in aiStatus PENDING older than 2 minutes
   * (e.g. from an unexpected server restart mid-job).
   */
  async recoverPendingTickets(batchSize = 10): Promise<void> {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const stuckTickets = await prisma.ticket.findMany({
        where: {
          aiStatus: AiStatus.PENDING,
          createdAt: { lt: twoMinutesAgo },
        },
        select: { id: true },
        take: batchSize,
      });

      if (stuckTickets.length > 0) {
        logger.info({ count: stuckTickets.length }, 'Recovering pending tickets stuck in PENDING state');
        for (const t of stuckTickets) {
          this.classifyTicket(t.id).catch((err) => {
            logger.error({ err: (err as Error).message, ticketId: t.id }, 'Pending ticket recovery failed');
          });
        }
      }
    } catch (err: unknown) {
      logger.error({ err: (err as Error).message }, 'Failed to run pending ticket startup recovery');
    }
  }
}

export const aiService = new AiService();

/**
 * Registers domain event listeners for AI background processing.
 * Returns an unregister cleanup function.
 */
export function registerAiDomainListeners(): () => void {
  const listener = (payload: { ticketId: string }) => {
    aiService.classifyTicket(payload.ticketId).catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), ticketId: payload.ticketId },
        'Background ticket classification failed',
      );
    });
  };

  domainEvents.on('ticket.created', listener);

  return () => {
    domainEvents.off('ticket.created', listener);
  };
}

