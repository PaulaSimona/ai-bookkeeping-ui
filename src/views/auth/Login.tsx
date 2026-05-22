import { type FC, type FormEvent, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLogin } from '@/api/auth/useLogin';
import { Loader } from '@/components/Loader';
import logoSvg from '@/assets/logo.svg';

// ─── Password input with show/hide toggle ─────────────────────────────────────

const EyeIcon: FC<{ visible: boolean }> = ({ visible }) => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    {visible ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    ) : (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </>
    )}
  </svg>
);

const PasswordInput: FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`pr-10 ${className}`} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <EyeIcon visible={show} />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  getUser?: () => void;
}

export const Login: FC<Props> = ({ getUser }) => {
  const navigate = useNavigate();
  const { login, success, error, errorCode, inProgress } = useLogin();
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
        <div className="text-white/30 text-xs space-y-1">
          <p>© 2026 Time2Win Inc.</p>
          <p className="flex items-center gap-2">
            <NavLink to="/privacy-policy"   className="hover:text-white/50 transition-colors">Privacy Policy</NavLink>
            <span>·</span>
            <NavLink to="/terms-of-service" className="hover:text-white/50 transition-colors">Terms of Service</NavLink>
          </p>
        </div>
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
              {errorCode === 'email_not_verified' && (
                <NavLink
                  to="/check-email"
                  state={{ email }}
                  className="ml-2 underline font-medium hover:text-red-900"
                >
                  Resend verification email
                </NavLink>
              )}
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
                <NavLink to="/forgot-password" className="text-xs text-[#0066FF] hover:underline">
                  Forgot password?
                </NavLink>
              </div>
              <PasswordInput
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

          <p className="mt-4 text-center text-xs text-gray-400">
            By continuing, you agree to our{' '}
            <NavLink to="/terms-of-service" className="underline hover:text-gray-600 transition-colors">Terms of Service</NavLink>
            {' '}and{' '}
            <NavLink to="/privacy-policy" className="underline hover:text-gray-600 transition-colors">Privacy Policy</NavLink>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};
