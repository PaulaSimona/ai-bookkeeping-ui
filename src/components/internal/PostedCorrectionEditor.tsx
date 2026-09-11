// PostedCorrectionEditor (S70 3c, F-S69-8 / O-S70-1..7) — supersede a POSTED
// journal entry through the staff correction endpoint
// (POST staff/entries/<id>/correct/, backend S63). A posted entry is never
// edited: the server reverses it and posts the corrected line set in its
// place, atomically, and the replacement points back via corrects_entry.
//
// NOT derived from RejectCorrectEditor — that one speaks the review-queue
// contract (reason_code enum, debit/credit strings, counterparty tri-state,
// DRAFT entries). This one speaks the correction contract: a free-text
// reason, {account_id, side, amount} lines, no counterparty (the replacement
// inherits the original's server-side, O-S69-7), POSTED entries only.
//
// Gate (O-S70-2): on open the entry is RE-READ (useStaffEntryDetail) and the
// primary action is enabled only when that detail row's status is 'posted'.
// The list/ledger row's status is never the gate — it can be stale.
//
// Client-side balance check mirrors the server (sum debits == sum credits,
// > 0) as a fast fail; the server stays authoritative and its 400 detail is
// shown verbatim. Money is handled as integer cents derived from 2-dp
// strings — never a float.
import { type FC, useEffect, useMemo, useState } from 'react';

import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Spinner,
} from '@/components/internal/ui';
import { useStaffEntryDetail } from '@/hooks/useStaffReports';
import {
  type CorrectedLine,
  correctPostedEntry,
  useStaffOrgAccounts,
} from '@/hooks/useStaffResolution';

type Side = 'debit' | 'credit';

interface EditLine {
  key: string;
  account_id: string;
  side: Side;
  amount: string; // 2-dp string while valid; raw input otherwise
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
}> = ({ orgId, entry, onClose, onChanged, notify }) => {
  const { entry: detail } = useStaffEntryDetail(entry.id);
  const {
    accounts,
    isLoading: accountsLoading,
    error: accountsError,
  } = useStaffOrgAccounts(orgId);

  const [lines, setLines] = useState<EditLine[]>([]);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ status?: number; detail: string } | null>(null);

  const entryLabel =
    (detail?.kind === 'ready' && detail.row.entry_number_display) ||
    (entry.entry_number != null ? `JE-${entry.entry_number}` : 'this entry');

  // O-S70-3: prefill ONCE from the re-read detail lines (account, side from
  // whichever figure is non-zero, amount as a 2-dp string). Description and
  // tax_code are not carried — the endpoint does not read them.
  const original = useMemo<string[]>(() => {
    if (detail?.kind !== 'ready') return [];
    return detail.row.lines
      .map((l) => {
        const debit = toCents(l.debit ?? '') ?? 0;
        const credit = toCents(l.credit ?? '') ?? 0;
        const side: Side = debit > 0 ? 'debit' : 'credit';
        const amount = fromCents(side === 'debit' ? debit : credit);
        return lineKey({ account_id: l.account_id, side, amount });
      })
      .sort();
  }, [detail]);

  useEffect(() => {
    if (detail?.kind !== 'ready' || seededFor === detail.row.id) return;
    setLines(
      detail.row.lines.map((l, i) => {
        const debit = toCents(l.debit ?? '') ?? 0;
        const credit = toCents(l.credit ?? '') ?? 0;
        const side: Side = debit > 0 ? 'debit' : 'credit';
        return {
          key: `orig-${l.id ?? i}`,
          account_id: l.account_id,
          side,
          amount: fromCents(side === 'debit' ? debit : credit),
        };
      }),
    );
    setSeededFor(detail.row.id);
  }, [detail, seededFor]);

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

  const isPosted = detail?.kind === 'ready' && detail.row.status === 'posted';
  const statusTitle =
    detail?.kind === 'ready' && !isPosted
      ? `Only posted entries can be corrected (status: ${detail.row.status})`
      : undefined;

  const accountOptions = useMemo(() => {
    const opts = accounts.map((a) => ({
      value: a.id,
      label: a.full_name || `${a.code} — ${a.name}`,
    }));
    // A line's current account may be inactive (absent from the active
    // chart): keep it selectable so the prefilled set is representable.
    const known = new Set(opts.map((o) => o.value));
    if (detail?.kind === 'ready') {
      for (const l of detail.row.lines) {
        if (l.account_id && !known.has(l.account_id)) {
          known.add(l.account_id);
          opts.push({
            value: l.account_id,
            label: `${l.account_code ?? '—'} — ${l.account_name ?? ''}`.trim(),
          });
        }
      }
    }
    return opts;
  }, [accounts, detail]);

  const updateLine = (key: string, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${prev.length}`, account_id: '', side: 'debit', amount: '' },
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
    isPosted && !!reason.trim() && balanced && differs && !submitting && !accountsLoading;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const payload: CorrectedLine[] = lines.map((l) => ({
      account_id: l.account_id,
      side: l.side,
      amount: fromCents(toCents(l.amount) as number),
    }));
    const res = await correctPostedEntry(entry.id, { reason: reason.trim(), lines: payload });
    setSubmitting(false);
    setConfirming(false);
    if (res.ok) {
      const replacement =
        res.entry.entry_number_display ??
        (res.entry.entry_number != null ? `JE-${res.entry.entry_number}` : 'a new entry');
      notify(`Correction posted — ${replacement} replaces ${entryLabel}`, 'success');
      onChanged(); // the page refetches — never a local mutation
      onClose();
    } else {
      setError({ status: res.status, detail: res.errorDetail });
    }
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
        {detail?.kind === 'ready' && (
          <Pill tone={isPosted ? 'success' : 'warning'}>{detail.row.status}</Pill>
        )}
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

      {detail?.kind === 'ready' && (
        <>
          {!isPosted && (
            <p className="text-sm text-amber-200/80">
              Only posted entries can be corrected (status: {detail.row.status}).
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
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
                    <th className="py-1 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} className="border-t border-white/5 align-top">
                      <td className="py-1.5 pr-2 min-w-[14rem]">
                        <select
                          value={l.account_id}
                          onChange={(e) => updateLine(l.key, { account_id: e.target.value })}
                          disabled={submitting}
                          className={fieldCls}
                        >
                          <option value="" disabled>
                            {accountsLoading ? 'Loading accounts…' : 'Select…'}
                          </option>
                          {accountOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
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
            </div>
          </div>

          {error &&
            (error.status === 404 ? (
              <EmptyState
                title="Not found"
                description="This entry is not on a client assigned to you, or it no longer exists."
              />
            ) : (
              <ErrorBanner message={error.detail} />
            ))}

          <div className="flex items-center gap-3">
            <span title={statusTitle}>
              <PrimaryButton
                onClick={() => setConfirming(true)}
                disabled={!canSubmit}
                busy={submitting}
              >
                Post correction
              </PrimaryButton>
            </span>
            <SecondaryButton onClick={onClose} disabled={submitting}>
              Cancel
            </SecondaryButton>
          </div>
        </>
      )}

      {confirming && (
        <ConfirmModal title="Post correction?" onClose={() => !submitting && setConfirming(false)}>
          <p className="text-sm text-white/70">
            This reverses {entryLabel} and posts a replacement. Cannot be undone.
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
