import { type FC, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import logoSvg from '@/assets/logo.svg';
import { removeAuth } from '@/utils/auth';
import { revokeRefreshToken } from '@/utils/api';
import { setUser, setInProgress } from '@/store/features/authSlice';

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
  accounts:
    'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6',
  blog: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  faq:  'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
  reviewer:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  agentReview:
    'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
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
  feedback:
    'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
  logout:
    'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
};

const NAV_MAIN = [
  { to: '/dashboard', label: 'Dashboard',          icon: ICONS.dashboard },
  { to: '/documents', label: 'Documents',          icon: ICONS.documents },
  { to: '/workbook',  label: 'Workbook',           icon: ICONS.workbook  },
  { to: '/reports',   label: 'Reports',            icon: ICONS.reports   },
  { to: '/settings',  label: 'Settings',           icon: ICONS.settings  },
];

const NAV_BOTTOM = [
  { to: '/feedback', label: 'Feedback', icon: ICONS.feedback },
  { to: '/support',  label: 'Support',  icon: ICONS.support  },
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

// Confirmation dialog — styled to match the dark navy sidebar
const LogoutDialog: FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <>
    {/* Backdrop */}
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onCancel} />
    {/* Dialog */}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="bg-[#0A1628] border border-white/10 rounded-xl shadow-2xl w-full max-w-xs p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
            <Icon path={ICONS.logout} />
          </div>
          <h3 className="text-sm font-semibold text-white">Log out</h3>
        </div>

        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          Are you sure you want to log out?
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  </>
);

export const Sidebar: FC = () => {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const auth      = useSelector((s: RootState) => s.auth);
  const isStaff   = auth.user?.user?.is_staff ?? auth.user?.is_staff ?? false;
  const isSuperuser = auth.user?.user?.is_superuser ?? auth.user?.is_superuser ?? false;
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const confirmLogout = async () => {
    try {
      // Revoke the refresh token server-side (blacklist) before dropping it.
      await revokeRefreshToken();
    } finally {
      // Local cleanup always runs — logout must never strand the user.
      removeAuth();
      dispatch(setUser(null));
      dispatch(setInProgress(false));
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      <aside className="flex flex-col w-60 h-screen bg-[#0A1628] shrink-0">
        {/* Logo */}
        <div className="flex flex-col gap-1.5 px-5 py-4 border-b border-white/10">
          <img src={logoSvg} alt="AI Bookkeeping" className="h-[30px] w-auto" />
          <span className="self-start bg-amber-500 text-white text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded">
            Beta
          </span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_MAIN.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} />
          ))}
          {/* Chart of Accounts — Tier 2 feature, superuser-only for now. */}
          {/* TODO: swap to Tier 2 subscription check when Advanced plan is live */}
          {isSuperuser && (
            <>
              <div className="my-2 border-t border-white/10" />
              <NavItem to="/accounts" label="Chart of Accounts" icon={ICONS.accounts} />
            </>
          )}
          {/* Accounting Review — Tier 2 feature, superuser or staff/reviewer only. */}
          {/* TODO: swap to Tier 2 subscription check when Advanced plan is live */}
          {(isSuperuser || isStaff) && (
            <>
              <div className="my-2 border-t border-white/10" />
              <NavItem to="/accounting-review" label="Accounting Review" icon={ICONS.agentReview} />
            </>
          )}
          {isStaff && (
            <>
              <div className="my-2 border-t border-white/10" />
              <NavItem to="/reviewer" label="Reviewer" icon={ICONS.reviewer} />
            </>
          )}
        </nav>

        {/* Resources */}
        <div className="px-3 py-2 border-t border-white/10">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Resources
          </p>
          <NavItem to="/blog" label="Blog" icon={ICONS.blog} />
          <NavItem to="/faq"  label="FAQ"  icon={ICONS.faq}  />
        </div>

        {/* Bottom nav */}
        <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-0.5">
          {NAV_BOTTOM.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} />
          ))}

          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Icon path={ICONS.logout} />
            Log out
          </button>
        </div>
      </aside>

      {showLogoutDialog && (
        <LogoutDialog
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutDialog(false)}
        />
      )}
    </>
  );
};
