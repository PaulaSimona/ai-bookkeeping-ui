import { type FC, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import logoSvg from '@/assets/logo.svg';

export const PublicPageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <NavLink to="/" className="flex items-center shrink-0">
          <img src={logoSvg} alt="AI Bookkeeping" className="h-7 w-auto" />
        </NavLink>
        <nav className="flex items-center gap-1 sm:gap-3">
          <NavLink
            to="/blog"
            className={({ isActive }) =>
              `text-sm px-3 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-[#0066FF] font-medium' : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            Blog
          </NavLink>
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

    <footer className="border-t border-gray-100 bg-white mt-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-400">© 2026 Time2Win Inc.</p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
          <span className="font-medium text-gray-500">Resources</span>
          <NavLink to="/blog" className="hover:text-gray-700 transition-colors">Blog</NavLink>
          <NavLink to="/faq" className="hover:text-gray-700 transition-colors">FAQ</NavLink>
          <NavLink to="/privacy-policy" className="hover:text-gray-700 transition-colors">Privacy</NavLink>
          <NavLink to="/terms-of-service" className="hover:text-gray-700 transition-colors">Terms</NavLink>
        </div>
      </div>
    </footer>
  </div>
);
