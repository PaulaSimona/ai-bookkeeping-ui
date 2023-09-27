import { Navigate } from 'react-router-dom';

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store/store';
import { PageLoader } from '../Loader';

/**
 * RedirectPage
 * @param {boolean} privatePath: if true when user is not logged redirect to
 * /login else redirect to private path
 */

export const RedirectPage = ({
  children,
  privatePath,
  publicPath,
  onlyAdmin,
}: any): any => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);

  const shouldShow: boolean = useMemo(() => {
    if (privatePath) return !!user;
    if (onlyAdmin && user) return user?.user.role === 'admin';
    return !user;
  }, [user, privatePath, onlyAdmin]);

  const redirectPath = privatePath ? '/login' : '/';

  if (publicPath) {
    return children;
  }

  if (inProgress) {
    return <PageLoader />;
  }
  if (shouldShow) {
    return children;
  }
  return <Navigate to={redirectPath} />;
};
