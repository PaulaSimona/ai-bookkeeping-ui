// CardChangeDialog (S87 B2b U5, O-S87-9) — "Change" on a business card of the
// staff card page: re-point the card's bank feed to another card-liability
// account (POST staff/bank-accounts/<feed>/repoint/).
//
// What the feed can move to comes ONLY from the server
// (GET …/repoint-targets/), never from the org's chart of accounts: each
// target as returned, "Sweep remaining lines" (the account the feed is on now)
// and — only when the server says one would be created — "Create new account".
// A target is marked "this card's account" when its name ends in the card's
// last four; choosing an existing target whose name does not contain them
// shows a caution, repeated beside the plan (N-S87-2). Targets are {code,
// name} and are offered as a plain radio group: AccountPicker needs fields the
// server does not send here, and none is invented.
//
// Flow: Preview asks for the plan (a dry run) and shows it — amounts as the
// server's strings, with the balance legend (PlanPreview). Confirm is the same
// request with confirm true. A re-point counts as carried out only when the
// server says so (executed === true); the entry it posted is then named by its
// number, read from the staff entry detail. "Advanced: override amount" sends
// the amount as typed, checked for shape only, and needs a written reason.
//
// Failures read as on the bank-rows screen: a refusal by its code and in the
// server's words; 404 as the feed being gone, with a refresh; 429 as the
// hourly limit, never retried here; no answer at the confirm leaves the plan
// up, to be confirmed again.
import { type FC, useEffect, useId, useState } from 'react';

import { ActionRefusal, noticeCls } from '@/components/internal/ActionRefusal';
import { RepointPlanPreview } from '@/components/internal/PlanPreview';
import { ShortId } from '@/components/internal/ShortId';
import { CenteredSpinner, Pill, PrimaryButton, SecondaryButton } from '@/components/internal/ui';
import {
  REPOINT_NEW_ACCOUNT,
  REPOINT_REASON_MAX,
  fetchRepointTargets,
  repointFeed,
  type RepointPlan,
  type RepointTargets,
} from '@/hooks/useStaffRepoint';
import { useStaffEntryDetail } from '@/hooks/useStaffReports';
import { type RemediationRefusal, type StaffCard } from '@/hooks/useStaffResolution';
import { formatEntryNumber } from '@/utils/entryStatus';

const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-white/40';
const fieldCls =
  'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF] disabled:opacity-50';
const hintCls = 'text-xs text-amber-300';
const asideCls = 'text-xs text-white/40';

// An override amount is checked for its shape only, and the shape is cents:
// an optional leading minus, digits, and at most two decimals. That is
// narrower than the server on purpose (owner ruling, U5b). The server reads
// the string with Decimal() and takes any finite value — a third decimal, an
// exponent (accounting/staff_resolution_views.py:1006-1017) — and rounds it to
// cents; here nothing is sent that it would have to round. The minus stays:
// the sign must be that of the balance held, so a debit balance is moved by a
// negative (accounting/feed_repoint_service.py:855-856).
const AMOUNT_SHAPE = /^-?\d+(\.\d{1,2})?$/;

// What the feed is to move to: an offered target, the account it is on now
// (a sweep), or the card's own account, to be created.
type Choice = { kind: 'target'; code: string } | { kind: 'sweep' } | { kind: 'new' };

// What ActionRefusal says on a 404 — instead of the targets, a plan, or the
// confirmed re-point: the feed is gone.
const FEED_GONE = "This card's feed is no longer available.";

// The entry a re-point posted: by its number once the staff entry detail has
// been read; by its short id until then, and if that read fails.
const PostedEntry: FC<{ entryId: string }> = ({ entryId }) => {
  const { entry } = useStaffEntryDetail(entryId);
  const number =
    entry?.kind === 'ready'
      ? entry.row.entry_number_display ?? formatEntryNumber(entry.row.entry_number)
      : null;
  if (number) return <p>Posted as {number}.</p>;
  return (
    <p>
      Posted as entry <ShortId id={entryId} />.
    </p>
  );
};

