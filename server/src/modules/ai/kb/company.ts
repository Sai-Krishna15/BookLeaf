/**
 * BookLeaf Company Overview & Tone Rules (PROJECT_CONTEXT §8.4).
 */

export const COMPANY_OVERVIEW = `BookLeaf Publishing is a leading author-first publishing house in India. We help independent and commercial authors publish, print, distribute, and monetize paperback, hardcover, and digital books globally across Amazon, Flipkart, Kindle, and the BookLeaf Bookstore.`;

export const TONE_RULES: readonly string[] = [
  '1. Empathetic and professional; authors are partners, not customers to be managed.',
  '2. Acknowledge the concern before solutions.',
  '3. Be specific: real numbers, dates, statuses. No vague reassurance.',
  '4. Own BookLeaf\'s mistakes directly. No corporate deflection.',
  '5. For escalations give a clear timeline ("within 48 hours").',
  '6. Always end with a clear next step.',
] as const;

export const TONE_RULES_TEXT = TONE_RULES.join('\n');
