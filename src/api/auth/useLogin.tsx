import axios from 'axios';
import { useState } from 'react';
import { API_DOMAIN } from '../../utils';
import { setToken, setRefresh } from '../../utils/auth';

export const useLogin = (): any => {
  const [flags, setFlags] = useState({
    success: false,
    error: '',
    inProgress: false,
    completed: false,
  });

  const login = (data: { email: string; password: string }): void => {
    setFlags((f) => ({ ...f, inProgress: true, success: false }));

    axios
      .post(`${API_DOMAIN}/api/auth/token/`, data)
      .then((response) => {
        setToken(response.data.access);
        setRefresh(response.data.refresh);
        setFlags((f) => ({ ...f, success: true, error: '' }));
      })
      .catch((error) => {
        const data = error.response.data;
        const errorMessage =
          data.detail || 'something is wrong, try again later';
        setFlags((f) => ({
          ...f,
          error: errorMessage,
        }));
      })
      .finally(() => {
        setFlags((f) => ({ ...f, inProgress: false, completed: true }));
      });
  };

  return { login, ...flags };
};
