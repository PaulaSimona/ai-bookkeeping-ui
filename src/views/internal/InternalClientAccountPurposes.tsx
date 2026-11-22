// Internal console — a client's account purposes (S98 P1d item 7; backend
// P1d-B, accounting/account_purpose_views.py). STAFF ONLY.
//
// IA: a per-org drill-in page like the card registry and the no-document
// accounts, reached from the client's row on Assigned clients and from a
// tax-review file. Reviewers and super users.
//
// Every account of the client with what it is for. The purpose decides
// whether the account may take a purchase allocation; that answer
// (`allowed_for_allocation`) is the server's and is never worked out here.
// Staff change one account at a time. The control offers the purposes the
// server allows for that account: the allocation ones first, the others only
// after a deliberate "Not for purchase allocation" choice. The server's dry
// run is shown before anything is written and is the authority; the confirm
// run sends that dry run's preview token.
import { type FC, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { ActionRefusal, noticeCls } from '@/components/internal/ActionRefusal';
import {
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  PageContainer,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  humanizeCode,
} from '@/components/internal/ui';
import {
  ACCOUNT_PURPOSE_REASON_MAX,
  ALLOCATION_PURPOSES,
  type AccountPurposePlan,
  type AccountPurposeRow,
  useStaffAccountPurposeAction,
  useStaffAccountPurposes,
} from '@/hooks/useStaffAccountPurposes';
import { type RemediationRefusal } from '@/hooks/useStaffResolution';

export const PURPOSES_GONE = 'This client is gone, or it is not one you can review.';
export const PURPOSE_ACCOUNT_GONE = 'This account is no longer available.';
export const PURPOSE_NO_CHANGE = 'No change';
export const PURPOSE_NOT_EXECUTED = 'The server did not carry this out. Preview again, then confirm.';
export const PURPOSE_BLOCKED_CHOICE = 'Not for purchase allocation';
export const PURPOSE_PREVIEW_AGAIN = 'Preview again, then confirm.';

// One refusal code → one staff sentence; ActionRefusal prints the code, and
// the server's own words follow. An unknown code is shown in those words.
export const PURPOSE_REFUSALS: ReadonlyMap<string, string> = new Map([
  ['purpose_type_mismatch', 'This purpose does not fit the account’s type.'],
  ['preview_invalid', PURPOSE_PREVIEW_AGAIN],
  ['preview_expired', PURPOSE_PREVIEW_AGAIN],
  ['preview_stale', PURPOSE_PREVIEW_AGAIN],
]);

const fieldCls =
  'rounded-lg bg-[#0A1628] border border-white/15 px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:ring-1 focus:ring-[#0066FF] [color-scheme:dark] disabled:opacity-50';
const labelCls = 'text-[11px] uppercase tracking-wide text-white/30';
const errorCls = 'text-xs text-red-300';

const accountName = (account: { code: string; name: string }): string =>
  `${account.code} ${account.name}`;

const allocationText = (allowed: boolean): string =>
  allowed ? 'Allowed for purchase allocation' : 'Not allowed for purchase allocation';

// The server's purposes for one account, in two groups. ALLOCATION_PURPOSES
// only sorts them: a purpose the server did not send is never offered.
export const groupPurposes = (
  allowedPurposes: string[],
): { allocation: string[]; blocked: string[] } => ({
  allocation: allowedPurposes.filter((purpose) => ALLOCATION_PURPOSES.includes(purpose)),
  blocked: allowedPurposes.filter((purpose) => !ALLOCATION_PURPOSES.includes(purpose)),
});

// A dry run kept with exactly what it previewed.
interface Previewed {
  purpose: string;
  reason: string;
  token: string | null;
  plan: AccountPurposePlan;
}

const PurposeEditor: FC<{
  account: AccountPurposeRow;
  // The confirmed change's plan (executed === true).
  onChanged: (plan: AccountPurposePlan) => void;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ account, onChanged, onClose, onRefresh }) => {
  const { preview: sendPreview, confirm: sendConfirm } = useStaffAccountPurposeAction();
  const { allocation, blocked } = groupPurposes(account.allowed_purposes);

  const [blockedChosen, setBlockedChosen] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [previewed, setPreviewed] = useState<Previewed | null>(null);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localErrors, setLocalErrors] = useState<{ purpose?: string; reason?: string }>({});
  const [pending, setPending] = useState<'preview' | 'confirm' | null>(null);
  // One request at a time, whatever the clicks: set before the first await.
  const inFlight = useRef(false);

  // ANY edit drops the dry run and its token.
  const edited = () => {
    setPreviewed(null);
    setRefusal(null);
    setNotice(null);
    setLocalErrors({});
  };

  const offered = blockedChosen ? blocked : allocation;
  const name = accountName(account);
  const busy = pending !== null;

  const onPreview = async () => {
    if (inFlight.current) return;
    const trimmed = reason.trim();
    const errors: { purpose?: string; reason?: string } = {};
    if (!offered.includes(purpose)) errors.purpose = 'Choose a purpose.';
    if (trimmed === '') errors.reason = 'A reason is required.';
    else if (trimmed.length > ACCOUNT_PURPOSE_REASON_MAX)
      errors.reason = `The reason is at most ${ACCOUNT_PURPOSE_REASON_MAX} characters.`;
    setPreviewed(null);
    setRefusal(null);
    setNotice(null);
    setLocalErrors(errors);
    if (errors.purpose || errors.reason) return;

    inFlight.current = true;
    setPending('preview');
    try {
      const outcome = await sendPreview(account.id, purpose, trimmed);
      if (!outcome.ok) setRefusal(outcome.refusal);
      else if (outcome.executed) setNotice('The server did not answer with a preview. Preview again.');
      else
        setPreviewed({ purpose, reason: trimmed, token: outcome.previewToken, plan: outcome.plan });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const onConfirm = async () => {
    if (inFlight.current || !previewed || previewed.token === null) return;
    inFlight.current = true;
    setPending('confirm');
    setRefusal(null);
    setNotice(null);
    try {
      const outcome = await sendConfirm(
        account.id,
        previewed.purpose,
        previewed.reason,
        previewed.token,
      );
      if (outcome.ok && outcome.executed) {
        onChanged(outcome.plan);
        return;
      }
      if (outcome.ok) {
        // Answered, and nothing written: never a success.
        setPreviewed(null);
        setNotice(outcome.plan.changes === false ? PURPOSE_NO_CHANGE : PURPOSE_NOT_EXECUTED);
        return;
      }
      setRefusal(outcome.refusal);
      const { status } = outcome.refusal;
      // No answer, a rate limit or a server fault: the same request may be
      // sent again. A request the server answered and refused needs a new
      // dry run.
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable) setPreviewed(null);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  // A 400 names the field it refuses.
  const fieldError = (field: 'purpose' | 'reason'): string | undefined => {
    if (localErrors[field]) return localErrors[field];
    const message = refusal?.status === 400 ? refusal.context[field] : undefined;
    return typeof message === 'string' && message !== '' ? message : undefined;
  };
  const purposeError = fieldError('purpose');
  const reasonError = fieldError('reason');
  const otherErrors =
    refusal?.status === 400
      ? Object.entries(refusal.context).filter(
          ([field, message]) =>
            field !== 'purpose' && field !== 'reason' && typeof message === 'string',
        )
      : [];
  const sentence = refusal?.code ? PURPOSE_REFUSALS.get(refusal.code) : undefined;
  const plan = previewed?.plan ?? null;

  return (
    <SectionCard
      title={`Change the purpose of ${name}`}
      description={`Now: ${humanizeCode(account.purpose)}. ${allocationText(account.allowed_for_allocation)}.`}
      actions={
        <SecondaryButton onClick={onClose} disabled={busy}>
          Close
        </SecondaryButton>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="purpose-new" className={labelCls}>
            New purpose
          </label>
          <div>
            <select
              id="purpose-new"
              className={`${fieldCls} min-w-[16rem]`}
              value={offered.includes(purpose) ? purpose : ''}
              disabled={busy}
              aria-describedby={purposeError ? 'purpose-new-error' : undefined}
              onChange={(e) => {
                setPurpose(e.target.value);
                edited();
              }}
            >
              <option value="">Choose a purpose</option>
              {offered.map((option) => (
                <option key={option} value={option}>
                  {humanizeCode(option)}
                </option>
              ))}
            </select>
          </div>
          {!blockedChosen && allocation.length === 0 && (
            <p className="text-xs text-white/50">
              No allocation purpose fits this account’s type.
            </p>
          )}
          {purposeError && (
            <p id="purpose-new-error" role="alert" className={errorCls}>
              {purposeError}
            </p>
          )}
        </div>

        {blocked.length > 0 && (
          <label className="flex items-start gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={blockedChosen}
              disabled={busy}
              onChange={(e) => {
                setBlockedChosen(e.target.checked);
                setPurpose('');
                edited();
              }}
            />
            <span>
              {PURPOSE_BLOCKED_CHOICE}
              <span className="block text-xs text-white/40">
                Offers the purposes that keep this account out of purchase allocation.
              </span>
            </span>
          </label>
        )}

        <div className="space-y-1">
          <label htmlFor="purpose-reason" className={labelCls}>
            Reason
          </label>
          <textarea
            id="purpose-reason"
            className={`${fieldCls} w-full`}
            rows={2}
            maxLength={ACCOUNT_PURPOSE_REASON_MAX}
            value={reason}
            disabled={busy}
            aria-describedby={reasonError ? 'purpose-reason-error' : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              edited();
            }}
          />
          <p className="text-xs text-white/40" aria-label="Characters left">
            {ACCOUNT_PURPOSE_REASON_MAX - reason.length} of {ACCOUNT_PURPOSE_REASON_MAX} left
          </p>
          {reasonError && (
            <p id="purpose-reason-error" role="alert" className={errorCls}>
              {reasonError}
            </p>
          )}
        </div>

        {otherErrors.length > 0 && (
          <div role="alert" className={errorCls}>
            {otherErrors.map(([field, message]) => (
              <p key={field}>
                <span className="font-mono">{field}</span>: {String(message)}
              </p>
            ))}
          </div>
        )}
        {refusal?.status === 400 && !purposeError && !reasonError && otherErrors.length === 0 && (
          <p role="alert" className={errorCls}>
            {refusal.detail}
          </p>
        )}
        {refusal && refusal.status !== 400 && (
          <div className="space-y-1">
            <ActionRefusal
              refusal={sentence ? { ...refusal, detail: sentence } : refusal}
              gone={PURPOSE_ACCOUNT_GONE}
              onRefresh={onRefresh}
            />
            {sentence && refusal.detail && refusal.detail !== sentence && (
              <p className="text-xs text-white/50">Server: {refusal.detail}</p>
            )}
          </div>
        )}
        {notice && (
          <div role="alert" className={noticeCls}>
            {notice}
          </div>
        )}

        {plan && (
          <div
            role="region"
            aria-label="Server plan"
            className="space-y-1 rounded-lg border border-[#0066FF]/40 bg-[#0066FF]/5 p-4 text-sm"
          >
            <p className="text-white">
              {accountName(plan)}: {humanizeCode(plan.before)} → {humanizeCode(plan.after)}
            </p>
            <p className="text-white/80">After: {allocationText(plan.allowed_for_allocation)}.</p>
            {!plan.changes && (
              <p className="font-semibold text-amber-200">
                {PURPOSE_NO_CHANGE}: the account already has this purpose.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SecondaryButton onClick={() => void onPreview()} disabled={busy}>
            {pending === 'preview' ? 'Previewing…' : 'Preview'}
          </SecondaryButton>
          {/* Nothing to confirm when the dry run says nothing changes. */}
          {previewed && previewed.plan.changes && previewed.token !== null && (
            <PrimaryButton
              onClick={() => void onConfirm()}
              disabled={busy}
              busy={pending === 'confirm'}
            >
              Confirm change
            </PrimaryButton>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

const thCls = 'py-2 px-5 font-medium';

export const InternalClientAccountPurposes: FC = () => {
  const { orgId = '' } = useParams();
  const location = useLocation();
  const { accounts, isLoading, error, notFound, refetch } = useStaffAccountPurposes(orgId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [changed, setChanged] = useState<AccountPurposePlan | null>(null);

  // The client's name rides along from Assigned clients when it is known.
  const orgName = (location.state as { orgName?: unknown } | null)?.orgName;
  const editing = accounts.find((account) => account.id === editingId) ?? null;

  const back = (
    <Link to="/internal/clients" className="text-sm text-[#4DA6FF] hover:underline">
      Back to clients
    </Link>
  );

  return (
    <PageContainer
      title="Account purposes"
      subtitle={`${typeof orgName === 'string' && orgName !== '' ? `${orgName} · ` : ''}Client ${orgId.slice(0, 8)}`}
      actions={back}
    >
      {changed && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          {accountName(changed)} is now {humanizeCode(changed.after)}.{' '}
          {allocationText(changed.allowed_for_allocation)}.
        </div>
      )}

      {notFound ? (
        <SectionCard>
          <div role="alert" className="space-y-2 text-sm text-white/80">
            <p>{PURPOSES_GONE}</p>
            {back}
          </div>
        </SectionCard>
      ) : error !== null ? (
        <ErrorBanner message={error} onRetry={refetch} />
      ) : isLoading && accounts.length === 0 ? (
        <SectionCard>
          <CenteredSpinner label="Loading the account purposes…" />
        </SectionCard>
      ) : accounts.length === 0 ? (
        <SectionCard>
          <EmptyState title="This client has no accounts." />
        </SectionCard>
      ) : (
        <>
          {editing && (
            <PurposeEditor
              key={editing.id}
              account={editing}
              onChanged={(plan) => {
                setChanged(plan);
                setEditingId(null);
                refetch();
              }}
              onClose={() => setEditingId(null)}
              onRefresh={() => {
                setEditingId(null);
                refetch();
              }}
            />
          )}
          <SectionCard title={`Accounts (${accounts.length})`}>
            <div className="overflow-x-auto -m-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                    <th className={thCls}>Code</th>
                    <th className={thCls}>Name</th>
                    <th className={thCls}>Type</th>
                    <th className={thCls}>Active</th>
                    <th className={thCls}>Purpose</th>
                    <th className={thCls}>Purchase allocation</th>
                    <th className={`${thCls} text-right`}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b border-white/5">
                      <td className="py-2.5 px-5 font-mono text-white/80">{account.code}</td>
                      <td className="py-2.5 px-5 text-white/90">{account.name}</td>
                      <td className="py-2.5 px-5 text-white/60">{humanizeCode(account.type)}</td>
                      <td className="py-2.5 px-5 text-white/60">
                        {account.is_active ? 'Yes' : 'No'}
                      </td>
                      <td className="py-2.5 px-5 text-white/80">{humanizeCode(account.purpose)}</td>
                      <td className="py-2.5 px-5">
                        <Pill tone={account.allowed_for_allocation ? 'success' : 'neutral'}>
                          {account.allowed_for_allocation ? 'Allowed' : 'Not allowed'}
                        </Pill>
                      </td>
                      <td className="py-2.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(account.id);
                            setChanged(null);
                          }}
                          disabled={editingId === account.id}
                          aria-label={`Change the purpose of ${accountName(account)}`}
                          className="text-[#4DA6FF] hover:underline disabled:opacity-40 disabled:no-underline"
                        >
                          Change purpose
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </PageContainer>
  );
};
