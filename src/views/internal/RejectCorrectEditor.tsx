import { type FC, useMemo, useState } from 'react';
import {
  type ReviewEntry,
  type RejectCorrectPayload,
  type CorrectedLineInput,
} from '@/hooks/useInternalReview';
import { PrimaryButton, SecondaryButton } from '@/components/internal/ui';

/**
 * Reject & correct editor (MASTER_T2 §4.2). Editable lines PRE-FILLED from the
 * immutable AI draft, a mandatory reason_code (EXACT backend enum), and an
 * optional note. On submit, posts to /api/accounting/review/<id>/reject-correct/
 * via the parent. Field names match ReviewLineInputSerializer exactly
 * (account_id UUID, debit, credit, description, tax_code, line_order).
 *
 * Account choices are limited to the accounts already present on the draft —
 * there is no staff-accessible chart-of-accounts endpoint (staff are not org
 * members), so we do not invent one. Rebalancing within the draft's accounts is
 * supported; the backend re-validates balance + accounts and any error surfaces
 * verbatim.
 */

// Verbatim ReviewDecision.EntryRejectReason choices (accounting/models.py).
const REASON_CODES: { value: string; label: string }[] = [
  { value: 'wrong_account', label: 'Wrong account' },
  { value: 'wrong_amount', label: 'Wrong amount' },
  { value: 'wrong_template', label: 'Wrong template' },
  { value: 'wrong_tax_treatment', label: 'Wrong tax treatment' },
  { value: 'wrong_counterparty', label: 'Wrong counterparty' },
  { value: 'wrong_date', label: 'Wrong date' },
  { value: 'other', label: 'Other' },
];

interface EditLine {
  key: string;
  account_id: string;
  debit: string;
  credit: string;
  description: string;
  tax_code: string;
}

const inputCls =
  'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

export const RejectCorrectEditor: FC<{
  entry: ReviewEntry;
  submitting: boolean;
  errorDetail: string | null;
  onSubmit: (payload: RejectCorrectPayload) => void;
  onCancel: () => void;
}> = ({ entry, submitting, errorDetail, onSubmit, onCancel }) => {
  // Accounts available for correction = distinct accounts present on the draft.
  const accountOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of entry.lines) {
      if (l.account_id && !seen.has(l.account_id)) {
        seen.set(l.account_id, `${l.account_code ?? '—'} — ${l.account_name ?? ''}`.trim());
      }
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [entry.lines]);

  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<EditLine[]>(() =>
    entry.lines.map((l, i) => ({
      key: `orig-${l.id ?? i}`,
      account_id: l.account_id ?? '',
      debit: l.debit ?? '',
      credit: l.credit ?? '',
      description: l.description ?? '',
      tax_code: l.tax_code ?? '',
    })),
  );

  const updateLine = (key: string, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        key: `new-${prev.length}-${prev.reduce((a, l) => a + l.key.length, 0)}`,
        account_id: accountOptions[0]?.value ?? '',
        debit: '',
        credit: '',
        description: '',
        tax_code: '',
      },
    ]);

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  // Client-side pre-checks (the backend is the authority and re-validates).
  const lineValid = (l: EditLine) => {
    const hasDebit = l.debit.trim() !== '';
    const hasCredit = l.credit.trim() !== '';
    return !!l.account_id && hasDebit !== hasCredit; // exactly one side
  };
  const canSubmit =
    !!reasonCode && lines.length >= 2 && lines.every(lineValid) && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    const payloadLines: CorrectedLineInput[] = lines.map((l, i) => ({
      account_id: l.account_id,
      debit: l.debit.trim() === '' ? null : l.debit.trim(),
      credit: l.credit.trim() === '' ? null : l.credit.trim(),
      description: l.description,
      tax_code: l.tax_code,
      line_order: i,
    }));
    onSubmit({ reason_code: reasonCode, note, lines: payloadLines });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">
          Reason code <span className="text-red-400">*</span>
        </label>
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          className={inputCls}
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {REASON_CODES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="Context for this correction…"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-white/60">Corrected lines</label>
          <button
            type="button"
            onClick={addLine}
            disabled={accountOptions.length === 0}
            className="text-xs font-medium text-[#4DA6FF] hover:text-white disabled:opacity-40"
          >
            + Add line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-white/30">
                <th className="py-1 pr-2 font-medium">Account</th>
                <th className="py-1 px-2 font-medium text-right">Debit</th>
                <th className="py-1 px-2 font-medium text-right">Credit</th>
                <th className="py-1 px-2 font-medium">Description</th>
                <th className="py-1 px-2 font-medium">Tax</th>
                <th className="py-1 pl-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-t border-white/5 align-top">
                  <td className="py-1.5 pr-2 min-w-[10rem]">
                    <select
                      value={l.account_id}
                      onChange={(e) => updateLine(l.key, { account_id: e.target.value })}
                      className={inputCls}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {accountOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 px-2 w-28">
                    <input
                      inputMode="decimal"
                      value={l.debit}
                      onChange={(e) =>
                        updateLine(l.key, {
                          debit: e.target.value,
                          credit: e.target.value ? '' : l.credit,
                        })
                      }
                      className={`${inputCls} text-right`}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-1.5 px-2 w-28">
                    <input
                      inputMode="decimal"
                      value={l.credit}
                      onChange={(e) =>
                        updateLine(l.key, {
                          credit: e.target.value,
                          debit: e.target.value ? '' : l.debit,
                        })
                      }
                      className={`${inputCls} text-right`}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-1.5 px-2 min-w-[10rem]">
                    <input
                      value={l.description}
                      onChange={(e) => updateLine(l.key, { description: e.target.value })}
                      className={inputCls}
                    />
                  </td>
                  <td className="py-1.5 px-2 w-20">
                    <input
                      value={l.tax_code}
                      onChange={(e) => updateLine(l.key, { tax_code: e.target.value })}
                      className={inputCls}
                    />
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      disabled={lines.length <= 2}
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
        <p className="mt-2 text-[11px] text-white/30">
          Each line takes exactly one of debit / credit. Accounts are limited to those on the
          original draft. The ledger engine re-validates balance and accounts on submit.
        </p>
      </div>

      {errorDetail && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorDetail}
        </div>
      )}

      <div className="flex items-center gap-3">
        <PrimaryButton onClick={submit} disabled={!canSubmit} busy={submitting}>
          Post correction
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={submitting}>
          Cancel
        </SecondaryButton>
      </div>
    </div>
  );
};
