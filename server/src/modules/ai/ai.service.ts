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
import { buildDraftContext } from './context.builder';
import {
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  DRAFT_PROMPT_VERSION,
} from './prompts/draft.prompt';
import { validateAndCleanDraft, checkHallucinations } from './draft.validator';
import { getCannedSnippets, CannedSnippet } from './kb';

export type DraftStatus = 'ready' | 'unavailable' | 'idle';

export interface DraftDetail {
  id: string;
  ticketId: string;
  category?: TicketCategory | null;
  basedOnMessageId?: string | null;
  body: string;
  warnings: string[];
  createdAt: Date;
  provider: string;
  model: string;
  stale: boolean;
}

export interface ReadyDraftResponse {
  status: 'ready';
  draft: DraftDetail;
}

export interface UnavailableDraftResponse {
  status: 'unavailable';
  draft: null;
  reason: string;
  snippets: CannedSnippet[];
}

export interface IdleDraftResponse {
  status: 'idle';
  draft: DraftDetail | null;
  reason: string;
}

export type DraftResponse = ReadyDraftResponse | UnavailableDraftResponse | IdleDraftResponse;

export class AiService {
  private readonly inFlightClassifications = new Set<string>();
  private readonly inFlightDrafts = new Map<string, Promise<DraftResponse>>();

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
   * Returns a cached draft reply or generates a new one (PROJECT_CONTEXT §8.3, §8.4, §8.5).
   *
   * Caching Rules:
   * - If a cached draft exists and NO author message was sent after draft.createdAt, returns cached.
   * - If an author message was sent after draft.createdAt, cached draft is stale -> generates a new one.
   * - If `force = true` (Regenerate), cache is bypassed and a new draft is generated.
   *
   * In-Flight Deduplication:
   * - Concurrent calls for the same ticket share the identical generation promise.
   *
   * Failure Handling:
   * - Never returns 500. Returns `{ status: 'unavailable', draft: null, snippets }` with 200 OK.
   */
  async getOrGenerateDraft(ticketId: string, force = false): Promise<DraftResponse> {
    const existing = this.inFlightDrafts.get(ticketId);
    if (existing) {
      return await existing;
    }

    const task = this.processDraftRequest(ticketId, force);
    this.inFlightDrafts.set(ticketId, task);

    try {
      return await task;
    } finally {
      this.inFlightDrafts.delete(ticketId);
    }
  }

