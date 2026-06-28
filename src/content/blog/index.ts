import { parseFrontmatter, type Article } from '@/utils/blog';

import vsQuickBooksRaw from './ai-bookkeeping-vs-quickbooks.md?raw';
import ultimateGuideRaw from './ultimate-guide-ai-bookkeeping-canada.md?raw';
import howReliableRaw from './how-reliable-is-ai-bookkeeping.md?raw';
import vsTraditionalRaw from './ai-bookkeeping-vs-traditional-bookkeeping.md?raw';
import gstGuideRaw from './gst-pst-hst-guide-canada.md?raw';
import craRequirementsRaw from './cra-bookkeeping-requirements.md?raw';
import whyPeopleFearRaw from './why-people-fear-trusting-ai-with-their-books.md?raw';
import commonBookkeepingMistakesRaw from './common-bookkeeping-mistakes.md?raw';

const rawArticles: string[] = [
  vsQuickBooksRaw,
  ultimateGuideRaw,
  howReliableRaw,
  vsTraditionalRaw,
  gstGuideRaw,
  craRequirementsRaw,
  whyPeopleFearRaw,
  commonBookkeepingMistakesRaw,
];

export const articles: Article[] = rawArticles.map(parseFrontmatter);
