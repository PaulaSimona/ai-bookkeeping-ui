import { type FC, type PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { authedHomePath } from '@/utils/activeOrg';
import { PageLoader } from '@/components/Loader';
import { useStaffMe } from '@/hooks/useStaffMe';

/**
 * Internal-console route guards (System B). Identity comes from useStaffMe
 * (GET /api/accounting/staff/me/) — never from User.is_staff / is_superuser.
 * Mirrors the existing client guards' convention: loading → PageLoader; denied →
 * silent redirect. R-S27-D: the deny target uses authedHomePath (the same
 * resolver HomeRedirect uses) with '/dashboard' as fallback, so a Tier 2 client
 * bounced from /internal lands on their own dashboard rather than a static one.
 */

export const RequireInternalStaff: FC<PropsWithChildren> = ({ children }) => {
  const { loading, staff } = useStaffMe();
  const { user } = useSelector((s: RootState) => s.auth);
  if (loading) return <PageLoader />;
  if (!staff) return <Navigate to={authedHomePath(user, '/dashboard')} replace />;
  return <>{children}</>;
};

export const RequireInternalSuper: FC<PropsWithChildren> = ({ children }) => {
  const { loading, staff } = useStaffMe();
  const { user } = useSelector((s: RootState) => s.auth);
  if (loading) return <PageLoader />;
  if (!staff || !staff.isSuperUser) return <Navigate to={authedHomePath(user, '/dashboard')} replace />;
  return <>{children}</>;
};
