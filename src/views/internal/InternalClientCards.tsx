// Internal console — per-client Card registry (O-S31-1 C4).
//
// IA: this follows the s28 per-org DRILL-IN pattern (InternalClientEntries at
// /internal/clients/:orgId/entries), NOT a global nav tab — cards are org-scoped
// data, and the console's global nav is reserved for cross-org surfaces
// (Pending queue, Assigned clients) plus super-user Administration.
//
// Consumes the SHIPPED staff endpoints only (staff_resolution_views.py):
//   GET/POST /staff/orgs/<org_id>/cards/ · PATCH /staff/cards/<pk>/
//   POST     /staff/cards/<pk>/resend-notification/   (C2)
// The staff lane carries no require_tier2 — the StaffProfile + can_access_org
// gate is the whole gate, and every deny is the byte-identical §16 404.
import { type FC, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useStaffOrgCards,
  useStaffOrgAccounts,
  createStaffCard,
  patchStaffCard,
  resendCardNotification,
  type StaffAccount,
  type StaffCard,
} from '@/hooks/useStaffResolution';
import {
  PageContainer,
  SectionCard,
  Pill,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  Toast,
  useToast,
} from '@/components/internal/ui';

const NETWORK_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  other: 'Card',
};

const NETWORKS = ['visa', 'mastercard', 'amex', 'other'] as const;

// Same vocabulary as the client Cards page, in the console's dark Pill tones.
const CHIP: Record<StaffCard['classification'], { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  unidentified: { label: 'Needs identifying', tone: 'warning' },
  business: { label: 'Business', tone: 'success' },
  personal: { label: 'Personal', tone: 'neutral' },
};

// Mirrors the MODEL invariant (OrgCard.clean, backend models.py:1415-1445).
// The server is the authority; this only avoids offering a choice that 400s.
const ALLOWED_TYPES: Record<'business' | 'personal', string[]> = {
  business: ['liability'],
  personal: ['liability', 'equity'],
};

