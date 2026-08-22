import { type FC, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import logoSvg from '@/assets/logo.svg';
import SiteFooter from '@/components/Layout/SiteFooter';

export const PublicPageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <NavLink to="/" className="flex items-center shrink-0">
          <img src={logoSvg} alt="AI Bookkeeping" className="h-7 w-auto" />
        </NavLink>
        <nav className="flex items-center gap-1 sm:gap-3">
          {/* /blog is server-rendered by Django (O-S46-1/O-S46-11), so it must
              be a real navigation, not a react-router Link. No isActive branch
              is possible here — the SPA never owns this route. */}
          <a
            href="/blog"
            className="text-sm px-3 py-1.5 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
          >
            Blog
          </a>
          <NavLink
            to="/faq"
            className={({ isActive }) =>
              `text-sm px-3 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-[#0066FF] font-medium' : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            FAQ
          </NavLink>
          <NavLink
            to="/login"
            className="ml-1 text-sm font-medium bg-[#0066FF] text-white px-4 py-1.5 rounded-lg hover:bg-[#0052cc] transition-colors"
          >
            Sign in
          </NavLink>
        </nav>
      </div>
    </header>

    <main className="flex-1">{children}</main>

    <SiteFooter />
  </div>
);
