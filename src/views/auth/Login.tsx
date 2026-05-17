import { type FC, type FormEvent, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLogin } from '@/api/auth/useLogin';
import { Loader } from '@/components/Loader';
import logoSvg from '@/assets/logo.svg';

interface Props {
  getUser?: () => void;
}

export const Login: FC<Props> = ({ getUser }) => {
  const navigate = useNavigate();
  const { login, success, error, inProgress } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (success) {
      getUser?.();
      navigate('/dashboard');
    }
  }, [success, getUser, navigate]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-[#0A1628] px-12 py-12">
        <img src={logoSvg} alt="AI Bookkeeping" className="h-[53px] w-auto" />
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Smart bookkeeping,<br />powered by AI.
          </h1>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            Upload receipts and invoices. We extract, categorize, and organize
            your expenses — be always ready for tax time.
          </p>
        </div>
        <p className="text-white/30 text-sm">© 2026 Time2Win Inc.</p>
      </div>

      {/* Right panel — outer div scrolls, inner div centers */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <img src={logoSvg} alt="AI Bookkeeping" className="h-7 mb-10 lg:hidden" />

          <h2 className="text-2xl font-semibold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>

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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <a href="#" className="text-xs text-[#0066FF] hover:underline">
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={inProgress}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {inProgress ? <><Loader /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <NavLink to="/register" className="font-medium text-[#0066FF] hover:underline">
              Create one
            </NavLink>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};