const PICKER_NOTE: Record<'business' | 'personal', string> = {
  business: 'A business card maps to a liability account — the card’s own payable.',
  personal: 'A personal card maps to a shareholder loan or owner drawings account.',
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

const selectCls =
  'w-full rounded-md border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white/90 ' +
  'focus:border-[#0066FF] focus:outline-none disabled:opacity-50';

const inputCls = selectCls;

// ─── Classify panel ───────────────────────────────────────────────────────────

const ClassifyPanel: FC<{
  card: StaffCard;
  accounts: StaffAccount[];
  accountsLoading: boolean;
  onDone: () => void;
  onCancel: () => void;
  notify: (m: string, t: 'success' | 'error') => void;
}> = ({ card, accounts, accountsLoading, onDone, onCancel, notify }) => {
  const [choice, setChoice] = useState<'business' | 'personal' | null>(null);
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);
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
    setAccountId(''); // an account valid for one choice may be invalid for the other
    setError(null);
  };

  const submit = async () => {
    if (!choice || !accountId || saving) return;
    setSaving(true);
    setError(null);
    const res = await patchStaffCard(card.id, {
      classification: choice,
      mapped_account: accountId,
    });
    setSaving(false);
    if (res.ok) {
      notify('Card classified.', 'success');
      onDone();
    } else {
      setError(res.errorDetail ?? 'Failed to save card.');
    }
  };

  return (
    <div className="mt-3 max-w-md space-y-3 rounded-md border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Classify card
      </div>

      <div className="flex flex-wrap gap-2">
        {(['business', 'personal'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => pick(value)}
            aria-pressed={choice === value}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              choice === value
                ? 'border-[#0066FF] bg-[#0066FF]/20 text-[#4DA6FF]'
                : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {choice && (
        <div className="space-y-1.5">
          {accountsLoading ? (
            <p className="text-xs text-white/40">Loading accounts…</p>
          ) : options.length === 0 ? (
            <p className="text-xs text-amber-300">
              This org’s chart has no suitable {choice === 'business' ? 'liability' : 'liability or equity'} account.
            </p>
          ) : (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={saving}
              className={selectCls}
            >
              <option value="">Select an account…</option>
              {options.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          )}
          <p className="text-[11px] text-white/40">{PICKER_NOTE[choice]}</p>
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex items-center gap-2">
        <PrimaryButton onClick={submit} disabled={!choice || !accountId} busy={saving}>
          Save
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={saving}>Cancel</SecondaryButton>
      </div>
    </div>
  );
};

// ─── Add-card form (secondary) ────────────────────────────────────────────────

const AddCardForm: FC<{
  orgId: string;
  onDone: () => void;
  onCancel: () => void;
  notify: (m: string, t: 'success' | 'error') => void;
}> = ({ orgId, onDone, onCancel, notify }) => {
  const [last4, setLast4] = useState('');
  const [network, setNetwork] = useState<string>('other');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Created UNIDENTIFIED deliberately: the model forbids a mapped_account on an
  // unidentified card, so classification happens as a second step through the
  // same picker every other card uses — one path, one invariant.
  const submit = async () => {
    if (!/^\d{3,4}$/.test(last4)) {
      setError('Last 4 digits must be 3–4 numbers.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createStaffCard(orgId, {
      last4,
      network,
      classification: 'unidentified',
      label: label.trim(),
    });
    setSaving(false);
    if (res.ok) {
      notify('Card added.', 'success');
      onDone();
    } else {
      setError(res.errorDetail ?? 'Failed to add card.');
    }
  };

  return (
    <div className="max-w-md space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-white/40">
            Last 4 digits
          </label>
          <input
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="3277"
            inputMode="numeric"
            disabled={saving}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-white/40">
            Network
          </label>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            disabled={saving}
            className={selectCls}
          >
            {NETWORKS.map((n) => (
              <option key={n} value={n}>{NETWORK_LABEL[n]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium uppercase tracking-wide text-white/40">
          Label (optional)
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 100))}
          placeholder="Capital One M/C"
          disabled={saving}
          className={inputCls}
        />
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex items-center gap-2">
        <PrimaryButton onClick={submit} busy={saving}>Add card</PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={saving}>Cancel</SecondaryButton>
      </div>
      <p className="text-[11px] text-white/40">
        Added as unidentified — classify it below once you know whose card it is.
      </p>
    </div>
  );
};

// ─── Row ──────────────────────────────────────────────────────────────────────

const CardRow: FC<{
  card: StaffCard;
  accounts: StaffAccount[];
  accountsLoading: boolean;
  onChanged: () => void;
  notify: (m: string, t: 'success' | 'error') => void;
}> = ({ card, accounts, accountsLoading, onChanged, notify }) => {
  const [classifying, setClassifying] = useState(false);
  const [resending, setResending] = useState(false);
  // 429 is not an error — it is the cooldown working. Rendered inline and calm,
  // never as a red toast.
  const [cooldown, setCooldown] = useState<string | null>(null);
  const [retiring, setRetiring] = useState(false);

  const unidentified = card.classification === 'unidentified';
  const chip = CHIP[card.classification] ?? CHIP.unidentified;

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setCooldown(null);
    const res = await resendCardNotification(card.id);
    setResending(false);

    if (res.ok) {
      notify(`Notification re-sent (${res.sentToCount} recipient${res.sentToCount === 1 ? '' : 's'}).`, 'success');
      onChanged();
      return;
    }
    if (res.code === 'notification_rate_limited') {
      setCooldown('Recently notified — try again later.');
      return;
    }
    // 502 notification_send_failed, 400 card_not_notifiable (structurally
    // unreachable — the button only renders on eligible cards), or anything
    // else: surface the server's own detail.
    notify(res.errorDetail ?? 'Could not re-send the notification.', 'error');
  };

  const retire = async () => {
    if (retiring) return;
    if (!window.confirm(`Retire the card ending ${card.last4}? It stops matching future settlements.`)) return;
    setRetiring(true);
    const res = await patchStaffCard(card.id, { is_active: false });
    setRetiring(false);
    if (res.ok) {
      notify('Card retired.', 'success');
      onChanged();
    } else {
      notify(res.errorDetail ?? 'Failed to retire card.', 'error');
    }
  };

  return (
    <div className="border-b border-white/5 px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white/90">
              {NETWORK_LABEL[card.network] ?? NETWORK_LABEL.other}
            </span>
            <span className="text-sm text-white/50">····{card.last4}</span>
            <Pill tone={chip.tone}>{chip.label}</Pill>
            {!card.is_active && <Pill tone="danger">Retired</Pill>}
          </div>
          {card.label && (
            <p className="mt-1 max-w-[46ch] truncate text-xs text-white/60">{card.label}</p>
          )}
          <p className="mt-1 text-[11px] text-white/35">
            Detected {fmtDate(card.created_at)} · {card.source}
            {card.mapped_account_code && (
              <> · Posts to {card.mapped_account_code}
                {card.mapped_account_name ? ` ${card.mapped_account_name}` : ''}</>
            )}
          </p>
          {cooldown && <p className="mt-1.5 text-[11px] text-amber-300">{cooldown}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {unidentified && card.is_active && !classifying && (
            <>
              <button
                type="button"
                onClick={() => setClassifying(true)}
                className="text-xs font-semibold text-[#4DA6FF] hover:underline"
              >
                Classify
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="text-xs font-medium text-white/60 hover:text-white disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Re-send notification'}
              </button>
            </>
          )}
          {card.is_active && (
            <button
              type="button"
              onClick={retire}
              disabled={retiring}
              className="text-xs font-medium text-red-300/80 hover:text-red-200 disabled:opacity-50"
            >
              {retiring ? 'Retiring…' : 'Retire'}
            </button>
          )}
        </div>
      </div>

      {classifying && (
        <ClassifyPanel
          card={card}
          accounts={accounts}
          accountsLoading={accountsLoading}
          onDone={() => { setClassifying(false); onChanged(); }}
          onCancel={() => setClassifying(false)}
          notify={notify}
        />
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const InternalClientCards: FC = () => {
  const { orgId = '' } = useParams();
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useStaffOrgCards(orgId);
  const { accounts, isLoading: accountsLoading } = useStaffOrgAccounts(orgId);
  const { toast, showToast } = useToast();
  const [adding, setAdding] = useState(false);

  // The server orders by (classification, created_at); alphabetically
  // 'business' < 'personal' < 'unidentified', so the cards that need action
  // would sort LAST. Stable client re-sort lifts them to the top.
  const rows = useMemo(() => {
    const rank = (c: StaffCard['classification']) => (c === 'unidentified' ? 0 : 1);
    return [...items].sort((a, b) => rank(a.classification) - rank(b.classification));
  }, [items]);

  const pendingCount = rows.filter((c) => c.classification === 'unidentified' && c.is_active).length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <PageContainer
      title="Card registry"
      subtitle="Cards detected on this organization's bank activity. Classify one once and every future settlement posts by rule."
      actions={
        <Link
          to={`/internal/clients/${orgId}/entries`}
          className="text-xs font-medium text-white/60 hover:text-white"
        >
          View entries →
        </Link>
      }
    >
      <Toast toast={toast} />

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      <SectionCard
        title={isLoading ? 'Cards' : `Cards (${count})${pendingCount ? ` · ${pendingCount} need identifying` : ''}`}
        actions={
          !adding && (
            <SecondaryButton onClick={() => setAdding(true)}>Add card</SecondaryButton>
          )
        }
        className={rows.length ? 'pb-0' : undefined}
      >
        {adding && (
          <div className="mb-5 border-b border-white/10 pb-5">
            <AddCardForm
              orgId={orgId}
              onDone={() => { setAdding(false); refetch(); }}
              onCancel={() => setAdding(false)}
              notify={showToast}
            />
          </div>
        )}

        {isLoading ? (
          <CenteredSpinner label="Loading cards…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No cards on file"
            description="Cards appear automatically when the recognizer meets a card payment on this org's bank feed."
          />
        ) : (
          <div className="-mx-5 -mb-5">
            {rows.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                accounts={accounts}
                accountsLoading={accountsLoading}
                onChanged={refetch}
                notify={showToast}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => setPage(page - 1)} disabled={page <= 1}>Prev</SecondaryButton>
            <SecondaryButton onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Next</SecondaryButton>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