  private async processDraftRequest(ticketId: string, force: boolean): Promise<DraftResponse> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        author: {
          include: {
            books: {
              select: {
                id: true,
                status: true,
                totalRoyaltyEarned: true,
                royaltyPaid: true,
                royaltyPending: true,
              },
            },
          },
        },
        book: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            body: true,
            createdAt: true,
            sender: { select: { name: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    const latestDraft = await prisma.aiDraft.findFirst({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    const publicMessages = ticket.messages.filter(
      (m) => m.type === 'AUTHOR_MESSAGE' || m.type === 'ADMIN_REPLY',
    );
    const lastPublicMessage =
      publicMessages.length > 0 ? publicMessages[publicMessages.length - 1] : null;
    const hasStaffReplies = publicMessages.some((m) => m.type === 'ADMIN_REPLY');
    const isOpenOrInProgress = ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS';
    const isStaffResponseNeeded =
      isOpenOrInProgress && (lastPublicMessage?.type === 'AUTHOR_MESSAGE' || !hasStaffReplies);

    // 1. Cost Awareness (Fix 3): If force = false and staff response is NOT needed (e.g. staff just replied),
    // return idle status without calling the LLM.
    if (!force && !isStaffResponseNeeded) {
      return {
        status: 'idle',
        draft: latestDraft
          ? {
              id: latestDraft.id,
              ticketId: latestDraft.ticketId,
              category: latestDraft.category,
              basedOnMessageId: latestDraft.basedOnMessageId,
              body: latestDraft.body,
              warnings: [],
              createdAt: latestDraft.createdAt,
              provider: latestDraft.provider,
              model: latestDraft.model,
              stale: false,
            }
          : null,
        reason: "Waiting for the author's reply",
      };
    }

    // 2. Cache Inspection & Staleness Check (Fix 2: ANY public message after draft OR category change)
    if (!force && latestDraft) {
      const hasNewerPublicMessage = publicMessages.some(
        (m) => m.createdAt.getTime() > latestDraft.createdAt.getTime(),
      );
      const isCategoryChanged = Boolean(
        latestDraft.category && ticket.category && latestDraft.category !== ticket.category,
      );
      const isStale = hasNewerPublicMessage || isCategoryChanged;

      if (!isStale) {
        const authorTotals = this.computeAuthorTotals(ticket.author.books);
        const context = buildDraftContext({
          ticket: {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            description: ticket.description,
            category: ticket.category,
            createdAt: ticket.createdAt,
          },
          author: {
            id: ticket.author.id,
            name: ticket.author.name,
          },
          book: ticket.book,
          authorTotals,
          messages: ticket.messages.map((m) => ({
            id: m.id,
            type: m.type,
            body: m.body,
            createdAt: m.createdAt,
            senderName: m.sender.name,
          })),
        });

        const warnings = checkHallucinations(latestDraft.body, context);

        return {
          status: 'ready',
          draft: {
            id: latestDraft.id,
            ticketId: latestDraft.ticketId,
            category: latestDraft.category,
            basedOnMessageId: latestDraft.basedOnMessageId,
            body: latestDraft.body,
            warnings,
            createdAt: latestDraft.createdAt,
            provider: latestDraft.provider,
            model: latestDraft.model,
            stale: false,
          },
        };
      }
    }

    // 3. Generate fresh draft via LLM
    return this.executeDraftGeneration(ticket);
  }

  private async executeDraftGeneration(ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    description: string;
    category: string | null;
    createdAt: Date;
    author: {
      id: string;
      name: string;
      books: Array<{ totalRoyaltyEarned: number; royaltyPaid: number; royaltyPending: number }>;
    };
    book: any;
    messages: Array<{ id?: string; type: string; body: string; createdAt: Date; sender: { name: string } }>;
  }): Promise<DraftResponse> {
    const authorFirstName = ticket.author.name.trim().split(/\s+/)[0] || 'Author';
    const chain = getProviderChain();
    const hasProviders = chain.getProviders().length > 0;
    const aiActive = env.AI_ENABLED && hasProviders && !chain.isCircuitBreakerOpen();

    const authorTotals = this.computeAuthorTotals(ticket.author.books);
    const context = buildDraftContext({
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        createdAt: ticket.createdAt,
      },
      author: {
        id: ticket.author.id,
        name: ticket.author.name,
      },
      book: ticket.book,
      authorTotals,
      messages: ticket.messages.map((m) => ({
        id: m.id,
        type: m.type,
        body: m.body,
        createdAt: m.createdAt,
        senderName: m.sender.name,
      })),
    });

    if (!aiActive) {
      const snippets = getCannedSnippets(ticket.category as TicketCategory, {
        authorFirstName,
        bookTitle: ticket.book?.title,
      });
      return {
        status: 'unavailable',
        draft: null,
        reason: 'AI draft generation is currently unavailable. Write your reply manually.',
        snippets,
      };
    }

    const systemPrompt = buildDraftSystemPrompt(context.authorFirstName);
    const userPrompt = buildDraftUserPrompt(context);
    const startTime = Date.now();
    const primaryProviderName = chain.getProviders()[0]?.name ?? 'gemini';
    const primaryModelName = chain.getProviders()[0]?.model ?? env.GEMINI_MODEL;

    try {
      const rawResult = await aiQueue.add(() =>
        chain.generateText({
          systemPrompt,
          userPrompt,
          temperature: 0.3,
          maxOutputTokens: 350,
        }),
      );

      const latencyMs = Date.now() - startTime;
      await logAiCall({
        kind: 'DRAFT',
        provider: primaryProviderName,
        model: primaryModelName,
        ticketId: ticket.id,
        latencyMs,
        inputTokens: rawResult.inputTokens,
        outputTokens: rawResult.outputTokens,
        success: true,
      });

      const { cleanBody, warnings } = validateAndCleanDraft(rawResult.rawText, context);

      const authorMsgs = ticket.messages.filter((m) => m.type === 'AUTHOR_MESSAGE');
      const latestAuthorMsg = authorMsgs.length > 0 ? authorMsgs[authorMsgs.length - 1] : null;

      const savedDraft = await prisma.aiDraft.create({
        data: {
          ticketId: ticket.id,
          category: (ticket.category as TicketCategory) ?? null,
          basedOnMessageId: latestAuthorMsg?.id ?? null,
          body: cleanBody,
          provider: primaryProviderName,
          model: primaryModelName,
          promptVersion: DRAFT_PROMPT_VERSION,
          inputTokens: rawResult.inputTokens ?? null,
          outputTokens: rawResult.outputTokens ?? null,
        },
      });

      return {
        status: 'ready',
        draft: {
          id: savedDraft.id,
          ticketId: savedDraft.ticketId,
          category: savedDraft.category,
          basedOnMessageId: savedDraft.basedOnMessageId,
          body: savedDraft.body,
          warnings,
          createdAt: savedDraft.createdAt,
          provider: savedDraft.provider,
          model: savedDraft.model,
          stale: false,
        },
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errMessage = err instanceof Error ? err.message : String(err);
      const errCode = (err as { name?: string }).name ?? 'AI_ERROR';

      logger.error({ ticketId: ticket.id, err: errMessage, errCode }, 'AI draft generation failed');

      await logAiCall({
        kind: 'DRAFT',
        provider: primaryProviderName,
        model: primaryModelName,
        ticketId: ticket.id,
        latencyMs,
        success: false,
        errorCode: errCode,
      });

      const snippets = getCannedSnippets(ticket.category as TicketCategory, {
        authorFirstName: context.authorFirstName,
        bookTitle: ticket.book?.title,
      });

      return {
        status: 'unavailable',
        draft: null,
        reason: 'AI draft generation is currently unavailable. Write your reply manually.',
        snippets,
      };
    }
  }

  private computeAuthorTotals(
    books: Array<{ totalRoyaltyEarned: number; royaltyPaid: number; royaltyPending: number }>,
  ) {
    let totalRoyaltyEarned = 0;
    let royaltyPaid = 0;
    let royaltyPending = 0;
    for (const b of books) {
      totalRoyaltyEarned += b.totalRoyaltyEarned;
      royaltyPaid += b.royaltyPaid;
      royaltyPending += b.royaltyPending;
    }
    return { totalRoyaltyEarned, royaltyPaid, royaltyPending };
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
