import { TicketCategory } from '../../../generated/prisma/enums';
import { COMPANY_OVERVIEW, TONE_RULES, TONE_RULES_TEXT } from './company';
import {
  CATEGORY_KB_MAP,
  GENERAL_INQUIRY_KB,
  type CategoryKbData,
  type CannedSnippet,
  type FewShotExample,
} from './categories';

export {
  COMPANY_OVERVIEW,
  TONE_RULES,
  TONE_RULES_TEXT,
  CATEGORY_KB_MAP,
  CategoryKbData,
  CannedSnippet,
  FewShotExample,
};

export function getCategoryKb(category: TicketCategory | string | null | undefined): CategoryKbData {
  if (!category) return GENERAL_INQUIRY_KB;
  const match = CATEGORY_KB_MAP[category as TicketCategory];
  return match ?? GENERAL_INQUIRY_KB;
}

export function getCannedSnippets(
  category: TicketCategory | string | null | undefined,
  params: { authorFirstName: string; bookTitle?: string | null },
): CannedSnippet[] {
  const kb = getCategoryKb(category);
  const firstName = params.authorFirstName.trim() || 'Author';
  const title = params.bookTitle?.trim() || 'your book';

  return kb.cannedSnippets.map((snippet) => ({
    id: snippet.id,
    title: snippet.title,
    template: snippet.template
      .replace(/{authorFirstName}/g, firstName)
      .replace(/{bookTitle}/g, title),
  }));
}
