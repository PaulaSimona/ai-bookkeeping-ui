import { type FC, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_DOMAIN } from '@/utils';
import logoSvg from '@/assets/logo.svg';

export const VerifyEmail: FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [state, setState] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('No verification token found.'); return; }

    axios.get(`${API_DOMAIN}/api/auth/verify-email/?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (res.data?.already_verified) setState('already');
        else setState('success');
      })
      .catch((err) => {
        setState('error');
        setErrorMsg(err.response?.data?.error ?? 'This link is invalid or has expired.');
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-sm w-full text-center">
        <img src={logoSvg} alt="AI Bookkeeping" className="h-7 mx-auto mb-8" />

        {state === 'loading' && (
          <>
            <div className="w-8 h-8 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Verifying your email…</p>
          </>
        )}

        {(state === 'success' || state === 'already') && (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {state === 'already' ? 'Already verified' : 'Email verified!'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {state === 'already'
                ? 'Your email was already verified. You can sign in.'
                : 'Your account is now active. You can sign in.'}
            </p>
            <Link
              to="/login"
              className="inline-flex rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-6 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              Sign in →
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification failed</h2>
            <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
            <Link to="/register" className="text-sm text-[#0066FF] hover:underline font-medium">
              Back to registration
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