export const CardChangeDialog: FC<{
  card: StaffCard;
  // The cards are to be read again: a re-point came back, carried out or not,
  // or the feed turned out to be gone.
  onChanged: () => void;
  onClose: () => void;
}> = ({ card, onChanged, onClose }) => {
  const titleId = useId();
  const groupName = useId();
  // The page opens this dialog only for a card the server named a feed for.
  const feedId = card.feed_id ?? null;

  const [targets, setTargets] = useState<RepointTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  // The dry run's plan: while it is set, the dialog is at the confirm.
  const [plan, setPlan] = useState<RepointPlan | null>(null);
  // What the confirm came back with.
  const [result, setResult] = useState<{ executed: boolean; plan: RepointPlan } | null>(null);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);
  // A request is out: nothing can be asked for, changed or walked back.
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!feedId) return undefined;
    let cancelled = false;
    void fetchRepointTargets(feedId).then((outcome) => {
      if (cancelled) return;
      if (outcome.ok) setTargets(outcome.targets);
      else setRefusal(outcome.refusal);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [feedId]);

  if (!feedId) return null;

  const chosenTarget =
    choice?.kind === 'target'
      ? targets?.targets.find((target) => target.code === choice.code) ?? null
      : null;
  // N-S87-2: an existing account that is not named for this card may be the
  // wrong one (e.g. "2130 American Express" for a Mastercard feed).
  const caution =
    chosenTarget && !chosenTarget.name.includes(card.last4)
      ? `Check this account: ${chosenTarget.code} ${chosenTarget.name} is not named for this card (····${card.last4}).`
      : null;

  // An override is what is typed while "Advanced" is open; empty is no
  // override. Taken as typed, spaces and all — a space is not part of an amount.
  const typedAmount = advanced ? amount : '';
  const amountOk = typedAmount === '' || AMOUNT_SHAPE.test(typedAmount);
  const reasonOk = typedAmount === '' || reason.trim() !== '';
  const canPreview = choice !== null && amountOk && reasonOk && !busy;

  // One request, sent twice: first as a dry run, then with confirm true.
  const send = (chosen: Choice, current: RepointTargets, confirm: boolean) => {
    const code =
      chosen.kind === 'target'
        ? chosen.code
        : chosen.kind === 'sweep'
          ? current.current_account.code
          : REPOINT_NEW_ACCOUNT;
    return repointFeed(feedId, { targetAccountCode: code, confirm, amount: typedAmount, reason });
  };

  const preview = async () => {
    if (!choice || !targets) return;
    setBusy(true);
    setRefusal(null);
    const outcome = await send(choice, targets, false);
    setBusy(false);
    if (outcome.ok) setPlan(outcome.plan);
    else setRefusal(outcome.refusal);
  };

  const confirm = async () => {
    if (!choice || !targets) return;
    setBusy(true);
    setRefusal(null);
    const outcome = await send(choice, targets, true);
    setBusy(false);
    if (!outcome.ok) {
      setRefusal(outcome.refusal);
      // No answer at all (a lost connection): the plan stays, to be confirmed
      // again. An answer from the server sends the dialog back to the choice.
      if (outcome.refusal.status !== undefined) setPlan(null);
      return;
    }
    setPlan(null);
    // Carried out only when the server says so (executed === true).
    setResult({ executed: outcome.executed, plan: outcome.plan });
    onChanged();
  };

  const close = () => {
    if (!busy) onClose();
  };
  const refresh = () => {
    onChanged();
    onClose();
  };

  const body = () => {
    if (result) {
      return (
        <div className="space-y-4 text-sm text-white/80">
          {result.executed ? (
            <div className="space-y-1">
              <p className="font-medium text-emerald-300">The re-point was carried out.</p>
              {result.plan.entry_id ? (
                <PostedEntry entryId={result.plan.entry_id} />
              ) : (
                <p>No entry was needed.</p>
              )}
            </div>
          ) : (
            <div role="alert" className={noticeCls}>
              <p>The server did not carry this out.</p>
              <p className="mt-1 text-xs">
                Feed <ShortId id={result.plan.feed_id} />
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <PrimaryButton onClick={onClose}>Close</PrimaryButton>
          </div>
        </div>
      );
    }

    if (plan) {
      return (
        <div className="space-y-4">
          <RepointPlanPreview plan={plan} />
          {caution && <p className={hintCls}>{caution}</p>}
          {refusal && <ActionRefusal refusal={refusal} gone={FEED_GONE} onRefresh={refresh} />}
          <div className="flex justify-end gap-2">
            <SecondaryButton
              onClick={() => {
                setPlan(null);
                setRefusal(null);
              }}
              disabled={busy}
            >
              Back
            </SecondaryButton>
            <PrimaryButton onClick={() => void confirm()} disabled={busy} busy={busy}>
              Confirm
            </PrimaryButton>
          </div>
        </div>
      );
    }

    if (loading) return <CenteredSpinner label="Loading the accounts this feed can move to…" />;

    if (!targets) {
      return (
        <div className="space-y-4">
          {refusal && <ActionRefusal refusal={refusal} gone={FEED_GONE} onRefresh={refresh} />}
          <div className="flex justify-end">
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          </div>
        </div>
      );
    }

    const option = (label: string, chosen: boolean, pick: Choice) => (
      <label className="flex items-center gap-2 text-sm text-white/90">
        <input
          type="radio"
          name={groupName}
          checked={chosen}
          onChange={() => setChoice(pick)}
        />
        <span>{label}</span>
      </label>
    );

    return (
      <div className="space-y-4">
        <fieldset disabled={busy} className="space-y-2">
          <legend className={labelCls}>Move this feed to</legend>
          <ul className="space-y-1.5">
            {/* Every target the server returned, as returned — never hidden,
                never added to. */}
            {targets.targets.map((target) => (
              <li key={target.code} className="flex flex-wrap items-center gap-2">
                {option(
                  `${target.code} ${target.name}`,
                  choice?.kind === 'target' && choice.code === target.code,
                  { kind: 'target', code: target.code },
                )}
                {target.name.endsWith(card.last4) && (
                  <Pill tone="success">this card&apos;s account</Pill>
                )}
              </li>
            ))}
            <li className="flex flex-wrap items-center gap-2">
              {option('Sweep remaining lines', choice?.kind === 'sweep', { kind: 'sweep' })}
              <span className={asideCls}>
                on {targets.current_account.code} {targets.current_account.name}, where the feed is
                now
              </span>
            </li>
            {targets.new_account_available && (
              <li className="flex flex-wrap items-center gap-2">
                {option('Create new account', choice?.kind === 'new', { kind: 'new' })}
                <span className={asideCls}>the card&apos;s own account, created on Confirm</span>
              </li>
            )}
          </ul>
        </fieldset>

        {caution && <p className={hintCls}>{caution}</p>}

        <div>
          <button
            type="button"
            onClick={() => setAdvanced((open) => !open)}
            aria-expanded={advanced}
            className="text-xs font-medium text-[#4DA6FF] underline underline-offset-2 hover:text-white"
          >
            Advanced: override amount
          </button>
          {advanced && (
            <div className="mt-2 max-w-md space-y-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Override amount"
                placeholder="Amount to move, e.g. 1234.50"
                inputMode="decimal"
                disabled={busy}
                className={fieldCls}
              />
              {!amountOk && (
                <p className={hintCls}>Use digits with at most two decimals, like 1234.50.</p>
              )}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={REPOINT_REASON_MAX}
                aria-label="Reason"
                placeholder="Why the computed amount is being overridden"
                rows={2}
                disabled={busy}
                className={fieldCls}
              />
              {amountOk && !reasonOk && (
                <p className={hintCls}>An override needs a written reason.</p>
              )}
              <p className={asideCls}>Leave the amount empty to move what the server computes.</p>
            </div>
          )}
        </div>

        {refusal && <ActionRefusal refusal={refusal} gone={FEED_GONE} onRefresh={refresh} />}

        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={close} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={() => void preview()} disabled={!canPreview} busy={busy}>
            Preview
          </PrimaryButton>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0A1628] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-base font-semibold text-white">
            Change account for the card ending {card.last4}
          </h3>
          <button type="button" onClick={close} className="text-white/40 hover:text-white">
            ✕
          </button>
        </div>
        {body()}
      </div>
    </div>
  );
};
