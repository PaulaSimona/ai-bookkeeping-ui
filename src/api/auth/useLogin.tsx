import axios from 'axios';
import { useState } from 'react';
import { API_DOMAIN } from '../../utils';
import { setToken, setRefresh } from '../../utils/auth';

export const useLogin = (): any => {
  const [flags, setFlags] = useState({
    success: false,
    error: '',
    errorCode: '',
    inProgress: false,
    completed: false,
  });

  const login = (data: { email: string; password: string }): void => {
    setFlags((f) => ({ ...f, inProgress: true, success: false, error: '', errorCode: '' }));

    axios
      .post(`${API_DOMAIN}/api/auth/token/`, data)
      .then((response) => {
        setToken(response.data.access);
        setRefresh(response.data.refresh);
        setFlags((f) => ({ ...f, success: true, error: '', errorCode: '' }));
      })
      .catch((error) => {
        const responseData = error.response?.data ?? {};
        const errorMessage = responseData.detail || 'Something went wrong. Please try again.';
        const errorCode = responseData.error_code || '';
        setFlags((f) => ({ ...f, error: errorMessage, errorCode }));
      })
      .finally(() => {
        setFlags((f) => ({ ...f, inProgress: false, completed: true }));
      });
  };

  return { login, ...flags };
};
