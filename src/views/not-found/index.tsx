import { type FC, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageShell } from '@/components/Layout/PublicPageShell';

/**
 * Catch-all 404 page (O-S49-3 d). Replaces the former
 * `<Navigate to="/" replace />` that silently sent every unknown URL to the
 * homepage — an honest "page not found" instead. Wrapped in PublicPageShell
 * for the shared marketing header/footer, matching the other public pages
 * (style reference: src/views/faq/index.tsx).
 */
export const NotFound: FC = () => {
  // D-S49-3: set the tab title, mirroring the FAQ page's save/set/restore
  // pattern (src/views/faq/index.tsx:194-196, 222-223).
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Page not found';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <PublicPageShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-8">
          This page doesn't exist or may have moved.
        </p>
        <Link to="/" className="text-[#0066FF] hover:underline">
          Back to home
        </Link>
      </div>
    </PublicPageShell>
  );
};
