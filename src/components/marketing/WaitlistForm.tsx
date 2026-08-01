// Shared Advanced-waitlist form (S32 C2).
//
// ONE component for every waitlist surface. Three near-identical WaitlistModal
// copies exist today (LandingPage, views/pricing, views/subscription) and have
// already drifted; this replaces the homepage copy now, and pricing +
// subscription migrate onto it in C3.
//
// Wire contract is the C1 backend (waitlist/views.py): POST /api/waitlist/
// { email, features_wanted, country, source }. The endpoint always answers 200
// for a valid address — created and duplicate are indistinguishable by design
// (no account enumeration), so the success state is the same either way.
//
// `source` is sent on EVERY submit: C1 persists first-touch attribution and
// the field was previously never set at all.
import { type FC, type FormEvent, useState } from 'react';
import api from '@/utils/api';

export type WaitlistSource = 'homepage' | 'pricing' | 'subscription';
export type WaitlistVariant = 'inline' | 'modal';

// The eight capability labels the waitlist asks about. Kept as plain strings —
// they are stored verbatim in WaitlistEntry.features_wanted and read by a human,
// so they must stay readable rather than becoming codes.
export const WAITLIST_FEATURES: string[] = [
  'Bank connections',
  'Reconciliation',
  'P&L and Balance Sheet',
  'Jurisdiction-aware tax handling',
  'Human review of uncertain entries',
  'Accountant access',
  'Invoices and bills',
  'Cash-flow visibility',
];

const COUNTRIES: { value: 'CA' | 'US'; label: string }[] = [
  { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'United States' },
];

// Deliberately permissive: the server is the authority on address validity.
// This only catches the obvious typo before a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  source: WaitlistSource;
  variant?: WaitlistVariant;
}

export const WaitlistForm: FC<Props> = ({ source, variant = 'inline' }) => {
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<'CA' | 'US' | ''>('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // `variant` controls CHROME, not colour: both surfaces this renders on are
  // light (the homepage panel sits on white, and a modal panel IS white), so
  // the palette is the same and only the wrapping card differs. 'modal' skips
  // the card because the modal already supplies one.
  const onLight = true;
  const boxed = variant === 'inline';

  const toggleFeature = (f: string) =>
    setSelected((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/api/waitlist/', {
        email: trimmed,
        features_wanted: selected,
        country,
        source,
      });
      // The api interceptor RESOLVES non-401 HTTP errors, so status-check
      // rather than trusting that we got here.
      if (res == null) return;               // cancelled — silent no-op
      if (res.status === 200) setSuccess(true);
      else setError('Something went wrong. Please try again.');
    } catch {
      // Never echo a server body to a public visitor.
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className={`p-8 text-center ${boxed ? 'rounded-2xl bg-white ring-1 ring-gray-200' : ''}`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className={`mt-4 text-lg font-semibold ${onLight ? 'text-gray-900' : 'text-white'}`}>
          You're on the list
        </p>
        <p className={`mt-2 text-sm ${onLight ? 'text-gray-600' : 'text-white/60'}`}>
          We'll email you when Advanced is ready. No commitment — unsubscribe anytime.
        </p>
      </div>
    );
  }

  const labelCls = `block text-sm font-medium ${onLight ? 'text-gray-700' : 'text-white/80'}`;
  const inputCls = `mt-1.5 h-12 w-full rounded-xl border px-4 text-sm outline-none transition ${
    onLight
      ? 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20'
      : 'border-white/15 bg-white/5 text-white placeholder:text-white/30 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/30'
  }`;

  return (
    <form
      onSubmit={handleSubmit}
      className={boxed ? 'rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8' : ''}
      noValidate
    >
      <div>
        <label htmlFor="waitlist-email" className={labelCls}>Work email</label>
        <input
          id="waitlist-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          placeholder="you@company.com"
          autoComplete="email"
          disabled={submitting}
          className={inputCls}
        />
      </div>

      <fieldset className="mt-5">
        <legend className={labelCls}>Where do you run your business?</legend>
        <div className="mt-2 flex gap-2">
          {COUNTRIES.map((c) => {
            const active = country === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCountry(active ? '' : c.value)}
                aria-pressed={active}
                disabled={submitting}
                className={`h-11 flex-1 rounded-xl border text-sm font-medium transition ${
                  active
                    ? 'border-[#0066FF] bg-[#0066FF] text-white'
                    : onLight
                      ? 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className={labelCls}>
          What matters most to you? <span className="font-normal opacity-60">(optional)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WAITLIST_FEATURES.map((f) => {
            const active = selected.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFeature(f)}
                aria-pressed={active}
                disabled={submitting}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                  active
                    ? 'border-[#0066FF] bg-[#0066FF]/10 text-[#0066FF]'
                    : onLight
                      ? 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      : 'border-white/15 bg-white/5 text-white/60 hover:border-white/30'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 h-12 w-full rounded-xl bg-[#0066FF] text-sm font-semibold text-white transition hover:bg-[#0052cc] disabled:opacity-60"
      >
        {submitting ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  );
};
