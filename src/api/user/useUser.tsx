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

  const getUser = useCallback((): void => {
    if (retryCount >= 3) return;

    if (!getToken()) {
      dispatch(setInProgress(false));
      return;
    }

    if (!inProgress) dispatch(setInProgress(true));

    api
      .get(`${API_DOMAIN}/api/user/me`)
      .then((response) => {
        dispatch(setUser(response.data));
        dispatch(setInProgress(false));
      })
      .catch(() => {
        setRetryCount((prevCount: number) => prevCount + 1);
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
