import { type FC, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { articles } from '@/content/blog';
import { formatDate } from '@/utils/blog';
import { PublicPageShell } from '@/components/Layout/PublicPageShell';

const SITE_URL = 'https://ai-bookkeeping.ai';

export const BlogList: FC = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Blog | AI Bookkeeping';

    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const createdDesc = !metaDesc;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content =
      'Guides, tips, and insights for Canadian small business owners on bookkeeping, GST/HST tracking, and tax.';

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'ld-blog-list';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'AI Bookkeeping Blog',
      url: `${SITE_URL}/blog`,
      publisher: { '@type': 'Organization', name: 'Time2Win Inc.', url: SITE_URL },
    });
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      if (createdDesc) metaDesc?.remove();
      document.getElementById('ld-blog-list')?.remove();
    };
  }, []);

  return (
    <PublicPageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-400">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" className="hover:text-gray-700 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-700 font-medium">Blog</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Blog</h1>
        <p className="text-gray-500 mb-10">
          Guides and insights for Canadian small business owners.
        </p>

        {articles.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-lg font-medium">Articles coming soon.</p>
            <p className="text-gray-400 text-sm mt-2">Check back shortly.</p>
            <Link
              to="/faq"
              className="inline-block mt-6 text-sm font-medium text-[#0066FF] hover:underline"
            >
              Browse our FAQ in the meantime →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map((article) => (
              <article
                key={article.slug}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium bg-blue-50 text-[#0066FF] px-2.5 py-0.5 rounded-full">
                    {article.category}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(article.date)}</span>
                  <span className="text-xs text-gray-400">· {article.readTime}</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2 leading-snug">
                  <Link
                    to={`/blog/${article.slug}`}
                    className="hover:text-[#0066FF] transition-colors"
                  >
                    {article.title}
                  </Link>
                </h2>
                <p className="text-gray-500 leading-relaxed mb-4 text-sm">{article.excerpt}</p>
                <Link
                  to={`/blog/${article.slug}`}
                  className="text-sm font-medium text-[#0066FF] hover:underline"
                >
                  Read more →
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
};
