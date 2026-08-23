import { type FC } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Shared public-site footer: copyright + a "Resources" row of crawlable links
 * (Blog, FAQ, Privacy, Terms). Rendered on the marketing/legal SPA-fallback
 * pages so every one carries internal links to /faq, /privacy-policy, and
 * /terms-of-service (O-S53-8). Markup matches the footer PublicPageShell shipped
 * previously; that component now renders this. /blog is a real Django-rendered
 * route, so it stays a plain <a href>, not a react-router link.
 */
const SiteFooter: FC = () => (
  <footer className="border-t border-gray-100 bg-white mt-auto">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-sm text-gray-400">© 2026 Time2Win Inc.</p>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
        <span className="font-medium text-gray-500">Resources</span>
        <NavLink to="/pricing" className="hover:text-gray-700 transition-colors">Pricing</NavLink>
        <a href="/blog" className="hover:text-gray-700 transition-colors">Blog</a>
        <NavLink to="/faq" className="hover:text-gray-700 transition-colors">FAQ</NavLink>
        <NavLink to="/privacy-policy" className="hover:text-gray-700 transition-colors">Privacy</NavLink>
        <NavLink to="/terms-of-service" className="hover:text-gray-700 transition-colors">Terms</NavLink>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
