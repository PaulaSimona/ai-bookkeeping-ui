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
// toast + Spinner primitives follow the live Tier 2 convention
// (settings/ui.tsx), the same choice BankConnections made — the shared
// components/ Badge/Button/Toast are dead react-bootstrap legacy.
import { type FC, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrgMe } from '@/hooks/useAccounts';
import { PageLoader } from '@/components/Loader';
import { PageHeader } from '@/components/t2/PageHeader';
import { Card } from '@/components/t2/Card';
import { Spinner, ToastBanner, useToast } from '@/views/settings/ui';
import {
  useCards,
  useClassifyCard,
  useCreateCard,
  type CardClassification,
  type CardNetwork,
  type CreateCardPayload,
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

// ─── Classify flow ────────────────────────────────────────────────────────────

// O-S33-4: the account picker is GONE from this lane. Choosing a ledger
// account is a bookkeeping question the owner has no way to answer correctly,
// and the right answer differs by jurisdiction, so the SERVER resolves it from
// the classification alone (backend card_settlement.resolve_card_account). The
// payload is now `{ classification }` and nothing else — the API rejects a
// client-supplied mapped_account outright. The STAFF console keeps its picker.
//
// The line below says what happens, factually, without naming accounts or
// explaining bookkeeping treatment (O-S33-2 spirit — same reasoning as the
// discovery email this page is linked from).
const CHOICE_NOTE =
  'Business cards get their own card account automatically; personal card payments are routed for review.';

const ClassifyForm: FC<{
  card: OrgCard;
  onDone: (choice: 'business' | 'personal') => void;
  onCancel: () => void;
}> = ({ card, onDone, onCancel }) => {
  const { classify, savingId } = useClassifyCard();
  const [choice, setChoice] = useState<'business' | 'personal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!choice) return;
    setError(null);
    const res = await classify(card.id, { classification: choice });
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
            onClick={() => { setChoice(value); setError(null); }}
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

      <p className="mt-3 text-[12.5px] text-gray-500">{CHOICE_NOTE}</p>

      {/* The server's refusals on this lane are written as customer-facing
          copy that names no account and no code (backend O-S33-4), so its own
          wording is shown rather than a generic failure line. */}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!choice || saving}
          className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          {saving && <Spinner light />}
          {saving ? 'Saving…' : 'Confirm'}
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
  onClassified: (choice: 'business' | 'personal') => void;
}> = ({ card, onClassified }) => {
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
          onDone={(choice) => { setOpen(false); onClassified(choice); }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
};


// ─── Add a card (S62, O-S62-2) ────────────────────────────────────────────────

// NETWORK OPTIONS MIRROR THE BACKEND MODEL. Authority is
// accounting/models.py OrgCard.Network (visa | mastercard | amex | other) and
// the create serializer takes its ChoiceField straight off that enum, so a
// value outside this set is a 400. Same mirror-comment discipline as the S33
// classification controls: when the model gains a network, this list follows
// it — the model is never edited to match the UI.
const NETWORK_OPTIONS: { value: CardNetwork; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'other', label: 'Other' },
];

// Bounded to the serializer's max_length (OrgCard.label is CharField(100)).
const LABEL_MAX = 100;

const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 ' +
  'focus:border-[#0066FF] focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

const FieldError: FC<{ message?: string }> = ({ message }) =>
  message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;

