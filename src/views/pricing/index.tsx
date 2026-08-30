import { type FC } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import logoSvg from '@/assets/logo.svg';
import SiteFooter from '@/components/Layout/SiteFooter';

// ─── Plan data ────────────────────────────────────────────────────────────────

const SHARED_FEATURES = [
  'AI extraction & categorization',
  'Annual Excel workbook',
  'Expense & tax reports',
  'Telegram bot intake',
  'GST/HST ITC reports',
  'Email support',
] as const;

// O-S55-3: customer-facing Tier 2 name is "Bookkeeping Service" — the
// legacy internal name never appears. Feature list truth-reviewed against
// shipped capability:
// invoices/payments (§INV + counterparty ledgers), Plaid bank & card
// connections, reconciliation, P&L / AP / AR / tax reports — all live.
const BOOKKEEPING_SERVICE_FEATURES = [
  'Human bookkeeper review included',
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

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    docs: '100 receipts / month',
    storage: '1 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 49,
    docs: '300 receipts / month',
    storage: '5 GB storage',
    features: SHARED_FEATURES,
    highlight: true,
    badge: 'Most popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 69,
    docs: '500 receipts / month',
    storage: '20 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
] as const;

// O-S55-3 (P11-v2 ruling): Bookkeeping Service tiers — 150/250/500 documents,
// 15-day free trial (the live Stripe checkout's trial_period_days).
//
// F-S61-4 / O-S61-19: these counts are deliberately UNIT-FREE. They come from
// settings.TIER2_PLAN_MAPPING, which resolve_org_daily_limit applies as a DAILY
// agent-document cap — not a monthly allowance — so any time period attached
// here ("/ month") would be a false claim. The Receipt Automation tiers above
// keep "receipts / month" because that quota genuinely is monthly
// (billing/plans.py _PLAN_QUOTA). Matches the landing page's ratified wording.
const BOOKKEEPING_SERVICE_PLANS = [
  { id: 'bs-starter', name: 'Starter', price: 99, docs: '150 docs', highlight: false },
  { id: 'bs-growth', name: 'Growth', price: 199, docs: '250 docs', highlight: true, badge: 'Most chosen' },
  { id: 'bs-pro', name: 'Pro', price: 399, docs: '500 docs', highlight: false },
] as const;

export const Pricing: FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  // Logged-out → create an account first; logged-in → the in-app
  // Bookkeeping Service plans page (live checkout).
  const bookkeepingCta = () =>
    navigate(user ? '/accounting/subscription' : '/register');

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
                <span className="font-semibold text-white">Free trial</span>
                {' — '}5 receipts included{' · '}no credit card required
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

          {/* Receipt plans — 3 cards */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">

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

          </div>

          {/* Bookkeeping Service — full double-entry books (live, 15-day trial) */}
          <div className="max-w-6xl mx-auto mt-14">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Bookkeeping Service</h2>
              <p className="mt-2 text-gray-500">
                Complete double-entry books — bank and card connections, invoices,
                reconciliation, and financial statements — with a human bookkeeper
                reviewing every uncertain entry. 15-day free trial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {BOOKKEEPING_SERVICE_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl flex flex-col ${
                    plan.highlight
                      ? 'border-2 border-[#0A1628] shadow-lg'
                      : 'border border-gray-100 shadow-sm'
                  }`}
                >
                  {'badge' in plan && (
                    <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                      <span className="bg-[#0A1628] text-white text-xs font-semibold px-3 py-1 rounded-full">
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
                      <p className="text-sm text-gray-500">15-day free trial</p>
                    </div>
                  </div>

                  <div className="px-6 pb-6">
                    <button
                      onClick={bookkeepingCta}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A1628] hover:bg-[#112040] py-3 text-sm font-semibold text-white transition-colors"
                    >
                      Start 15-Day Free Trial
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <ul className="mt-8 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {BOOKKEEPING_SERVICE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer note */}
          <p className="max-w-6xl mx-auto mt-8 text-center text-xs text-gray-400">
            Prices in CAD. GST/HST may apply. Cancel anytime from your billing portal.
            By subscribing you agree to our{' '}
            <NavLink to="/terms-of-service" className="underline hover:text-gray-600 transition-colors">Terms of Service</NavLink>.
          </p>

        </div>
      </div>

      <SiteFooter />
    </>
  );
};
