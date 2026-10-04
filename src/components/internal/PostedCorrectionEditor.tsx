// PostedCorrectionEditor (S70 3c, F-S69-8 / O-S70-1..7; S84 CW2, O-S84-1/-2) —
// correct a POSTED journal entry through the staff correction endpoint
// (POST staff/entries/<id>/correct/). A posted entry is never edited: the
// server posts ONE new entry that corrects it — a line reversing each of its
// lines, then the corrected lines — atomically, and the new entry points back
// via corrects_entry. The corrected entry stays in the books as "Corrected by
// JE-x"; the new entry becomes the chain's live entry.
//
// NOT derived from RejectCorrectEditor — that one speaks the review-queue
// contract (reason_code enum, debit/credit strings, counterparty tri-state,
// DRAFT entries). This one speaks the correction contract: a free-text
// reason, {account_id, side, amount, description, tax_code} lines, no
// counterparty (the correction inherits the entry's server-side), the chain's
// LIVE entry only.
//
// Gate (O-S70-2, D-S85-13): on open the entry is RE-READ (useStaffEntryDetail)
// and the editor is offered only when that detail row is the chain's live
// entry — the same rule the panel's Correct button uses (entryStatus). The
// list/ledger row is never the gate — it can be stale.
//
// Prefill (D-S85-18): only the entry's OWN lines — the ones whose
// reverses_line_id is null. An entry that is itself a correction also holds
// the lines reversing the entry it corrected; those are never prefilled and
// never sent, so a second correction cannot re-post the reversing half.
// reverses_line_id is read-only: the request never carries it.
//
// One save (O-S84-2): "Post correction", then a confirm pop-up (D-S85-12).
//
// Client-side balance check mirrors the server (sum debits == sum credits,
// > 0) as a fast fail; the server stays authoritative and its refusal detail
// is shown verbatim. Money is handled as integer cents derived from 2-dp
// strings — never a float.
import { type FC, useEffect, useMemo, useState } from 'react';

import { AccountPicker } from '@/components/AccountPicker';
import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Spinner,
} from '@/components/internal/ui';
import { useAllAccounts } from '@/hooks/useAllAccounts';
import { useStaffEntryDetail } from '@/hooks/useStaffReports';
import { type CorrectedLine, correctPostedEntry } from '@/hooks/useStaffResolution';
import type { CurrentAccount } from '@/types/account';
import {
  entryStatusLabel,
  formatEntryNumber,
  isLiveEntry,
  isOwnLine,
  liveEntryLink,
  nonLiveNote,
  type EntryRef,
} from '@/utils/entryStatus';

type Side = 'debit' | 'credit';

interface EditLine {
  key: string;
  account_id: string;
  side: Side;
  amount: string; // 2-dp string while valid; raw input otherwise
  // D-S85-17: carried from the entry's own line and sent back as they are; a
  // line added here starts with both empty. Shown, not edited.
  description: string;
  tax_code: string;
}

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

