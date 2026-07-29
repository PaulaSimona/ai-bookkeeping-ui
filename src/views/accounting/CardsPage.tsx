// Tier 2 Cards page (O-S31-1 C3) — the "identify this card" surface the
// card-discovery email links to.
//
// ROUTE IS LOAD-BEARING: the C1 notification email builds its link as
// `{FRONTEND_URL}/accounting/cards` (backend card_notifications.py:107). The
// route registered in App.tsx must match that literal byte-for-byte — the
// email is already shipped, so the ROUTE follows the EMAIL, never the reverse.
//
// Data layer is its own (useCards → the shipped s29 client endpoints); only
// the design system is shared with Tier 1 (MASTER_T2 §14-§15). Page-local
// toast + Section/Field/Select primitives follow the live Tier 2 convention
// (settings/ui.tsx), the same choice BankConnections made — the shared
// components/ Badge/Button/Toast are dead react-bootstrap legacy.
import { type FC, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrgMe, useAccounts, type Account } from '@/hooks/useAccounts';
import { PageLoader } from '@/components/Loader';
import { PageHeader } from '@/components/t2/PageHeader';
import { Card } from '@/components/t2/Card';
import { Field, Select, Spinner, ToastBanner, useToast } from '@/views/settings/ui';
import {
  useCards,
  useClassifyCard,
  type CardClassification,
  type OrgCard,
} from '@/api/accounting/useCards';

// ─── Presentation helpers ─────────────────────────────────────────────────────

const NETWORK_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  other: 'Card',
};

