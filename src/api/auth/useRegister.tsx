import axios from 'axios';
import { useState } from 'react';
import { API_DOMAIN } from '../../utils';
import { setToken, setRefresh } from '../../utils/auth';

export const useRegister = (): any => {
  const [flags, setFlags] = useState({
    success: false,
    error: '',
    inProgress: false,
    completed: false,
  });
  const [errors, setErrors] = useState({
    email: [],
    first_name: [],
    last_name: [],
    phone_number: [],
    password: [],
    confirm: [],
  });

  const check = (obj: any, key: string): boolean => {
    return (
      typeof obj[key] === 'object' &&
      obj[key] !== null &&
      typeof obj[key][key] !== 'undefined'
    );
  };

  const handleErrors = (responseData: any): any => {
    const newErrors: any = { ...errors };
    Object.keys(newErrors).forEach((key) => {
      if (check(responseData, key)) {
        newErrors[key] = [responseData[key][key]];
      }
    });
    return newErrors;
  };

  const register = async (data: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    password: string;
    confirm: string;
  }): Promise<any> => {
    setFlags((f) => ({ ...f, inProgress: true, success: false }));

    axios
      .post(`${API_DOMAIN}/api/auth/register/`, data)
      .then((response) => {
        setToken(response.data.access);
        setRefresh(response.data.refresh);
        setFlags((f) => ({ ...f, success: true, error: '' }));
      })
      .catch((error) => {
        if (error.response?.status === 400) {
          setErrors(handleErrors(error.response.data));
        }
        setFlags((f) => ({ ...f, error: 'Error al registrar' }));
      })
      .finally(() => {
        setFlags((f) => ({ ...f, inProgress: false, completed: true }));
      });
  };

  return { register, errors, ...flags };
};
