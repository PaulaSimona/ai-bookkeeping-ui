// Bookkeeping Service plans page (S45 §21 Chain C, route /accounting/subscription).
//
// Deliberate inversion: this page renders for ANY authenticated user, including a
// NON-entitled org owner (that is who buys). It is therefore mounted WITHOUT the
// RequireTier2 wrapper (App.tsx), and it does NOT call useOrgMe/useAccounts —
// that endpoint is require_tier2-gated and 403s for the exact user this page
// targets. Auth comes from PrivateLayout; can_manage_org is enforced backend-side
// on the checkout POST. Page shell mirrors the TaxProfile precedent.
//
// Customer-facing name is "Bookkeeping Service"; the words "Advanced"/"Tier 2"
// appear in no user-facing string (O-S45-2).
import { type FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTier2Billing } from '@/hooks/useTier2Billing';

interface PlanDef {
  key: string;
  name: string;
  price: string;
  docs: string;
  note: string;
  tag: string | null;
  highlight: boolean;
  priceId?: string;
}

const T2_PLANS: PlanDef[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$99 CAD / month',
    docs: 'Up to 50 documents per month',
    note: 'For owner-operated businesses with steady, modest volume.',
    tag: null,
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_T2_STARTER_PRICE_ID as string | undefined,
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$199 CAD / month',
    docs: 'Up to 100 documents per month',
    note: 'For growing businesses with suppliers, clients, and regular invoicing.',
    tag: 'Most chosen',
    highlight: true,
    priceId: import.meta.env.VITE_STRIPE_T2_GROWTH_PRICE_ID as string | undefined,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$399 CAD / month',
    docs: 'Up to 250 documents per month',
    note: 'For higher-volume businesses that want everything maintained.',
    tag: null,
    highlight: false,
    priceId: import.meta.env.VITE_STRIPE_T2_PRO_PRICE_ID as string | undefined,
  },
];

// Feature comparison (extracted verbatim). Left column = Receipt Automation
// (Tier 1 product name), right = Bookkeeping Service.
const COMPARISON: Array<[string, string, string]> = [
  ['AI document processing', 'Included', 'Included'],
  ['Automatic categorization', 'Expense categories', 'Full accounting treatment'],
  ['GST/HST tracking', 'Input tax credits on receipts', 'Tax collected, credits, and filing periods'],
  ['Full double-entry books', 'Not included', 'Included'],
  ['Human review of uncertain entries', 'Not included', 'Trained reviewers on our staff'],
  ['Bank and credit-card connections', 'Not included', 'Included, via Plaid'],
  ['Reconciliation', 'Not included', 'Handled for you'],
  ['Financial statements', 'Expense and tax reports', 'Profit & Loss and Balance Sheet'],
  ['Receivables and payables', 'Not included', 'Client and supplier balances with aging'],
  ['Financial visibility dashboard', 'Expense summaries', 'Cash, profit, taxes, and cash flow'],
  ['Accountant access', 'Share exported files', 'Their own workspace, by invitation'],
  ['Tax-time reporting', 'Annual Excel workbook', 'Full report package, plus workspace access'],
];

type Notice = { kind: 'info' | 'error'; text: string } | null;

const PlanCard: FC<{ plan: PlanDef; busy: boolean; onSubscribe: (p: PlanDef) => void }> = ({
  plan, busy, onSubscribe,
}) => {
  const disabled = !plan.priceId || busy;
  const cardCls = plan.highlight
    ? 'bg-gray-900 text-white border border-gray-900'
    : 'bg-white text-gray-900 border border-gray-200';
  const muted = plan.highlight ? 'text-gray-400' : 'text-gray-500';
  const ctaCls = plan.highlight
    ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
    : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50';

  return (
    <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${cardCls}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.tag && (
          <span className="rounded-full bg-[var(--color-primary)]/20 px-3 py-1 text-xs font-semibold text-blue-300">
            {plan.tag}
          </span>
        )}
      </div>
      <div className="mb-1 text-2xl font-bold">{plan.price}</div>
      <div className={`mb-4 text-sm ${muted}`}>{plan.docs}</div>
      <p className={`mb-6 flex-1 text-sm ${muted}`}>{plan.note}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubscribe(plan)}
        className={`inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ctaCls}`}
      >
        {busy ? 'Starting…' : 'Start Free Trial'}
      </button>
      <p className={`mt-2 text-center text-xs ${muted}`}>15-day free trial · cancel anytime</p>
    </div>
  );
};

export const AdvancedPlans: FC = () => {
  const { createCheckout, openPortal } = useTier2Billing();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [manageHidden, setManageHidden] = useState(false);
  const [managing, setManaging] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  const handleSubscribe = async (plan: PlanDef) => {
    if (!plan.priceId) return;
    setNotice(null);
    setBusyKey(plan.key);
    try {
      const out = await createCheckout(plan.priceId);
      if (out.kind === 'already_active') {
        setAlreadyActive(true);
      } else if (out.kind === 'not_configured') {
        setNotice({ kind: 'info', text: 'Billing is not configured yet — please contact support.' });
      } else if (out.kind === 'error') {
        setNotice({ kind: 'error', text: out.message });
      }
      // 'redirect' → the page is navigating to Stripe; nothing to do.
    } finally {
      setBusyKey(null);
    }
  };

  const handlePortal = async () => {
    setManageError(null);
    setManaging(true);
    try {
      const out = await openPortal();
      if (out.kind === 'never_subscribed') {
        setManageHidden(true);
      } else if (out.kind === 'error') {
        setManageError(out.message);
      }
    } finally {
      setManaging(false);
    }
  };

  const ManageBlock = () =>
    manageHidden ? null : (
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">Manage subscription</h3>
        <p className="mt-1 text-sm text-gray-500">
          Update your payment method, view invoices, or cancel from the billing portal.
        </p>
        {manageError && <p className="mt-3 text-sm text-red-600">{manageError}</p>}
        <button
          type="button"
          disabled={managing}
          onClick={handlePortal}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {managing ? 'Opening…' : 'Open billing portal'}
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bookkeeping Service</h1>
          <p className="mt-1 text-sm text-gray-500">
            Full double-entry books, human review, and tax-ready reports — kept current for you.
          </p>
        </div>

        {alreadyActive ? (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900">You already have an active subscription</h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage your plan, payment method, or cancellation from the billing portal below.
              </p>
            </div>
            <div className="mt-2">{ManageBlock()}</div>
          </>
        ) : (
          <>
            {notice && (
              <div
                className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                  notice.kind === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {notice.text}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {T2_PLANS.map((plan) => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  busy={busyKey === plan.key}
                  onSubscribe={handleSubscribe}
                />
              ))}
            </div>

            {ManageBlock()}

            {/* Feature comparison */}
            <div className="mt-12 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">What you get</th>
                    <th className="px-5 py-3 font-medium">Receipt Automation</th>
                    <th className="px-5 py-3 font-medium text-gray-900">Bookkeeping Service</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([label, a, b]) => (
                    <tr key={label} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-3 text-gray-700">{label}</td>
                      <td className="px-5 py-3 text-gray-500">{a}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              Questions? <Link to="/support" className="font-medium text-[var(--color-primary)] hover:underline">Contact support</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
