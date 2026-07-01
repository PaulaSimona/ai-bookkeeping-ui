import { type FC, type FormEvent, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import axios from 'axios';                    // BARE axios — NOT '@/utils/api' (its 401
import { API_DOMAIN } from '@/utils';          // interceptor would redirect an unauth visitor to /login)
import logoSvg from '@/assets/logo.svg';

// ─── Password input with show/hide toggle (same pattern as ResetPassword) ─────

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

const INPUT_CLASS = "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

export const StaffInviteAccept: FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [submitting, setSubmit]   = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 10) { setError('Password must be at least 10 characters.'); return; }
    setSubmit(true);
    setError('');
    try {
      // BARE axios + API_DOMAIN — public endpoint, no JWT, no interceptor.
      // Body is { token, password, first_name, last_name } ONLY — the accept
      // serializer does not accept confirm_password (confirm is client-side only).
      await axios.post(`${API_DOMAIN}/api/accounting/staff/invite/accept/`, {
        token,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      setSuccess(true);
    } catch (err: any) {
      // DRF shape: {"detail": ...} (NOT {"error": ...} like the auth endpoints).
      setError(err.response?.data?.detail ?? 'This link is invalid or has expired.');
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
            Accept your<br />invitation.
          </h1>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            Set your password to join AI Bookkeeping as an internal reviewer.
          </p>
        </div>
        <p className="text-white/30 text-sm">© 2026 Time2Win Inc.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm">
            <img src={logoSvg} alt="AI Bookkeeping" className="h-7 mb-10 lg:hidden" />

            {success ? (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Invitation accepted!</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Your account is ready. You can now sign in.
                </p>
                <NavLink
                  to="/login"
                  className="inline-flex rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-6 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  Sign in →
                </NavLink>
              </div>
            ) : !token ? (
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid link</h2>
                <p className="text-sm text-gray-500">This invite link is invalid or has expired.</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-gray-900">Set up your account</h2>
                <p className="mt-1 text-sm text-gray-500">Choose a password to accept your invitation.</p>

                {error && (
                  <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Optional"
                        autoComplete="given-name"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Optional"
                        autoComplete="family-name"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <PasswordInput
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 10 characters"
                      autoComplete="new-password"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                    <PasswordInput
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                  >
                    {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {submitting ? 'Accepting…' : 'Accept invitation'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
