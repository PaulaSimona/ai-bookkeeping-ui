import { parseFrontmatter, type Article } from '@/utils/blog';

import ultimateGuideRaw from './ultimate-guide-ai-bookkeeping-canada.md?raw';
import howReliableRaw from './how-reliable-is-ai-bookkeeping.md?raw';
import vsTraditionalRaw from './ai-bookkeeping-vs-traditional-bookkeeping.md?raw';
import gstGuideRaw from './gst-pst-hst-guide-canada.md?raw';
import craRequirementsRaw from './cra-bookkeeping-requirements.md?raw';

const rawArticles: string[] = [
  ultimateGuideRaw,
  howReliableRaw,
  vsTraditionalRaw,
  gstGuideRaw,
  craRequirementsRaw,
];

export const articles: Article[] = rawArticles.map(parseFrontmatter);
