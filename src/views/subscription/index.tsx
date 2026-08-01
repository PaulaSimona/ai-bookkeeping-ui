import { type FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';

// ─── Plan data ────────────────────────────────────────────────────────────────

const SHARED_FEATURES = [
  'AI extraction & categorization',
  'Annual Excel workbook',
  'Expense & tax reports',
  'Telegram bot intake',
  'GST/HST ITC reports',
  'Full manual control over every field',
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
  'Internal reviewers resolve entries requiring human judgment',
] as const;

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    priceId: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID as string,
    docs: '100 documents / month',
    storage: '1 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 49,
    priceId: import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID as string,
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
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string,
    docs: '500 documents / month',
    storage: '20 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
] as const;

// ─── Waitlist modal ────────────────────────────────────────────────────────────

// Thin modal chrome around the SHARED waitlist form (S32 C3). The previous
// inline copy of the form lived here and had already drifted from the other
// two; the form itself now lives in components/marketing/WaitlistForm.
const WaitlistModal: FC<{ onClose: () => void }> = ({ onClose }) => (
  <>
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Join the Advanced waitlist</h2>
            <p className="mt-0.5 text-xs text-gray-400">Be first to know when it launches.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <WaitlistForm source="subscription" variant="modal" />
        </div>
      </div>
    </div>
  </>
);

// ─── Subscription success page ─────────────────────────────────────────────────

export const SubscriptionSuccess: FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-gray-50 items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You're subscribed!</h2>
        <p className="text-sm text-gray-500 mb-6">
          Your subscription is now active. Your document quota has been updated — you're ready to upload.
        </p>
        <button
          onClick={() => navigate('/documents')}
          className="rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-6 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Start uploading →
        </button>
      </div>
    </div>
  );
};

// ─── Subscription page ────────────────────────────────────────────────────────

export const Subscription: FC = () => {
  const [loadingId, setLoadingId]       = useState<string | null>(null);
  const [error, setError]               = useState('');
  const [showWaitlist, setShowWaitlist] = useState(false);

  const handleSubscribe = async (plan: typeof PLANS[number]) => {
    if (!plan.priceId) {
      setError('Stripe price ID not configured. Check VITE_STRIPE_*_PRICE_ID env vars.');
      return;
    }
    setLoadingId(plan.id);
    setError('');
    try {
      const res = await api.post('/api/stripe/create-checkout-session/', { price_id: plan.priceId });
      if (res?.data?.url) {
        window.location.href = res.data.url;
      } else {
        setError(res?.data?.error ?? 'Could not create checkout session. Please try again.');
      }
    } catch {
      setError('Could not connect to Stripe. Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  const CheckIcon = () => (
    <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );

  return (
    <>
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-1 overflow-y-auto px-6 py-10">

          {/* Trial banner */}
          <div className="max-w-6xl mx-auto mb-10">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[#0A1628] px-6 py-4 text-sm text-white/80">
              <svg className="w-4 h-4 text-[#4DA6FF] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span>
                <span className="font-semibold text-white">Upgrade your plan</span>
                {' · '}Cancel anytime
                {' · '}Secure payment via Stripe
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

          {/* Error */}
          {error && (
            <div className="max-w-6xl mx-auto mb-6">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Plan cards — 3 active + 1 coming soon */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

            {/* Active plans */}
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
                    onClick={() => handleSubscribe(plan)}
                    disabled={loadingId !== null}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
                      plan.highlight
                        ? 'bg-[#0066FF] hover:bg-[#0052cc] text-white'
                        : 'bg-gray-900 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {loadingId === plan.id ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Redirecting…</>
                    ) : (
                      'Choose this plan'
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Advanced — Coming Soon card */}
            <div className="relative bg-white rounded-2xl flex flex-col border border-gray-100 shadow-sm overflow-hidden opacity-75">

              {/* Diagonal "Coming Soon" ribbon */}
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

              {/* Waitlist CTA — full opacity */}
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
            By subscribing you agree to our Terms of Service.
          </p>

        </div>
      </div>

      {showWaitlist && <WaitlistModal onClose={() => setShowWaitlist(false)} />}
    </>
  );
};