// `open` is owned by the PAGE so the trigger can live in the PageHeader action
// slot while the form renders in the body flow.
const AddCardForm: FC<{
  open: boolean;
  onClose: () => void;
  onAdded: (label: string) => void;
}> = ({ open, onClose, onAdded }) => {
  const { create, saving } = useCreateCard();

  const [network, setNetwork] = useState<CardNetwork>('visa');
  const [last4, setLast4] = useState('');
  const [label, setLabel] = useState('');
  const [classification, setClassification] =
    useState<CreateCardPayload['classification'] | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const reset = () => {
    setNetwork('visa');
    setLast4('');
    setLabel('');
    setClassification(null);
    setFieldErrors({});
    setFormError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setFormError('');
    // Client-side shape check only. The server revalidates everything — this
    // exists to save a round trip, never as the authority.
    if (!/^\d{4}$/.test(last4)) {
      setFieldErrors({ last4: 'Enter the last four digits of the card number.' });
      return;
    }
    if (classification === null) {
      setFieldErrors({ classification: 'Choose whose card this is.' });
      return;
    }
    setFieldErrors({});

    // O-S33-4 / O-S62-2: FACTS ONLY. There is no account field here and
    // CreateCardPayload has no member for one.
    const payload: CreateCardPayload = { network, last4, classification };
    if (label.trim()) payload.label = label.trim();

    const res = await create(payload);
    if (res.ok) {
      const added = `${NETWORK_LABEL[res.data.network] ?? 'Card'} ····${res.data.last4}`;
      close();
      onAdded(added);
      return;
    }
    setFieldErrors(res.fieldErrors);
    // Shown when the failure is not attributable to one field: a duplicate or
    // unresolvable-account 409, or a 429. Server copy is factual and names no
    // account, so it is rendered verbatim.
    if (Object.keys(res.fieldErrors).length === 0) setFormError(res.error);
  };

  if (!open) return null;

  return (
    <section className="mt-6">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="px-6 py-5"
        >
          <h2 className="text-sm font-semibold text-gray-900">Add a card</h2>
          <p className="mt-1 text-sm text-gray-500">
            Tell us the card and whose it is. We handle how it is recorded.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="card-network" className="block text-xs font-medium text-gray-700">
                Card network
              </label>
              <select
                id="card-network"
                value={network}
                onChange={(e) => setNetwork(e.target.value as CardNetwork)}
                className={`mt-1 ${FIELD}`}
              >
                {NETWORK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <FieldError message={fieldErrors.network} />
            </div>

            <div>
              <label htmlFor="card-last4" className="block text-xs font-medium text-gray-700">
                Last four digits
              </label>
              <input
                id="card-last4"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="1234"
                aria-invalid={Boolean(fieldErrors.last4)}
                className={`mt-1 ${FIELD}`}
              />
              <FieldError message={fieldErrors.last4} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="card-label" className="block text-xs font-medium text-gray-700">
                Name it <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="card-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={LABEL_MAX}
                autoComplete="off"
                placeholder="Shop card"
                className={`mt-1 ${FIELD}`}
              />
              <FieldError message={fieldErrors.label} />
            </div>
          </div>

          {/* Same two answers, and the same wording, as the identify flow on
              each row — one question the owner can actually answer. */}
          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-gray-700">Whose card is this?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['business', 'personal'] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setClassification(choice)}
                  aria-pressed={classification === choice}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    classification === choice
                      ? 'border-[#0066FF] bg-blue-50 text-[#0066FF]'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {choice === 'business' ? 'Business card' : 'Personal card'}
                </button>
              ))}
            </div>
            <FieldError message={fieldErrors.classification} />
          </fieldset>

          {formError && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0052cc] disabled:opacity-60"
            >
              {saving && <Spinner />}
              Add card
            </button>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </section>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const CardsPage: FC = () => {
  const navigate = useNavigate();
  const { role, isLoading: orgLoading } = useOrgMe();
  const canView = role === 'owner' || role === 'accountant';

  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useCards();
  // O-S33-4: the chart fetch is gone with the picker — this lane no longer
  // needs the account list at all, so the page makes one request fewer.
  const { toast, showSuccess } = useToast();

  // D-S31-3: informational only. Set after a BUSINESS classification, never
  // gates anything, and dismissible.
  const [nudge, setNudge] = useState(false);

  // O-S62-2: Add-card panel. Open state lives here so the trigger can sit in
  // the page header while the form renders in the body flow.
  const [addOpen, setAddOpen] = useState(false);

  const onCardAdded = (added: string) => {
    showSuccess(`${added} added.`);
    refetch();
  };

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
        // O-S33-2 spirit: say what happens, not how it is booked. "treated as
        // owner drawings" named a CA-only account concept that is wrong for US
        // orgs anyway (their owner account is a different code entirely).
        : 'Card saved. Payments to it will be routed for review.',
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
        {/* O-S62-1b: this page left the sidebar, so it needs a way back to
            where it is now reached from — Settings → Bank & integrations, the
            tab that hosts the "Manage cards" link (settings/index.tsx
            CardsSummarySection). The ?tab= deep link was added in the same
            chain; without it /settings always opens on Business profile. */}
        <Link
          to="/settings?tab=integrations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <span aria-hidden="true">←</span> Settings
        </Link>

        <div className="mt-4">
          <PageHeader
            title="Cards"
            subtitle="Tell us whose card is whose, and payments to it file themselves from then on."
            right={
              !addOpen ? (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="rounded-lg bg-[#0066FF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0052cc]"
                >
                  Add a card
                </button>
              ) : undefined
            }
          />
        </div>

        <AddCardForm
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={onCardAdded}
        />

        {/* D-S31-3: non-blocking nudge after a business classification. */}
        {nudge && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="flex-1">
              Connect this card’s account under Bank Transactions and its own
              transactions flow in automatically — the same way your bank account does.
            </span>
            <Link
              to="/accounting/bank-connections"
              className="shrink-0 font-semibold text-emerald-900 underline hover:text-emerald-700"
            >
              Bank Transactions
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
