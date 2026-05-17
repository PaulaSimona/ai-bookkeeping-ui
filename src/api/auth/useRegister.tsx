import axios from 'axios';
import { useState } from 'react';
import { API_DOMAIN } from '../../utils';
import { setToken, setRefresh } from '../../utils/auth';

const EMPTY_ERRORS = {
  email: [] as string[],
  first_name: [] as string[],
  last_name: [] as string[],
  phone_number: [] as string[],
  password: [] as string[],
  confirm: [] as string[],
};

/**
 * DRF returns field errors in several shapes:
 *   flat list   → { email: ["msg"] }
 *   nested obj  → { email: { email: "msg" } }   (from validate_email raising {email: "..."})
 * This normalises both into string[].
 */
const extractFieldErrors = (data: any): typeof EMPTY_ERRORS => {
  const result: any = { ...EMPTY_ERRORS };
  if (!data || typeof data !== 'object') return result;

  Object.keys(result).forEach((key) => {
    const val = data[key];
    if (!val) return;

    if (Array.isArray(val)) {
      // flat list: { email: ["msg"] }
      result[key] = val.map(String);
    } else if (typeof val === 'string') {
      // bare string: { email: "msg" }
      result[key] = [val];
    } else if (typeof val === 'object') {
      // nested obj: { email: { email: "msg" } }
      const inner = val[key];
      if (inner) result[key] = Array.isArray(inner) ? inner.map(String) : [String(inner)];
    }
  });

  return result;
};

export const useRegister = (): any => {
  const [flags, setFlags] = useState({
    success: false,
    error: '',
    inProgress: false,
    completed: false,
  });
  const [errors, setErrors] = useState(EMPTY_ERRORS);

  const register = async (data: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    password: string;
    confirm: string;
  }): Promise<any> => {
    setFlags((f) => ({ ...f, inProgress: true, success: false, error: '' }));
    setErrors(EMPTY_ERRORS);

    axios
      .post(`${API_DOMAIN}/api/auth/register/`, data)
      .then((response) => {
        setToken(response.data.access);
        setRefresh(response.data.refresh);
        setFlags((f) => ({ ...f, success: true, error: '' }));
      })
      .catch((err) => {
        const status: number = err.response?.status;
        const responseData = err.response?.data;

        // Always log the full response so it's visible in DevTools
        console.error('[register] API error', { status, data: responseData });

        if (status === 400 && responseData) {
          const fieldErrors = extractFieldErrors(responseData);
          setErrors(fieldErrors);

          // If there are no recognised field errors, surface a generic message
          const hasField = Object.values(fieldErrors).some((v) => v.length > 0);
          if (!hasField) {
            const detail =
              responseData.detail ||
              responseData.non_field_errors?.[0] ||
              'Registration failed. Please check your details and try again.';
            setFlags((f) => ({ ...f, error: String(detail) }));
          }
        } else {
          setFlags((f) => ({
            ...f,
            error: 'Something went wrong. Please try again.',
          }));
        }
      })
      .finally(() => {
        setFlags((f) => ({ ...f, inProgress: false, completed: true }));
      });
  };

  return { register, errors, ...flags };
};
