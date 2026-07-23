import { useMemo, type FC, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { authedHomePath } from '@/utils/activeOrg';
import { PageLoader } from '@/components/Loader';

interface Props {
  children: ReactNode;
  privatePath?: boolean;
}

export const RedirectPage: FC<Props> = ({ children, privatePath = false }) => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);

  const shouldShow = useMemo(() => {
    if (privatePath) return !!user;
    return !user;
  }, [user, privatePath]);

  if (inProgress) return <PageLoader />;
  if (shouldShow) return <>{children}</>;
  // An authed visitor to a guest-only page (e.g. /login) lands on their tier's
  // home: Tier 2 owner → /accounting/dashboard, Tier 2 accountant →
  // /accountant/ledger, everyone else → today's /dashboard (byte-preserved for
  // Tier 1). Mirrors Login's post-auth branch (F-S24-4; Session-25 Phase E).
  const authedHome = authedHomePath(user, '/dashboard');
  return <Navigate to={privatePath ? '/login' : authedHome} replace />;
};