/** "123.4" → 12340 cents; null when not a valid non-negative 2-dp amount. */
const toCents = (raw: string): number | null => {
  const s = raw.trim();
  if (!AMOUNT_RE.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
};

const fromCents = (cents: number): string =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

/** Normalise a line for comparison with the original set (O-S70-4). */
const lineKey = (l: { account_id: string; side: Side; amount: string }) =>
  `${l.account_id}|${l.side}|${l.amount}`;

// The refusals that mean "this entry is no longer the live one" — someone
// corrected or reversed it since the editor opened.
const NOT_LIVE_CODES = new Set(['already_corrected', 'already_reversed']);

const fieldCls =
  'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

export const PostedCorrectionEditor: FC<{
  orgId: string;
  entry: { id: string; entry_number: number | null };
  onClose: () => void;
  onChanged: () => void;
  // The page's toast (InternalQueue.tsx `notify` precedent): the editor closes
  // on success, so the confirmation must outlive it.
  notify: (message: string, type: 'success' | 'error') => void;
  // Opens the chain's live entry in the page's panel — offered when this entry
  // turns out not to be the live one. Absent → the live entry is only named.
  onOpenEntry?: (entry: EntryRef) => void;
}> = ({ orgId, entry, onClose, onChanged, notify, onOpenEntry }) => {
  const { entry: detail, refetch: refetchDetail } = useStaffEntryDetail(entry.id);
  // Every active account of the client org, all pages (D-S84-6).
  const {
    accounts,
    loading: accountsLoading,
    error: accountsError,
  } = useAllAccounts('staff', orgId);

  const [lines, setLines] = useState<EditLine[]>([]);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ status?: number; code?: string; detail: string } | null>(null);

  const row = detail?.kind === 'ready' ? detail.row : null;
  const entryLabel =
    row?.entry_number_display ?? formatEntryNumber(entry.entry_number) ?? 'this entry';

  // D-S85-18: the lines a correction starts from are the entry's OWN lines —
  // the ones whose reverses_line_id is null. An entry that is itself a
  // correction also holds the lines reversing the entry it corrected; the
  // server reverses the own lines itself, so carrying the reversing ones into
  // the corrected set would post them a second time. They are never prefilled.
  const ownLines = useMemo(
    () => (detail?.kind === 'ready' ? detail.row.lines.filter(isOwnLine) : []),
    [detail],
  );

  // O-S70-3: prefill ONCE from the re-read detail's own lines (account, side
  // from whichever figure is non-zero, amount as a 2-dp string, and the line's
  // own description and tax code — D-S85-17).
  const original = useMemo<string[]>(() => {
    if (detail?.kind !== 'ready') return [];
    return ownLines
      .map((l) => {
        const debit = toCents(l.debit ?? '') ?? 0;
        const credit = toCents(l.credit ?? '') ?? 0;
        const side: Side = debit > 0 ? 'debit' : 'credit';
        const amount = fromCents(side === 'debit' ? debit : credit);
        return lineKey({ account_id: l.account_id, side, amount });
      })
      .sort();
  }, [detail, ownLines]);

  useEffect(() => {
    if (detail?.kind !== 'ready' || seededFor === detail.row.id) return;
    setLines(
      ownLines.map((l, i) => {
        const debit = toCents(l.debit ?? '') ?? 0;
        const credit = toCents(l.credit ?? '') ?? 0;
        const side: Side = debit > 0 ? 'debit' : 'credit';
        return {
          key: `orig-${l.id ?? i}`,
          account_id: l.account_id,
          side,
          amount: fromCents(side === 'debit' ? debit : credit),
          description: l.description ?? '',
          tax_code: l.tax_code ?? '',
        };
      }),
    );
    setSeededFor(detail.row.id);
  }, [detail, ownLines, seededFor]);

  // Esc closes when nothing is in flight (the confirm first, then the editor).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || submitting) return;
      if (confirming) setConfirming(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, submitting, onClose]);

  // D-S85-13: the editor is offered on the chain's LIVE entry only — the rule
  // module's answer for the row just re-read.
  const isLive = row !== null && isLiveEntry(row);
  const liveLink = row !== null ? liveEntryLink(row) : null;
  const notLiveText =
    row === null || isLive
      ? null
      : nonLiveNote(row) ??
        `Only the live entry of a chain can be corrected (status: ${entryStatusLabel(row)}).`;

  // A line's own account may be inactive (absent from the active chart). Each
  // prefilled line hands it to its picker as the current account, keyed like
  // the seeded lines above, so the prefilled set stays representable and the
  // line can be put back to it.
  const originalAccounts = useMemo(() => {
    const byKey = new Map<string, CurrentAccount>();
    if (detail?.kind === 'ready') {
      detail.row.lines.forEach((l, i) => {
        if (!l.account_id) return;
        byKey.set(`orig-${l.id ?? i}`, {
          id: l.account_id,
          code: l.account_code ?? '—',
          name: l.account_name ?? '',
        });
      });
    }
    return byKey;
  }, [detail]);

  // D-S85-15: corrected lines need ACTIVE accounts (the server refuses the set
  // otherwise). The staff chart is active-only, so an account missing from it
  // is inactive: it is tagged, and posting waits until every line has an
  // active account. Unknown while the chart is loading or failed to load.
  const activeIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const chartReady = !accountsLoading && !accountsError;
  const isInactive = (l: EditLine): boolean =>
    chartReady && !!l.account_id && !activeIds.has(l.account_id);
  const anyInactive = lines.some(isInactive);

  const updateLine = (key: string, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        account_id: '',
        side: 'debit',
        amount: '',
        description: '',
        tax_code: '',
      },
    ]);
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));
  const normaliseAmount = (key: string, raw: string) => {
    const cents = toCents(raw);
    if (cents !== null) updateLine(key, { amount: fromCents(cents) });
  };

  // O-S70-4: every line valid (account chosen, amount > 0 at 2 dp), >= 2 lines,
  // balanced, and different from the original set.
  const lineCents = lines.map((l) => toCents(l.amount));
  const allValid =
    lines.length >= 2 &&
    lines.every((l, i) => !!l.account_id && lineCents[i] !== null && (lineCents[i] as number) > 0);
  const debits = lines.reduce((s, l, i) => s + (l.side === 'debit' ? lineCents[i] ?? 0 : 0), 0);
  const credits = lines.reduce((s, l, i) => s + (l.side === 'credit' ? lineCents[i] ?? 0 : 0), 0);
  const balanced = allValid && debits === credits && debits > 0;
  const current = allValid
    ? lines
        .map((l) => lineKey({ ...l, amount: fromCents(toCents(l.amount) as number) }))
        .sort()
    : [];
  const differs =
    current.length !== original.length || current.some((k, i) => k !== original[i]);
  const canSubmit =
    isLive &&
    !!reason.trim() &&
    balanced &&
    differs &&
    !submitting &&
    chartReady &&
    !anyInactive;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const payload: CorrectedLine[] = lines.map((l) => ({
      account_id: l.account_id,
      side: l.side,
      amount: fromCents(toCents(l.amount) as number),
      description: l.description,
      tax_code: l.tax_code,
    }));
    const res = await correctPostedEntry(entry.id, { reason: reason.trim(), lines: payload });
    setSubmitting(false);
    setConfirming(false);
    if (res.ok) {
      const correction =
        res.entry.entry_number_display ??
        formatEntryNumber(res.entry.entry_number) ??
        'a new entry';
      notify(`Correction posted — ${correction} corrects ${entryLabel}.`, 'success');
      onChanged(); // the page refetches — never a local mutation
      onClose();
    } else {
      setError({ status: res.status, code: res.code, detail: res.errorDetail });
      // The entry stopped being the live one: re-read it, so the gate closes
      // and the link to the live entry appears next to the server's message.
      if (res.code && NOT_LIVE_CODES.has(res.code)) refetchDetail();
    }
  };

  const openLive = () => {
    if (!liveLink || !onOpenEntry) return;
    onChanged(); // the page's own row is stale too
    onOpenEntry(liveLink);
  };

  const sideToggle = (l: EditLine) => (
    <div className="inline-flex rounded-md border border-white/15 overflow-hidden text-xs">
      {(['debit', 'credit'] as Side[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => updateLine(l.key, { side: s })}
          disabled={submitting}
          className={`px-2 py-1 font-medium ${
            l.side === s ? 'bg-[#0066FF] text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          {s === 'debit' ? 'Dr' : 'Cr'}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
          Correct {entryLabel}
        </div>
        {row && <Pill tone={isLive ? 'success' : 'warning'}>{entryStatusLabel(row)}</Pill>}
      </div>

      {detail?.kind === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Spinner className="w-4 h-4" /> Loading entry…
        </div>
      )}
      {detail?.kind === 'error' && (
        <EmptyState title="Not found" description={detail.message} />
      )}
      {accountsError && <ErrorBanner message={accountsError} />}

      {/* A server refusal, by code, with the server's own words. */}
      {error &&
        (error.status === 404 ? (
          <EmptyState
            title="Not found"
            description="This entry is not on a client assigned to you, or it no longer exists."
          />
        ) : (
          <ErrorBanner message={error.detail} />
        ))}

      {row && !isLive && (
        <div className="space-y-2">
          <p className="text-sm text-amber-200/80">{notLiveText}</p>
          {liveLink && onOpenEntry && (
            <SecondaryButton onClick={openLive}>
              Open {liveLink.number ?? 'the live entry'}
            </SecondaryButton>
          )}
        </div>
      )}

      {row && isLive && (
        <>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              maxLength={500}
              placeholder="Why this entry is wrong (carried into the correction's description)"
              className={fieldCls}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-white/60">Corrected lines</label>
              <button
                type="button"
                onClick={addLine}
                disabled={submitting}
                className="text-xs font-medium text-[#4DA6FF] hover:text-white"
              >
                + Add line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-white/30">
                    <th className="py-1 pr-2 font-medium">Account</th>
                    <th className="py-1 px-2 font-medium">Side</th>
                    <th className="py-1 px-2 font-medium text-right">Amount</th>
                    <th className="py-1 px-2 font-medium">Description</th>
                    <th className="py-1 px-2 font-medium">Tax</th>
                    <th className="py-1 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} className="border-t border-white/5 align-top">
                      <td className="py-1.5 pr-2 min-w-[14rem]">
                        <AccountPicker
                          id={`correction-account-${l.key}`}
                          ariaLabel="Account"
                          tone="dark"
                          required
                          value={l.account_id}
                          onChange={(next) => updateLine(l.key, { account_id: next })}
                          accounts={accounts}
                          loading={accountsLoading}
                          // A chart that failed to load is said ONCE, in the
                          // banner above; the pickers are disabled and do
                          // not repeat it.
                          error={accountsError}
                          hideError
                          currentAccount={originalAccounts.get(l.key) ?? null}
                          disabled={submitting || !!accountsError}
                          placeholder="Select…"
                        />
                        {isInactive(l) && (
                          <span className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">
                            inactive
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">{sideToggle(l)}</td>
                      <td className="py-1.5 px-2 w-32">
                        <input
                          inputMode="decimal"
                          value={l.amount}
                          onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                          onBlur={(e) => normaliseAmount(l.key, e.target.value)}
                          disabled={submitting}
                          className={`${fieldCls} text-right ${
                            l.amount && toCents(l.amount) === null ? 'border-red-500/60' : ''
                          }`}
                          placeholder="0.00"
                        />
                      </td>
                      {/* D-S85-17: carried from the entry's line, shown, not edited. */}
                      <td className="py-1.5 px-2 min-w-[8rem] pt-3 text-xs text-white/60">
                        {l.description || '—'}
                      </td>
                      <td className="py-1.5 px-2 w-16 pt-3 text-xs text-white/60">
                        {l.tax_code || '—'}
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          disabled={submitting || lines.length <= 2}
                          className="text-white/40 hover:text-red-300 disabled:opacity-30 text-xs"
                          title={lines.length <= 2 ? 'At least 2 lines required' : 'Remove line'}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-white/40">
              <span>
                Dr {fromCents(debits)} / Cr {fromCents(credits)}
                {allValid && (
                  <span className={balanced ? 'text-emerald-300/80' : 'text-red-300/80'}>
                    {balanced ? ' — balanced' : ' — must balance'}
                  </span>
                )}
              </span>
              {allValid && balanced && !differs && (
                <span className="text-amber-200/70">Identical to the original — nothing to correct.</span>
              )}
              {anyInactive && (
                <span className="text-amber-200/70">
                  A line uses an inactive account — choose an active account to post.
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {(row || detail?.kind === 'error') && (
        <div className="flex items-center gap-3">
          {isLive && (
            <PrimaryButton
              onClick={() => setConfirming(true)}
              disabled={!canSubmit}
              busy={submitting}
            >
              Post correction
            </PrimaryButton>
          )}
          <SecondaryButton onClick={onClose} disabled={submitting}>
            {isLive ? 'Cancel' : 'Close'}
          </SecondaryButton>
        </div>
      )}

      {confirming && (
        <ConfirmModal title="Post correction?" onClose={() => !submitting && setConfirming(false)}>
          <p className="text-sm text-white/70">
            Posts one new entry that corrects {entryLabel}. Audited; cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setConfirming(false)} disabled={submitting}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void submit()} disabled={submitting} busy={submitting}>
              Confirm
            </PrimaryButton>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};
