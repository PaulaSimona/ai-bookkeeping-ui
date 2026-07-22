// Public client-invite accept page (s24 U3 — D-S24-5, O-S24-2.1). Route
// /invite/accept, added to the PUBLIC routes. CRITICAL (trace item 12): BARE
// axios + API_DOMAIN, NOT the wrapped @/utils/api — the wrapped client's 401
// interceptor would bounce an unauthenticated visitor to /login. Mirrors
// StaffInviteAccept's shape, with two differences: (1) an AUTHENTICATED visitor
// is a LEGAL caller (existing-user path) — not bounced, shown a one-click
// confirm; (2) zero raw hex (brand tokens instead of the staff page's literals).
import { type FC, type FormEvent, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';                      // BARE axios — public endpoint, no interceptor
import { API_DOMAIN } from '@/utils';
import { getToken } from '@/utils/auth';
import { useUser } from '@/api/user/useUser';
import { type RootState } from '@/store/store';
import logoSvg from '@/assets/logo.svg';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] focus:border-transparent transition';

const EyeIcon: FC<{ visible: boolean }> = ({ visible }) => (
  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
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
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
      >
        <EyeIcon visible={show} />
      </button>
    </div>
  );
};

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-screen overflow-hidden">
    <div className="hidden w-[440px] shrink-0 flex-col justify-between bg-[var(--color-navy)] px-12 py-12 lg:flex">
      <img src={logoSvg} alt="AI Bookkeeping" className="h-[53px] w-auto" />
      <div>
        <h1 className="text-4xl font-bold leading-tight text-white">Join the<br />team.</h1>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          Accept your invitation to help manage the books on AI Bookkeeping.
        </p>
      </div>
      <p className="text-sm text-white/30">© 2026 Time2Win Inc.</p>
    </div>
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="flex min-h-full items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          <img src={logoSvg} alt="AI Bookkeeping" className="mb-10 h-7 lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  </div>
);

const PrimaryButton: FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; children: React.ReactNode }> = ({
  loading, children, ...props
}) => (
  <button
    {...props}
    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
  >
    {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
    {children}
  </button>
);

export const InviteAccept: FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const authed = !!getToken();
  const { user } = useSelector((s: RootState) => s.auth);
  const myEmail = user?.user?.email ?? user?.email ?? '';
  // Manual refresh only (auto=false) — used to reload the entitlement after an
  // authed accept so the "Continue" link into the Tier 2 dashboard isn't bounced
  // by RequireTier2 reading a stale has_tier2 (F-S24-4).
  const { getUser } = useUser(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [submitting, setSubmit]   = useState(false);
  const [error, setError]         = useState('');
  const [pwError, setPwError]     = useState('');
  const [orgName, setOrgName]     = useState<string | null>(null);
  const [pivot, setPivot]         = useState(false);

  const ACCEPT_URL = `${API_DOMAIN}/api/accounting/invite/accept/`;
  const loginNext = `/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`;

  // A — authenticated visitor: one-click accept with a manual Bearer header.
  const acceptAuthed = async () => {
    setSubmit(true); setError('');
    try {
      const res = await axios.post(ACCEPT_URL, { token }, { headers: { Authorization: `Bearer ${getToken()}` } });
      // Reload /me so redux has_tier2 reflects the just-activated accountant
      // membership BEFORE the success screen's "Continue" routes into the Tier 2
      // dashboard (RequireTier2 reads the entitlement from redux). (F-S24-4)
      await getUser?.();
      setOrgName(res.data?.org_name ?? '');
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'This invite link is invalid or has expired.');
    } finally {
      setSubmit(false);
    }
  };

  // B — anonymous visitor: create the account and accept.
  const acceptAnon = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (password !== confirm) { setPwError('Passwords do not match.'); return; }
    setSubmit(true); setError('');
    try {
      const res = await axios.post(ACCEPT_URL, { token, first_name: firstName, last_name: lastName, password });
      setOrgName(res.data?.org_name ?? '');
    } catch (err: any) {
      const status = err.response?.status;
      const d = err.response?.data;
      if (status === 409 && d?.code === 'account_exists') { setPivot(true); return; }
      if (d?.password) { setPwError(Array.isArray(d.password) ? d.password[0] : String(d.password)); return; }
      setError(d?.detail ?? 'This invite link is invalid or has expired.');
    } finally {
      setSubmit(false);
    }
  };

  // ── Success ──
  if (orgName !== null) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-gray-900">
            You’ve joined{orgName ? ` ${orgName}` : ''} as an accountant
          </h2>
          <p className="mb-6 text-sm text-gray-500">Your access is ready.</p>
          <NavLink
            to={authed ? '/accounting/dashboard' : '/login'}
            className="inline-flex rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Continue →
          </NavLink>
        </div>
      </Shell>
    );
  }

  // ── Pivot: account already exists (anon path; NEVER show the email) ──
  if (pivot) {
    return (
      <Shell>
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-semibold text-gray-900">You already have an account</h2>
          <p className="mb-6 text-sm text-gray-500">
            An account with the invited email already exists. Log in and reopen this link to accept the invitation.
          </p>
          <NavLink
            to={loginNext}
            className="inline-flex rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Log in to accept →
          </NavLink>
        </div>
      </Shell>
    );
  }

  // ── No token ──
  if (!token) {
    return (
      <Shell>
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Invalid link</h2>
          <p className="text-sm text-gray-500">This invite link is invalid or has expired.</p>
        </div>
      </Shell>
    );
  }

  const ErrorBanner = error ? (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  ) : null;

  // ── A: authenticated one-click confirm ──
  if (authed) {
    return (
      <Shell>
        <h2 className="text-2xl font-semibold text-gray-900">Accept invitation</h2>
        <p className="mt-1 text-sm text-gray-500">
          Accept this invitation{myEmail ? <> as <span className="font-medium text-gray-700">{myEmail}</span></> : ''}.
        </p>
        {ErrorBanner}
        <div className="mt-8">
          <PrimaryButton onClick={acceptAuthed} disabled={submitting} loading={submitting}>
            {submitting ? 'Accepting…' : 'Accept invitation'}
          </PrimaryButton>
        </div>
      </Shell>
    );
  }

  // ── B: anonymous set-up form ──
  return (
    <Shell>
      <h2 className="text-2xl font-semibold text-gray-900">Set up your account</h2>
      <p className="mt-1 text-sm text-gray-500">Choose a password to accept your invitation.</p>
      {ErrorBanner}

      <form onSubmit={acceptAnon} className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" autoComplete="given-name" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Optional" autoComplete="family-name" className={INPUT_CLASS} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
          <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 10 characters" autoComplete="new-password" className={INPUT_CLASS} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
          <PasswordInput required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" autoComplete="new-password" className={INPUT_CLASS} />
        </div>

        {pwError && <p className="text-sm text-red-600">{pwError}</p>}

        <PrimaryButton type="submit" disabled={submitting} loading={submitting}>
          {submitting ? 'Accepting…' : 'Accept invitation'}
        </PrimaryButton>
      </form>
    </Shell>
  );
};
