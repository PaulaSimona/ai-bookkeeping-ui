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

  const shouldShow = useMemo(() => {
    if (privatePath) return !!user;
    return !user;
  }, [user, privatePath]);

  if (inProgress) return <PageLoader />;
  if (shouldShow) return <>{children}</>;
  return <Navigate to={privatePath ? '/login' : '/dashboard'} replace />;
};
