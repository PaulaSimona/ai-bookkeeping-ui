import { type FC, type FormEvent, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import logoSvg from '@/assets/logo.svg';

// ─── Plan data ────────────────────────────────────────────────────────────────

const SHARED_FEATURES = [
  'AI extraction & categorization',
  'Annual Excel workbook',
  'Expense & tax reports',
  'Telegram bot intake',
  'GST/HST ITC reports',
  'Email support',
] as const;

const ADVANCED_FEATURES = [
  'Everything in Pro',
  'Supplier invoice recording',
  'Supplier payment tracking',
  'Customer invoice recording',
  'Customer payment tracking',
  'Bank & credit card connection (via Plaid)',
  'Bank reconciliation',
  'Profit & Loss reports',
  'Accounts Payable balance',
  'Accounts Receivable balance',
  'Tax reports (CA & US)',
] as const;

const WAITLIST_FEATURES = [
  'Supplier invoice recording',
  'Supplier payment tracking',
  'Customer invoice recording',
  'Customer payment tracking',
  'Bank & credit card connection (via Plaid)',
  'Bank reconciliation',
  'Profit & Loss reports',
  'Accounts Payable balance',
  'Accounts Receivable balance',
  'Tax reports — Canada GST/HST',
  'Tax reports — US deductions',
] as const;

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    docs: '100 documents / month',
    storage: '1 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 49,
    docs: '300 documents / month',
    storage: '5 GB storage',
    features: SHARED_FEATURES,
    highlight: true,
    badge: 'Most popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 69,
    docs: '500 documents / month',
    storage: '20 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
] as const;

// ─── Waitlist modal ────────────────────────────────────────────────────────────

const WaitlistModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [email, setEmail]           = useState('');
  const [selected, setSelected]     = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');

  const toggleFeature = (f: string) =>
    setSelected((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/waitlist/', { email, features_wanted: selected });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Join the Advanced waitlist</h2>
              <p className="text-xs text-gray-400 mt-0.5">Be first to know when it launches.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {success ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-900 mb-1">You're on the list!</p>
                <p className="text-sm text-gray-500">We'll notify you when Advanced launches.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Which features matter most to you?</p>
                  <div className="space-y-2">
                    {WAITLIST_FEATURES.map((f) => (
                      <label key={f} className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selected.includes(f)}
                          onChange={() => toggleFeature(f)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF] cursor-pointer shrink-0"
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors leading-snug">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A1628] hover:bg-[#112040] disabled:opacity-60 py-3 text-sm font-semibold text-white transition-colors"
                >
                  {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {submitting ? 'Joining…' : 'Join Waitlist'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Public pricing page ───────────────────────────────────────────────────────

export const Pricing: FC = () => {
  const navigate = useNavigate();
  const [showWaitlist, setShowWaitlist] = useState(false);

  const CheckIcon = () => (
    <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">

        {/* Navbar */}
        <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <img src={logoSvg} alt="AI Bookkeeping" className="h-8 w-auto" />
          <NavLink
            to="/login"
            className="text-sm font-medium text-[#0066FF] hover:underline"
          >
            Sign in →
          </NavLink>
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-10">

          {/* Trial banner */}
          <div className="max-w-6xl mx-auto mb-10">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[#0A1628] px-6 py-4 text-sm text-white/80">
              <svg className="w-4 h-4 text-[#4DA6FF] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span>
                <span className="font-semibold text-white">5-day free trial</span>
                {' · '}5 documents included{' · '}No credit card required to create an account
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="max-w-6xl mx-auto text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h1>
            <p className="mt-3 text-gray-500">
              All plans include AI extraction, Excel workbooks, and expense reports. Cancel anytime.
            </p>
          </div>

          {/* Plan cards — 3 active + 1 coming soon */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl flex flex-col ${
                  plan.highlight
                    ? 'border-2 border-[#0066FF] shadow-lg shadow-blue-100'
                    : 'border border-gray-100 shadow-sm'
                }`}
              >
                {'badge' in plan && (
                  <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                    <span className="bg-[#0066FF] text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="px-6 pt-8 pb-6 flex-1">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{plan.name}</p>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-sm text-gray-400 mb-1.5">CAD / mo</span>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <p className="text-sm font-medium text-gray-700">{plan.docs}</p>
                    <p className="text-sm text-gray-500">{plan.storage}</p>
                  </div>
                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <CheckIcon />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-6 pb-6">
                  <button
                    onClick={() => navigate('/register')}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
                      plan.highlight
                        ? 'bg-[#0066FF] hover:bg-[#0052cc] text-white'
                        : 'bg-gray-900 hover:bg-gray-700 text-white'
                    }`}
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            ))}

            {/* Advanced — Coming Soon card */}
            <div className="relative bg-white rounded-2xl flex flex-col border border-gray-100 shadow-sm overflow-hidden opacity-75">
              <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden rounded-tr-2xl pointer-events-none">
                <div
                  className="absolute bg-gray-400 text-white text-[9px] font-bold tracking-widest uppercase text-center py-1.5 w-36"
                  style={{ top: 20, right: -32, transform: 'rotate(45deg)' }}
                >
                  Coming Soon
                </div>
              </div>

              <div className="px-6 pt-8 pb-6 flex-1">
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Advanced</p>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-gray-400">Coming Soon</span>
                </div>
                <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                  Full double-entry bookkeeping for growing businesses
                </p>
                <ul className="mt-6 space-y-2.5">
                  {ADVANCED_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                      <svg className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6 opacity-100">
                <button
                  onClick={() => setShowWaitlist(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A1628] hover:bg-[#112040] py-3 text-sm font-semibold text-white transition-colors"
                  style={{ opacity: 1 }}
                >
                  Join Waitlist
                </button>
              </div>
            </div>

          </div>

          {/* Footer note */}
          <p className="max-w-6xl mx-auto mt-8 text-center text-xs text-gray-400">
            Prices in CAD. GST/HST may apply. Cancel anytime from your billing portal.
            By subscribing you agree to our{' '}
            <NavLink to="/terms-of-service" className="underline hover:text-gray-600 transition-colors">Terms of Service</NavLink>.
          </p>

        </div>
      </div>

      {showWaitlist && <WaitlistModal onClose={() => setShowWaitlist(false)} />}
    </>
  );
};