// Amber = needs you (matches the Documents surface's "needs your attention"
// pill); green = settled and posting by rule; neutral = settled, no automation.
const CLASSIFICATION_CHIP: Record<CardClassification, { label: string; cls: string }> = {
  unidentified: { label: 'Needs identifying', cls: 'bg-amber-50 text-amber-700' },
  business: { label: 'Business', cls: 'bg-emerald-50 text-emerald-700' },
  personal: { label: 'Personal', cls: 'bg-gray-100 text-gray-600' },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

const Chip: FC<{ classification: CardClassification }> = ({ classification }) => {
  const { label, cls } = CLASSIFICATION_CHIP[classification]
    ?? CLASSIFICATION_CHIP.unidentified;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
};

const accountLabel = (a: Account) => `${a.code} — ${a.name}`;

// ─── Classify flow ────────────────────────────────────────────────────────────

// Which account types each classification may map to. Mirrors the MODEL
// invariant (OrgCard.clean, backend models.py:1415-1445) — the server is the
// authority; this only avoids offering a choice that would 400:
//   business -> LIABILITY only        (the card's own payable)
//   personal -> LIABILITY or EQUITY   (shareholder loan / owner drawings)
const ALLOWED_TYPES: Record<'business' | 'personal', Account['type'][]> = {
  business: ['liability'],
  personal: ['liability', 'equity'],
};

const PICKER_COPY: Record<'business' | 'personal', { label: string; note: string }> = {
  business: {
    label: 'Which account holds this card’s balance?',
    note: 'Card balances live in a liability account — what the business owes the card issuer.',
  },
  personal: {
    label: 'Which account tracks amounts owed to or from the owner?',
    note: 'Payments to a personal card are money drawn from the business — usually a shareholder loan or owner drawings account.',
  },
};

const ClassifyForm: FC<{
  card: OrgCard;
  accounts: Account[];
  accountsLoading: boolean;
  onDone: (choice: 'business' | 'personal') => void;
  onCancel: () => void;
}> = ({ card, accounts, accountsLoading, onDone, onCancel }) => {
  const { classify, savingId } = useClassifyCard();
  const [choice, setChoice] = useState<'business' | 'personal' | null>(null);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    if (!choice) return [];
    const allowed = ALLOWED_TYPES[choice];
    return accounts
      .filter((a) => a.is_active && allowed.includes(a.type))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [choice, accounts]);

  const pick = (next: 'business' | 'personal') => {
    setChoice(next);
    setAccountId('');   // an account valid for one choice may be invalid for the other
    setError(null);
  };

  const submit = async () => {
    if (!choice || !accountId) return;
    setError(null);
    const res = await classify(card.id, {
      classification: choice,
      mapped_account: accountId,
    });
    if (res.ok) onDone(choice);
    else setError(res.error);
  };

  const saving = savingId === card.id;

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-[13.5px] font-medium text-gray-700">Whose card is this?</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(['business', 'personal'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => pick(value)}
            aria-pressed={choice === value}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              choice === value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {choice && (
        <div className="mt-4 space-y-3">
          <Field label={PICKER_COPY[choice].label} required>
            {accountsLoading ? (
              <div className="flex h-[42px] items-center gap-2 text-sm text-gray-500">
                <Spinner /> Loading accounts…
              </div>
            ) : options.length === 0 ? (
              <p className="text-[13px] text-amber-700">
                No suitable account found in your chart of accounts. Add one under
                Settings → Chart of accounts, then come back.
              </p>
            ) : (
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Select an account…</option>
                {options.map((a) => (
                  <option key={a.id} value={a.id}>{accountLabel(a)}</option>
                ))}
              </Select>
            )}
          </Field>
          <p className="text-[12.5px] text-gray-500">{PICKER_COPY[choice].note}</p>
        </div>
      )}

      {/* The invariant 400s are user-actionable, so the server's own wording
          is shown rather than a generic failure line. */}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!choice || !accountId || saving}
          className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {saving && <Spinner light />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-[13px] font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Row ──────────────────────────────────────────────────────────────────────

const CardRow: FC<{
  card: OrgCard;
  accounts: Account[];
  accountsLoading: boolean;
  onClassified: (choice: 'business' | 'personal') => void;
}> = ({ card, accounts, accountsLoading, onClassified }) => {
  const [open, setOpen] = useState(false);
  const unidentified = card.classification === 'unidentified';

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {NETWORK_LABEL[card.network] ?? NETWORK_LABEL.other}
            </span>
            <span className="font-[var(--font-family-mono)] text-sm text-gray-500">
              ····{card.last4}
            </span>
            <Chip classification={card.classification} />
          </div>
          {card.label && (
            <p className="mt-1 max-w-[46ch] truncate text-[13px] text-gray-600">{card.label}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Detected {fmtDate(card.created_at)}
            {card.mapped_account_code && (
              <> · Posts to {card.mapped_account_code}
                {card.mapped_account_name ? ` ${card.mapped_account_name}` : ''}</>
            )}
          </p>
        </div>

        {unidentified && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Identify card
          </button>
        )}
      </div>

      {unidentified && open && (
        <ClassifyForm
          card={card}
          accounts={accounts}
          accountsLoading={accountsLoading}
          onDone={(choice) => { setOpen(false); onClassified(choice); }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const CardsPage: FC = () => {
  const navigate = useNavigate();
  const { role, isLoading: orgLoading } = useOrgMe();
  const canView = role === 'owner' || role === 'accountant';

  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useCards();
  // The chart is bounded well under one page (useAccounts pulls page_size=200),
  // so fetch active accounts once and filter per classification client-side —
  // one request instead of one per choice.
  const { accounts, isLoading: accountsLoading } = useAccounts({ active: true });
  const { toast, showSuccess } = useToast();

  // D-S31-3: informational only. Set after a BUSINESS classification, never
  // gates anything, and dismissible.
  const [nudge, setNudge] = useState(false);

  // Server orders by (classification, created_at) — 'business' < 'personal' <
  // 'unidentified' alphabetically, so unidentified would sort LAST. Re-sort
  // client-side to put the cards that need action first; ties keep the
  // server's created_at order (stable sort).
  const rows = useMemo(() => {
    const rank = (c: CardClassification) => (c === 'unidentified' ? 0 : 1);
    return [...items].sort((a, b) => rank(a.classification) - rank(b.classification));
  }, [items]);

  const onClassified = (choice: 'business' | 'personal') => {
    showSuccess(
      choice === 'business'
        ? 'Card saved. Future payments to it will post automatically.'
        : 'Card saved. Payments to it will be treated as owner drawings.',
    );
    if (choice === 'business') setNudge(true);
    refetch();
  };

  // Redirect members without accounting access — same structural pattern as
  // DocumentsPage/AccountingReview (effect, never a navigate() during render).
  useEffect(() => {
    if (!orgLoading && !canView) navigate('/dashboard', { replace: true });
  }, [orgLoading, canView, navigate]);

  if (orgLoading) return <PageLoader />;
  if (!canView) return null; // redirect in flight — don't flash the page

  const showPager = count > pageSize;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ToastBanner toast={toast} />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Cards"
          subtitle="Tell us whose card is whose, and payments to it file themselves from then on."
        />

        {/* D-S31-3: non-blocking nudge after a business classification. */}
        {nudge && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="flex-1">
              Connect this card’s account under Bank connections and its own
              transactions flow in automatically — the same way your bank account does.
            </span>
            <Link
              to="/accounting/bank-connections"
              className="shrink-0 font-semibold text-emerald-900 underline hover:text-emerald-700"
            >
              Bank connections
            </Link>
            <button
              type="button"
              onClick={() => setNudge(false)}
              aria-label="Dismiss"
              className="shrink-0 text-emerald-700 hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        )}

        <section className="mt-6">
          <Card>
            {isLoading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-6 py-5">
                    <div className="h-3.5 w-48 animate-pulse rounded bg-gray-100" />
                    <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500">
                Couldn’t load your cards — retrying shortly.
              </p>
            ) : rows.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500">
                No cards detected yet — cards appear automatically when card
                payments show up in your bank activity.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {rows.map((card) => (
                  <CardRow
                    key={card.id}
                    card={card}
                    accounts={accounts}
                    accountsLoading={accountsLoading}
                    onClassified={onClassified}
                  />
                ))}
              </div>
            )}

            {showPager && !isLoading && !error && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                <span className="text-xs text-gray-500">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} of {count}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page * pageSize >= count}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
};
