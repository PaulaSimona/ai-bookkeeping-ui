import { useEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { API_DOMAIN } from '../../utils';
import { getToken } from '../../utils/auth';
import { setUser, setInProgress } from '../../store/features/authSlice';
import { type RootState } from '../../store/store';
import api from '../../utils/api';

export const useUser: any = (auto: boolean) => {
  const { inProgress, user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch();

  const [retryCount, setRetryCount] = useState<number>(0);

  // Returns a Promise resolving to the /me payload (or undefined on a skipped /
  // failed fetch) so callers that need the freshly-loaded entitlement can await
  // it before routing (F-S24-4: Login/InviteAccept branch on has_tier2). The
  // auto useEffect and existing void callers ignore the return value unchanged.
  const getUser = useCallback((): Promise<any> => {
    if (retryCount >= 3) return Promise.resolve(undefined);

    if (!getToken()) {
      dispatch(setInProgress(false));
      return Promise.resolve(undefined);
    }

    if (!inProgress) dispatch(setInProgress(true));

    return api
      .get(`${API_DOMAIN}/api/user/me`)
      .then((response) => {
        dispatch(setUser(response.data));
        dispatch(setInProgress(false));
        return response.data;
      })
      .catch(() => {
        setRetryCount((prevCount: number) => prevCount + 1);
        return undefined;
      })
      .finally(() => {
        dispatch(setInProgress(false));
      });
  }, [dispatch, inProgress, retryCount]);

  useEffect(() => {
    if (!user && auto) {
      if (retryCount < 3) {
        const retryTimeout = setTimeout(getUser, 5000 * retryCount);
        return () => clearTimeout(retryTimeout);
      }
    }
  }, [user, getUser, auto, retryCount]);

  return { getUser, user };
};
