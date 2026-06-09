export interface ArticleMeta {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  readTime: string;
  category: string;
  metaDescription: string;
  keywords: string;
}

export interface Article extends ArticleMeta {
  content: string;
}

export function parseFrontmatter(raw: string): Article {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) throw new Error('Missing frontmatter delimiter');

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('Unclosed frontmatter');

  const block = normalized.slice(4, end);
  const content = normalized.slice(end + 5).trim();
  const meta: Record<string, string> = {};

  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    meta[key] = val;
  }

  return {
    title: meta.title ?? '',
    slug: meta.slug ?? '',
    date: meta.date ?? '',
    excerpt: meta.excerpt ?? '',
    readTime: meta.readTime ?? '',
    category: meta.category ?? '',
    metaDescription: meta.metaDescription ?? '',
    keywords: meta.keywords ?? '',
    content,
  };
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
