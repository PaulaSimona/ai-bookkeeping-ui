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
  ledger:
    'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  workbook:
    'M3 10h18M3 14h18M10 3v18M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3z',
  reports:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  settings:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  taxProfile:
    'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  bank:
    'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z',
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
  // §21 entitlement flag (D-21-3) — same derivation shape as the staff flags;
  // wired into the Tier 2 nav block + single-Documents rule in D-21-5.
  const hasTier2 = auth.user?.user?.has_tier2 ?? auth.user?.has_tier2 ?? false;
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
          {/* Tier 2 user features — §21 entitlement gate (D-21-5); §14 D-14C-6
              nav order. The Tier 2 group renders BEFORE the surviving NAV_MAIN
              items, so the on-screen order for a hasTier2 user is:
              Dashboard · Documents · Ledger · Tax Profile · Bank connections ·
              Workbook · Reports · Settings. Stays in the main-nav group (no
              divider). */}
          {hasTier2 && (
            <>
              <NavItem to="/accounting/dashboard" label="Dashboard" icon={ICONS.dashboard} />
              <NavItem to="/accounting/documents" label="Documents" icon={ICONS.documents} />
              <NavItem to="/accounting/ledger" label="Ledger" icon={ICONS.ledger} />
              {/* 14-C-2b (D-14C-6 amendment): Clients + Suppliers after Ledger.
                  Glyph paths inlined (people / archive-box) so the entire
                  addition stays inside this hasTier2 && guard. */}
              <NavItem to="/accounting/clients" label="Clients" icon="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              <NavItem to="/accounting/suppliers" label="Suppliers" icon="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              {/* 14-C-3 (D-14C-6 amendment): Reports + Taxes after Suppliers.
                  Glyph paths inlined (chart-bar / receipt-percent) so the entire
                  addition stays inside this same hasTier2 && guard. */}
              <NavItem to="/accounting/reports" label="Reports" icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              <NavItem to="/accounting/taxes" label="Taxes" icon="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              <NavItem to="/accounting/tax-profile" label="Tax Profile" icon={ICONS.taxProfile} />
              <NavItem to="/accounting/bank-connections" label="Bank connections" icon={ICONS.bank} />
            </>
          )}
          {/* One "Documents" + one "Dashboard" per user (§21 D-21-5, §14 D-14B-6):
              the Tier 1 Documents and Dashboard entries are hidden for Tier 2
              users, who get the Tier 2 equivalents above. hasTier2=false renders
              NAV_MAIN byte-identically to today — the Tier 2 block above
              collapses to nothing and this filter predicate collapses to
              !(false) = keep-all, so the map output is unchanged. */}
          {NAV_MAIN.filter((item) => !(hasTier2 && (item.to === '/documents' || item.to === '/dashboard' || item.to === '/reports' || item.to === '/workbook'))).map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} />
          ))}
          {/* Chart of Accounts + Reviewer Management — staff tools, superuser-only.
              §21: stays superuser; Chart of Accounts is exposed to Tier 2 users
              deliberately at §14 (D-21-5). */}
          {isSuperuser && (
            <>
              <div className="my-2 border-t border-white/10" />
              <NavItem to="/accounts" label="Chart of Accounts" icon={ICONS.accounts} />
              <NavItem to="/reviewer-management" label="Reviewer Management" icon={ICONS.reviewer} />
            </>
          )}
          {/* Accounting Review — staff-only internal reviewer queue (superuser or
              staff/reviewer). §21: stays staff-gated, not a Tier 2 user surface (D-21-5). */}
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
