import { TicketCategory, Priority } from '../../generated/prisma/enums';

export interface FallbackClassificationResult {
  category: TicketCategory;
  priority: Priority;
  reasoning: string;
}

/**
 * Deterministic keyword-based classification rules (PROJECT_CONTEXT §8.5).
 *
 * Used when:
 * 1. AI is disabled (AI_ENABLED=false)
 * 2. All AI providers fail or circuit breaker is open
 * 3. Fast fallback classification is required
 *
 * Rules:
 * - royalty/payment/payout/bank/payment not received -> ROYALTY_PAYMENTS
 * - isbn/barcode/metadata -> ISBN_METADATA
 * - print/blurry/binding/misprint/damaged/quality -> PRINTING_QUALITY
 * - amazon/flipkart/unavailable/listing/stock/not showing -> DISTRIBUTION_AVAILABILITY
 * - status/stage/typesetting/cover/proof/when will -> BOOK_STATUS_PRODUCTION
 * - else -> GENERAL_INQUIRY
 *
 * Default priority: MEDIUM.
 */
export function classifyWithFallback(subject: string, description: string): FallbackClassificationResult {
  const combined = `${subject} ${description}`.toLowerCase();

  // 1. Royalty & payments
  if (/\b(royalt(?:y|ies)|payments?|payouts?|bank|payment not received)\b/i.test(combined)) {
    return {
      category: TicketCategory.ROYALTY_PAYMENTS,
      priority: Priority.MEDIUM,
      reasoning: 'Fallback rule matched royalty or payment keywords.',
    };
  }

  // 2. ISBN & metadata
  if (/\b(isbn|barcode|metadata)\b/i.test(combined)) {
    return {
      category: TicketCategory.ISBN_METADATA,
      priority: Priority.MEDIUM,
      reasoning: 'Fallback rule matched ISBN or metadata keywords.',
    };
  }

  // 3. Printing quality
  if (/\b(prints?|printing|blurry|binding|misprints?|damaged|quality)\b/i.test(combined)) {
    return {
      category: TicketCategory.PRINTING_QUALITY,
      priority: Priority.MEDIUM,
      reasoning: 'Fallback rule matched printing or physical defect keywords.',
    };
  }

  // 4. Distribution & availability
  if (/\b(amazon|flipkart|unavailable|listing|stock|not showing)\b/i.test(combined)) {
    return {
      category: TicketCategory.DISTRIBUTION_AVAILABILITY,
      priority: Priority.MEDIUM,
      reasoning: 'Fallback rule matched distribution or stock listing keywords.',
    };
  }

  // 5. Book status & production
  if (/\b(status|stage|typesetting|cover|proof|when will)\b/i.test(combined)) {
    return {
      category: TicketCategory.BOOK_STATUS_PRODUCTION,
      priority: Priority.MEDIUM,
      reasoning: 'Fallback rule matched book publishing stage or production timeline keywords.',
    };
  }

  // 6. General inquiry
  return {
    category: TicketCategory.GENERAL_INQUIRY,
    priority: Priority.MEDIUM,
    reasoning: 'Default fallback category applied (no specific domain keywords matched).',
  };
}
