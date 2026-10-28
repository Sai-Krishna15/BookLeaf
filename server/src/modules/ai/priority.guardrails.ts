import { Priority, TicketCategory } from '../../generated/prisma/enums';

const PRIORITY_ORDER: Record<Priority, number> = {
  [Priority.LOW]: 1,
  [Priority.MEDIUM]: 2,
  [Priority.HIGH]: 3,
  [Priority.CRITICAL]: 4,
};

export interface GuardrailInput {
  category: TicketCategory;
  currentPriority: Priority;
  subject: string;
  description: string;
}

/**
 * Deterministic Priority Floor Guardrails (PROJECT_CONTEXT §8.2).
 *
 * Runs strictly AFTER model or fallback classification.
 * INVARIANT: A guardrail can raise priority to meet a floor, but can NEVER lower an existing priority.
 *
 * Floors:
 * 1. ISBN_METADATA with wrong/duplicate/different/mismatch/incorrect -> at least HIGH (KB: ISBN errors are critical to distribution).
 * 2. PRINTING_QUALITY with defect/misprint/blurry/damaged/binding -> at least HIGH (physical damage).
 * 3. DISTRIBUTION_AVAILABILITY with unavailable -> at least HIGH (lost reader sales).
 * 4. ROYALTY_PAYMENTS with missing payment phrases + 6+ months duration -> at least CRITICAL.
 */
export function applyPriorityGuardrails(input: GuardrailInput): Priority {
  const combined = `${input.subject} ${input.description}`.toLowerCase();
  let floor: Priority = input.currentPriority;

  const raiseFloor = (target: Priority): void => {
    const targetRank = PRIORITY_ORDER[target] ?? 0;
    const currentFloorRank = PRIORITY_ORDER[floor] ?? 0;
    if (targetRank > currentFloorRank) {
      floor = target;
    }
  };

  // Rule 1: ISBN errors
  if (
    input.category === TicketCategory.ISBN_METADATA &&
    /\b(wrong|duplicate|different|mismatch|incorrect)\b/i.test(combined)
  ) {
    raiseFloor(Priority.HIGH);
  }

  // Rule 2: Printing defects
  if (
    input.category === TicketCategory.PRINTING_QUALITY &&
    /\b(defect|misprint|blurry|damaged|binding)\b/i.test(combined)
  ) {
    raiseFloor(Priority.HIGH);
  }

  // Rule 3: Distribution unavailability
  if (
    input.category === TicketCategory.DISTRIBUTION_AVAILABILITY &&
    /\bunavailable\b/i.test(combined)
  ) {
    raiseFloor(Priority.HIGH);
  }

  // Rule 4: Long-overdue royalties (>= 6 months)
  // Requires:
  // (a) Not received phrase: "never received", "haven't received", "not received", "didn't receive"
  // (b) Duration >= 6 months: "6 months", "8 months", "1 year", "2 years", "half a year", etc.
  if (input.category === TicketCategory.ROYALTY_PAYMENTS) {
    const hasNotReceived = /\b(?:never|haven'?t|not|didn'?t)\s+(?:received?|got|seen|paid)\b/i.test(combined);
    const hasLongDuration = /\b(?:[6-9]|1[0-2]|\d{2,})\s*(?:months?|yrs?|years?)|half\s+a\s+year|over\s+a\s+year\b/i.test(combined);

    if (hasNotReceived && hasLongDuration) {
      raiseFloor(Priority.CRITICAL);
    }
  }

  return floor;
}
