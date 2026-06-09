import { parseFrontmatter, type Article } from '@/utils/blog';

import ultimateGuideRaw from './ultimate-guide-ai-bookkeeping-canada.md?raw';
import howReliableRaw from './how-reliable-is-ai-bookkeeping.md?raw';
import vsTraditionalRaw from './ai-bookkeeping-vs-traditional-bookkeeping.md?raw';

const rawArticles: string[] = [
  ultimateGuideRaw,
  howReliableRaw,
  vsTraditionalRaw,
];

export const articles: Article[] = rawArticles.map(parseFrontmatter);
