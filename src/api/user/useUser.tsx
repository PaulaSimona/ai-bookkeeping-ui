import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { API_DOMAIN } from '../../utils';
import { getToken } from '../../utils/auth';
import { setUser, setInProgress } from '../../store/features/authSlice';
import { type RootState } from '../../store/store';
import api from '../../utils/api';

export const useUser: any = () => {
  const { inProgress, user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch();

  const getUser = useCallback((): void => {
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
      .finally(() => {
        dispatch(setInProgress(false));
      });
  }, [dispatch, inProgress]);

  useEffect(() => {
    if (!user) getUser();
  }, [user, getUser]);

  return { getUser, user };
};
