import { type FC, type PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { PageLoader } from '@/components/Loader';
import { useStaffMe } from '@/hooks/useStaffMe';

/**
 * Internal-console route guards (System B). Identity comes from useStaffMe
 * (GET /api/accounting/staff/me/) — never from User.is_staff / is_superuser.
 * Mirrors the existing client guards' convention: loading → PageLoader; denied →
 * silent <Navigate to="/dashboard" replace> (no flash, no error surfaced).
 */

export const RequireInternalStaff: FC<PropsWithChildren> = ({ children }) => {
  const { loading, staff } = useStaffMe();
  if (loading) return <PageLoader />;
  if (!staff) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const RequireInternalSuper: FC<PropsWithChildren> = ({ children }) => {
  const { loading, staff } = useStaffMe();
  if (loading) return <PageLoader />;
  if (!staff || !staff.isSuperUser) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
