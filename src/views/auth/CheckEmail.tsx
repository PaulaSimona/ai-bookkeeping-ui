import { type FC, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_DOMAIN } from '@/utils';
import logoSvg from '@/assets/logo.svg';

export const CheckEmail: FC = () => {
  const location = useLocation();
  const email: string = (location.state as any)?.email ?? '';

  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);
  const [resendErr, setResendErr] = useState('');

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    setResendErr('');
    try {
      await axios.post(`${API_DOMAIN}/api/auth/resend-verification/`, { email });
      setResent(true);
    } catch {
      setResendErr('Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-[#0A1628] px-12 py-12">
        <img src={logoSvg} alt="AI Bookkeeping" className="h-8 w-auto" />
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            One last step.
          </h1>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            Check your inbox and verify your email to activate your account.
          </p>
        </div>
        <p className="text-white/30 text-sm">© 2026 Time2Win Inc.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm text-center">
            <img src={logoSvg} alt="AI Bookkeeping" className="h-7 mb-10 mx-auto lg:hidden" />

            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#0066FF]" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              We sent a confirmation link to{' '}
              <span className="font-semibold text-gray-800">{email || 'your email address'}</span>.
              Please verify your email to activate your account.
            </p>

            <div className="mt-8 space-y-3">
              {resent && (
                <p className="text-sm text-emerald-600 font-medium">Verification email resent!</p>
              )}
              {resendErr && (
                <p className="text-sm text-red-600">{resendErr}</p>
              )}
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors"
              >
                {resending && <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
                {resending ? 'Resending…' : 'Resend email'}
              </button>

              <p className="text-xs text-gray-400">
                Already verified?{' '}
                <a href="/login" className="text-[#0066FF] hover:underline font-medium">Sign in</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
