import { type FC, type ReactNode } from 'react';
import { NavLink, Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { PageLoader } from '@/components/Loader';
import { useStaffMe } from '@/hooks/useStaffMe';
import { removeAuth } from '@/utils/auth';
import { revokeRefreshToken } from '@/utils/api';
import { setUser, setInProgress } from '@/store/features/authSlice';

/**
 * Internal staff console shell (MASTER_T2 §15) — a dark sidebar on the shared
 * design system, separate from the client AppShell/PrivateLayout. No role-
 * switcher strip (prototype furniture). The super-user-only Administration
 * section is gated on staff.isSuperUser. Membership is gated here too (defense
 * in depth alongside the per-route guards); non-staff never see the shell.
 */

const IconQueue = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5"
    />
  </svg>
);
const IconClients = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
    />
  </svg>
);
const IconStaff = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);
const IconAssignments = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
    />
  </svg>
);

const IconKey = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
    />
  </svg>
);
const IconLogout = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
    />
  </svg>
);
const footerItemCls =
  'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors';

const NavItem: FC<{ to: string; icon: ReactNode; label: string }> = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive ? 'bg-[#0066FF] text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
      }`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

export const InternalLayout: FC = () => {
  const { loading, staff } = useStaffMe();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Reuses the client shell's logout mechanics VERBATIM (Sidebar.confirmLogout):
  // revoke the refresh token, drop local tokens, clear the auth slice, go to /login.
  const confirmLogout = async () => {
    try {
      await revokeRefreshToken();
    } finally {
      removeAuth();
      dispatch(setUser(null));
      dispatch(setInProgress(false));
      navigate('/login', { replace: true });
    }
  };

  if (loading) return <PageLoader />;
  if (!staff) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex">
      <aside className="w-60 shrink-0 border-r border-white/10 bg-[#0A1628] flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-sm font-bold text-white">Internal Console</div>
          <div className="text-xs text-white/40 mt-0.5">
            {staff.isSuperUser ? 'Super user' : 'Reviewer'}
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem to="/internal/queue" icon={IconQueue} label="Pending queue" />
          <NavItem to="/internal/clients" icon={IconClients} label="Assigned clients" />
          {staff.isSuperUser && (
            <div className="pt-4 mt-3 border-t border-white/10 space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/30">
                Administration
              </div>
              <NavItem to="/internal/staff" icon={IconStaff} label="Staff" />
              <NavItem to="/internal/assignments" icon={IconAssignments} label="Assignments" />
            </div>
          )}
        </nav>
        {/* Session controls (R-S27-F) — no PII beyond the role label already in
            the header. Change password routes to the existing /forgot-password
            flow (no new backend/form); Log out reuses the client mechanics. */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link to="/forgot-password" className={footerItemCls}>
            {IconKey}
            <span>Change password</span>
          </Link>
          <button type="button" onClick={confirmLogout} className={footerItemCls}>
            {IconLogout}
            <span>Log out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
};
