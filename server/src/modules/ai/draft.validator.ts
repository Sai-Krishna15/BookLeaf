import { AiInvalidResponseError } from './llm.provider';
import { DraftContext } from './context.builder';

export interface ValidationResult {
  cleanBody: string;
  warnings: string[];
}

const REQUIRED_SIGN_OFF = 'Warm regards,\nBookLeaf Author Support Team';

/**
 * Strips markdown styling (headers, bold/italic, bullet marks, code fences)
 * to ensure pure plain-text output as mandated by BookLeaf style guidelines.
 */
export function stripMarkdown(raw: string): string {
  let text = raw;

  // Remove code fences
  text = text.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, '$1');
  // Remove inline backticks
  text = text.replace(/`([^`]+)`/g, '$1');
  // Remove markdown headers (#, ##, etc.)
  text = text.replace(/^#+\s+/gm, '');
  // Remove bold / italics
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  // Remove bullet points (- item, * item, • item)
  text = text.replace(/^[ \t]*[-*•]\s+/gm, '');
  // Normalize excess whitespace and line breaks
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Normalizes or repairs the greeting and sign-off on the generated response.
 */
export function enforceGreetingAndSignOff(text: string, authorFirstName: string): string {
  const expectedGreeting = `Hi ${authorFirstName},`;
  let processed = text.trim();

  // 1. Greeting inspection & repair
  const greetingPattern = /^(?:Hi|Hello|Dear|Greetings)\s+[^,\n]+,/i;
  if (greetingPattern.test(processed)) {
    // Replace opening with canonical "Hi {firstName},"
    processed = processed.replace(greetingPattern, expectedGreeting);
  } else if (!processed.startsWith(expectedGreeting)) {
    // Prepend if missing entirely
    processed = `${expectedGreeting}\n\n${processed}`;
  }

  // 2. Sign-off inspection & repair
  // Find where sign-off starts (e.g. "Warm regards,", "Best regards,", "Sincerely,", etc.)
  const signOffPattern = /\n+(?:(?:Warm|Best|Kind|With)?\s*regards,?|Sincerely,?|Yours truly,?|Thanks,?|Thank you,?)\s*(?:\n+.*)?$/i;

  if (signOffPattern.test(processed)) {
    processed = processed.replace(signOffPattern, `\n\n${REQUIRED_SIGN_OFF}`);
  } else if (!processed.endsWith(REQUIRED_SIGN_OFF)) {
    processed = `${processed}\n\n${REQUIRED_SIGN_OFF}`;
  }

  return processed.trim();
}

/**
 * Scans generated draft text for specific facts (₹ amounts, percentages, dates)
 * and flags any that do not match ground-truth context or standard policy numbers.
 */
export function checkHallucinations(body: string, context: DraftContext): string[] {
  const warnings: string[] = [];

  // Allowed policy numbers and numbers from ticket & facts
  const allowedNumbers = new Set<string>([
    '80',
    '20',
    '45',
    '48',
    '24',
    '1000',
    '1,000',
    '48 hours',
    '45 days',
    '24-48 hours',
    '5-7',
    '7-10',
    '3-5',
  ]);

  // Collect numbers from bookFacts
  if (context.bookFacts) {
    const bf = context.bookFacts;
    const extractDigits = (val: string | number) => {
      const match = String(val).match(/\d[\d,]*/);
      if (match) allowedNumbers.add(match[0].replace(/,/g, ''));
    };
    extractDigits(bf.copiesSold);
    extractDigits(bf.mrp);
    extractDigits(bf.royaltyPerCopy);
    extractDigits(bf.totalEarned);
    extractDigits(bf.paid);
    extractDigits(bf.pending);
  }

  // Collect numbers from authorTotals
  if (context.authorTotals) {
    const at = context.authorTotals;
    const extractDigits = (val: string) => {
      const match = val.match(/\d[\d,]*/);
      if (match) allowedNumbers.add(match[0].replace(/,/g, ''));
    };
    extractDigits(at.totalEarned);
    extractDigits(at.paid);
    extractDigits(at.pending);
  }

  // Collect all numbers present in the original query or recent messages
  const userText = `${context.ticketSubject} ${context.ticketDescription} ${context.recentMessages.map((m) => m.text).join(' ')}`;
  const userNumMatches = userText.match(/\d[\d,]*/g) || [];
  userNumMatches.forEach((n) => allowedNumbers.add(n.replace(/,/g, '')));

  // 1. Scan for Currency Amounts: ₹1,000, Rs. 500, INR 200, etc.
  const currencyRegex = /(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]+)?)/gi;
  let currMatch: RegExpExecArray | null;
  while ((currMatch = currencyRegex.exec(body)) !== null) {
    const rawVal = currMatch[1]?.replace(/,/g, '') ?? '';
    const num = Math.floor(parseFloat(rawVal));
    if (!allowedNumbers.has(String(num)) && !allowedNumbers.has(rawVal)) {
      warnings.push(`Unverified currency amount mentioned: ${currMatch[0]}`);
    }
  }

  // 2. Scan for Percentages: e.g. 80%, 20%, 50%
  const percentRegex = /([0-9]+(?:\.[0-9]+)?)\s*%/g;
  let pctMatch: RegExpExecArray | null;
  while ((pctMatch = percentRegex.exec(body)) !== null) {
    const pctVal = pctMatch[1];
    if (pctVal && pctVal !== '80' && pctVal !== '20' && !allowedNumbers.has(pctVal)) {
      warnings.push(`Unverified percentage mentioned: ${pctMatch[0]}`);
    }
  }

  // 3. Scan for Specific Dates (ISO format or full Month Day, Year)
  const dateRegex = /\b(\d{4}-\d{2}-\d{2})\b/g;
  let dateMatch: RegExpExecArray | null;
  const knownDates = new Set<string>();
  if (context.bookFacts) {
    knownDates.add(context.bookFacts.publicationDate);
    knownDates.add(context.bookFacts.lastPayoutDate);
    knownDates.add(context.bookFacts.nextPayoutWindow);
  }
  while ((dateMatch = dateRegex.exec(body)) !== null) {
    const dt = dateMatch[1];
    if (dt && !knownDates.has(dt) && !userText.includes(dt)) {
      warnings.push(`Unverified date mentioned: ${dt}`);
    }
  }

  return warnings;
}

/**
 * Validates, cleans, normalizes, and inspects an AI-generated draft reply.
 * Throws `AiInvalidResponseError` if the response is empty or unreasonably truncated.
 */
export function validateAndCleanDraft(rawDraft: string, context: DraftContext): ValidationResult {
  if (!rawDraft || rawDraft.trim().length === 0) {
    throw new AiInvalidResponseError('AI provider returned an empty draft response');
  }

  const stripped = stripMarkdown(rawDraft);

  if (stripped.length < 50) {
    throw new AiInvalidResponseError('AI draft is too short (< 50 characters) to be viable');
  }

  const cleanBody = enforceGreetingAndSignOff(stripped, context.authorFirstName);
  const warnings = checkHallucinations(cleanBody, context);

  return { cleanBody, warnings };
}
