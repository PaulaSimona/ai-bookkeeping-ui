import { useMemo, type FC, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { staffAwareHomePath } from '@/utils/activeOrg';
import { getSafeNext } from '@/utils/safeNext';
import { PageLoader } from '@/components/Loader';

interface Props {
  children: ReactNode;
  privatePath?: boolean;
}

export const RedirectPage: FC<Props> = ({ children, privatePath = false }) => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);
  const location = useLocation();

  const shouldShow = useMemo(() => {
    if (privatePath) return !!user;
    return !user;
  }, [user, privatePath]);

  if (inProgress) return <PageLoader />;
  if (shouldShow) return <>{children}</>;
  // An authed visitor to a guest-only page (e.g. /login) lands on their tier's
  // home: internal staff → /internal/queue (F-S28-1); Tier 2 owner →
  // /accounting/dashboard, Tier 2 accountant → /accountant/ledger, everyone else
  // → today's /dashboard (byte-preserved for Tier 1). This is the branch that
  // wins post-login navigation, so the staff-aware resolver lives HERE too.
  const authedHome = staffAwareHomePath(user, '/dashboard');
  // F-S25-4 (D-S25-8): on the PUBLIC-path branch, honor ?next= FIRST — the auth
  // flip during login can redirect here before Login's own safeNext navigate
  // runs (unmounting Login and cancelling it), which silently dropped ?next=
  // live. Same single-source guard as Login. The privatePath branch (→ /login)
  // is untouched — a private page never carries a trusted post-auth target here.
  const publicTarget = getSafeNext(location.search) ?? authedHome;
  return <Navigate to={privatePath ? '/login' : publicTarget} replace />;
};
