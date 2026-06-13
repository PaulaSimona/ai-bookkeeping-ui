import { type FC, useEffect, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { marked } from 'marked';
import { articles } from '@/content/blog';
import { formatDate } from '@/utils/blog';
import { PublicPageShell } from '@/components/Layout/PublicPageShell';

const SITE_URL = 'https://ai-bookkeeping.ai';

export const BlogPost: FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = useMemo(() => articles.find((a) => a.slug === slug), [slug]);

  const html = useMemo(
    () => (article ? (marked.parse(article.content) as string) : ''),
    [article],
  );

  useEffect(() => {
    if (!article) return;

    const prevTitle = document.title;
    document.title = `${article.title} | AI Bookkeeping Blog`;

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const createdDesc = !metaDesc;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = article.metaDescription;

    const articleLd = document.createElement('script');
    articleLd.type = 'application/ld+json';
    articleLd.id = 'ld-article';
    articleLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.metaDescription,
      datePublished: article.date,
      keywords: article.keywords,
      url: `${SITE_URL}/blog/${article.slug}`,
      author: { '@type': 'Organization', name: 'Time2Win Inc.', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'AI Bookkeeping', url: SITE_URL },
    });
    document.head.appendChild(articleLd);

    const breadcrumbLd = document.createElement('script');
    breadcrumbLd.type = 'application/ld+json';
    breadcrumbLd.id = 'ld-breadcrumb';
    breadcrumbLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        {
          '@type': 'ListItem',
          position: 3,
          name: article.title,
          item: `${SITE_URL}/blog/${article.slug}`,
        },
      ],
    });
    document.head.appendChild(breadcrumbLd);

    return () => {
      document.title = prevTitle;
      if (createdDesc) metaDesc?.remove();
      document.getElementById('ld-article')?.remove();
      document.getElementById('ld-breadcrumb')?.remove();
    };
  }, [article]);

  if (!article) return <Navigate to="/blog" replace />;

  return (
    <PublicPageShell>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-400">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/" className="hover:text-gray-700 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link to="/blog" className="hover:text-gray-700 transition-colors">Blog</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-700 font-medium truncate max-w-[200px]">{article.title}</li>
          </ol>
        </nav>

        <header className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium bg-blue-50 text-[#0066FF] px-2.5 py-0.5 rounded-full">
              {article.category}
            </span>
            <span className="text-xs text-gray-400">{formatDate(article.date)}</span>
            <span className="text-xs text-gray-400">· {article.readTime}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-snug">{article.title}</h1>
          <p className="text-lg text-gray-500 leading-relaxed">{article.excerpt}</p>
        </header>

        <div className="blog-content" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-12 pt-6 border-t border-gray-100 flex items-center justify-between">
          <Link to="/blog" className="text-sm font-medium text-[#0066FF] hover:underline">
            ← Back to Blog
          </Link>
          <Link to="/faq" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            Browse FAQ →
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
};
