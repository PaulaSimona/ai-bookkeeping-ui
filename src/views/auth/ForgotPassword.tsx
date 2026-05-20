import { type FC, type FormEvent, useState } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import { API_DOMAIN } from '@/utils';
import logoSvg from '@/assets/logo.svg';

export const ForgotPassword: FC = () => {
  const [email, setEmail]       = useState('');
  const [submitting, setSubmit] = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmit(true);
    setError('');
    try {
      await axios.post(`${API_DOMAIN}/api/auth/forgot-password/`, { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-[#0A1628] px-12 py-12">
        <img src={logoSvg} alt="AI Bookkeeping" className="h-[53px] w-auto" />
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Forgot your<br />password?
          </h1>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            No problem. Enter your email and we'll send you a secure reset link.
          </p>
        </div>
        <p className="text-white/30 text-sm">© 2026 Time2Win Inc.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm">
            <img src={logoSvg} alt="AI Bookkeeping" className="h-7 mb-10 lg:hidden" />

            <h2 className="text-2xl font-semibold text-gray-900">Reset your password</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter your account email and we'll send a reset link.
            </p>

            {sent ? (
              <div className="mt-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-4 text-sm text-emerald-800">
                If that email is registered, you'll receive a reset link shortly.
                Check your inbox — the link expires in 24 hours.
              </div>
            ) : (
              <>
                {error && (
                  <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                  >
                    {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {submitting ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              </>
            )}

            <p className="mt-6 text-center text-sm text-gray-500">
              Remember your password?{' '}
              <NavLink to="/login" className="font-medium text-[#0066FF] hover:underline">
                Sign in
              </NavLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
