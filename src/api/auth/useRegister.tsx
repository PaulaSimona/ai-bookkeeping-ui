import axios from 'axios';
import { useState } from 'react';
import { API_DOMAIN } from '../../utils';
import type { CountryCode } from '../../utils/constants';

/**
 * The registration wire payload (O-S33-1).
 *
 * `country` and `province` are declared TOGETHER and honestly: the backend
 * requires a valid region CODE for the country when country is present, and
 * 400s anything else. Typing them here is what stops a caller quietly
 * sending a display name or a stale 'OTHER' — the same type-level principle
 * C5b applied when it removed mapped_account from ClassifyPayload.
 */
export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm: string;
  province: string;
  country: CountryCode;
  phone_number?: string;
}

const EMPTY_ERRORS = {
  email: [] as string[],
  first_name: [] as string[],
  last_name: [] as string[],
  phone_number: [] as string[],
  password: [] as string[],
  confirm: [] as string[],
  province: [] as string[],
};

const extractFieldErrors = (data: any): typeof EMPTY_ERRORS => {
  const result: any = { ...EMPTY_ERRORS };
  if (!data || typeof data !== 'object') return result;
  Object.keys(result).forEach((key) => {
    const val = data[key];
    if (!val) return;
    if (Array.isArray(val)) result[key] = val.map(String);
    else if (typeof val === 'string') result[key] = [val];
    else if (typeof val === 'object') {
      const inner = val[key];
      if (inner) result[key] = Array.isArray(inner) ? inner.map(String) : [String(inner)];
    }
  });
  return result;
};

interface UseRegister {
  register: (data: RegisterPayload) => Promise<void>;
  errors: typeof EMPTY_ERRORS;
  success: boolean;
  requiresVerification: boolean;
  registeredEmail: string;
  error: string;
  inProgress: boolean;
  completed: boolean;
}

// The return type was annotated `: any`, which erased every type on the way
// out — `register` arrived at the call site as `any`, so its parameter type
// was never enforced and Register.tsx could pass an object missing required
// fields with a clean tsc. Typed properly, the RegisterPayload contract above
// actually binds.
export const useRegister = (): UseRegister => {
  const [flags, setFlags] = useState({
    success: false,
    requiresVerification: false,
    registeredEmail: '',
    error: '',
    inProgress: false,
    completed: false,
  });
  const [errors, setErrors] = useState(EMPTY_ERRORS);

  const register = async (data: RegisterPayload): Promise<void> => {
    setFlags((f) => ({ ...f, inProgress: true, success: false, requiresVerification: false, error: '' }));
    setErrors(EMPTY_ERRORS);

    axios
      .post(`${API_DOMAIN}/api/auth/register/`, data)
      .then((response) => {
        if (response.data?.requires_verification) {
          setFlags((f) => ({
            ...f,
            requiresVerification: true,
            registeredEmail: response.data.email ?? data.email,
            error: '',
          }));
        } else {
          // Legacy: tokens returned directly (shouldn't happen post email-verification feature)
          setFlags((f) => ({ ...f, success: true, error: '' }));
        }
      })
      .catch((err) => {
        const status: number = err.response?.status;
        const responseData = err.response?.data;
        console.error('[register] API error', { status, data: responseData });

        if (status === 400 && responseData) {
          const fieldErrors = extractFieldErrors(responseData);
          setErrors(fieldErrors);
          const hasField = Object.values(fieldErrors).some((v) => v.length > 0);
          if (!hasField) {
            const detail =
              responseData.detail ||
              responseData.non_field_errors?.[0] ||
              'Registration failed. Please check your details and try again.';
            setFlags((f) => ({ ...f, error: String(detail) }));
          }
        } else {
          setFlags((f) => ({ ...f, error: 'Something went wrong. Please try again.' }));
        }
      })
      .finally(() => {
        setFlags((f) => ({ ...f, inProgress: false, completed: true }));
      });
  };

  return { register, errors, ...flags };
};
