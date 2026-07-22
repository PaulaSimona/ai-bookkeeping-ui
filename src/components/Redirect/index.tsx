import { useMemo, type FC, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { PageLoader } from '@/components/Loader';

interface Props {
  children: ReactNode;
  privatePath?: boolean;
}

export const RedirectPage: FC<Props> = ({ children, privatePath = false }) => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);
  const hasTier2 = user?.user?.has_tier2 ?? user?.has_tier2 ?? false;

  const shouldShow = useMemo(() => {
    if (privatePath) return !!user;
    return !user;
  }, [user, privatePath]);

  if (inProgress) return <PageLoader />;
  if (shouldShow) return <>{children}</>;
  // An authed visitor to a guest-only page (e.g. /login) lands on their tier's
  // home: Tier 2 → /accounting/dashboard, everyone else → today's /dashboard
  // (byte-preserved for Tier 1). Mirrors Login's post-auth branch (F-S24-4).
  const authedHome = hasTier2 ? '/accounting/dashboard' : '/dashboard';
  return <Navigate to={privatePath ? '/login' : authedHome} replace />;
};
