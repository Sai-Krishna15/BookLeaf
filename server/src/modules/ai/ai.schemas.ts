import { z } from 'zod';
import { TicketCategory, Priority } from '../../generated/prisma/enums';

export const VALID_CATEGORIES: [TicketCategory, ...TicketCategory[]] = [
  TicketCategory.ROYALTY_PAYMENTS,
  TicketCategory.ISBN_METADATA,
  TicketCategory.PRINTING_QUALITY,
  TicketCategory.DISTRIBUTION_AVAILABILITY,
  TicketCategory.BOOK_STATUS_PRODUCTION,
  TicketCategory.GENERAL_INQUIRY,
];

export const VALID_PRIORITIES: [Priority, ...Priority[]] = [
  Priority.CRITICAL,
  Priority.HIGH,
  Priority.MEDIUM,
  Priority.LOW,
];

export const rawClassificationSchema = z.object({
  category: z.string().optional(),
  priority: z.string().optional(),
  reasoning: z.string().optional(),
});

export type RawClassification = z.infer<typeof rawClassificationSchema>;

export interface ParsedClassification {
  category: TicketCategory;
  categorySource: 'AI' | 'FALLBACK';
  priority: Priority;
  prioritySource: 'AI' | 'FALLBACK';
  reasoning: string;
}

/**
 * Validates and normalizes raw LLM output.
 *
 * Rules (PROJECT_CONTEXT §8.2):
 * - Invalid or unknown category -> defaults to GENERAL_INQUIRY, categorySource = FALLBACK.
 * - Invalid or unknown priority -> defaults to MEDIUM, prioritySource = FALLBACK.
 * - Valid categories and priorities receive source = AI.
 * - Reasoning is truncated to a safe display length (max 250 characters).
 */
export function parseAndNormalizeClassification(raw: unknown): ParsedClassification {
  const parsed = rawClassificationSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};

  let category: TicketCategory = TicketCategory.GENERAL_INQUIRY;
  let categorySource: 'AI' | 'FALLBACK' = 'FALLBACK';

  if (data.category && (VALID_CATEGORIES as readonly string[]).includes(data.category)) {
    category = data.category as TicketCategory;
    categorySource = 'AI';
  }

  let priority: Priority = Priority.MEDIUM;
  let prioritySource: 'AI' | 'FALLBACK' = 'FALLBACK';

  if (data.priority && (VALID_PRIORITIES as readonly string[]).includes(data.priority)) {
    priority = data.priority as Priority;
    prioritySource = 'AI';
  }

  let reasoning = (data.reasoning ?? '').trim();
  if (reasoning.length > 250) {
    reasoning = reasoning.slice(0, 247) + '...';
  }
  if (!reasoning) {
    reasoning = categorySource === 'AI' ? 'Classified by BookLeaf AI.' : 'Classified via fallback rule.';
  }

  return {
    category,
    categorySource,
    priority,
    prioritySource,
    reasoning,
  };
}
