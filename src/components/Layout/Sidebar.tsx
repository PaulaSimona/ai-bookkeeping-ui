import { type FC } from 'react';
import { NavLink } from 'react-router-dom';
import logoSvg from '@/assets/logo.svg';

// Heroicons outline paths (24×24 viewBox, stroke)
const Icon: FC<{ path: string }> = ({ path }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.6}
    stroke="currentColor"
    className="w-[18px] h-[18px] shrink-0"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  documents:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  workbook:
    'M3 10h18M3 14h18M10 3v18M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3z',
  reports:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  settings:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  support:
    'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const NAV_MAIN = [
  { to: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  { to: '/documents', label: 'Documents', icon: ICONS.documents },
  { to: '/workbook',  label: 'Workbook',  icon: ICONS.workbook  },
  { to: '/reports',   label: 'Reports',   icon: ICONS.reports   },
  { to: '/settings',  label: 'Settings',  icon: ICONS.settings  },
];

const NAV_BOTTOM = [
  { to: '/support', label: 'Support', icon: ICONS.support },
];

const NavItem: FC<{ to: string; label: string; icon: string; end?: boolean }> = ({
  to, label, icon, end = false,
}) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-[#0066FF] text-white'
          : 'text-white/60 hover:text-white hover:bg-white/8'
      }`
    }
  >
    <Icon path={icon} />
    {label}
  </NavLink>
);

export const Sidebar: FC = () => (
  <aside className="flex flex-col w-60 h-screen bg-[#0A1628] shrink-0">
    {/* Logo */}
    <div className="flex items-center px-5 py-5 border-b border-white/10">
      <img src={logoSvg} alt="AI Bookkeeping" className="h-[30px] w-auto" />
    </div>

    {/* Main nav */}
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {NAV_MAIN.map(({ to, label, icon }) => (
        <NavItem key={to} to={to} label={label} icon={icon} />
      ))}
    </nav>

    {/* Bottom nav */}
    <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-0.5">
      {NAV_BOTTOM.map(({ to, label, icon }) => (
        <NavItem key={to} to={to} label={label} icon={icon} />
      ))}
    </div>
  </aside>
);
