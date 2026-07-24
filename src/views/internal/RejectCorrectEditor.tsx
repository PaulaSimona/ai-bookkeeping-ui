import { type FC, useMemo, useState } from 'react';
import {
  type ReviewEntry,
  type RejectCorrectPayload,
  type CorrectedLineInput,
} from '@/hooks/useInternalReview';
import { PrimaryButton, SecondaryButton } from '@/components/internal/ui';
import { useStaffOrgAccounts, createStaffOrgAccount } from '@/hooks/useStaffResolution';
import { CounterpartyPicker } from '@/components/internal/CounterpartyPicker';

/**
 * Reject & correct editor (MASTER_T2 §4.2). Editable lines PRE-FILLED from the
 * immutable AI draft, a mandatory reason_code (EXACT backend enum), an optional
 * note, and (new, s28) a counterparty tri-state. Field names match
 * ReviewLineInputSerializer exactly.
 *
 * Account options are the FULL chart for the entry's org (staff accounts endpoint,
 * grouped by type); draft-line accounts stay valid even if inactive. A "+ New
 * account" inline creates one and selects it in the line. The ledger engine
 * re-validates balance + accounts on submit; backend 400s surface verbatim.
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

const TYPE_GROUPS: { type: string; label: string }[] = [
  { type: 'asset', label: 'Assets' },
  { type: 'liability', label: 'Liabilities' },
  { type: 'equity', label: 'Equity' },
  { type: 'revenue', label: 'Revenue' },
  { type: 'expense', label: 'Expenses' },
];

const NORMAL_BALANCE_DEFAULT: Record<string, string> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
};

const DRAFT_GROUP = '__draft__';

interface EditLine {
  key: string;
  account_id: string;
  debit: string;
  credit: string;
  description: string;
  tax_code: string;
}

type CpMode = 'keep' | 'clear' | 'set';

interface AccountOption {
  value: string;
  label: string;
  type: string;
}

const inputCls =
  'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

// ─── Inline new-account form ───────────────────────────────────────────────────

const NewAccountForm: FC<{
  orgId: string;
  parentOptions: AccountOption[];
  onCreated: (accountId: string) => void;
  onCancel: () => void;
}> = ({ orgId, parentOptions, onCreated, onCancel }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [normalBalance, setNormalBalance] = useState(NORMAL_BALANCE_DEFAULT.expense);
  const [parent, setParent] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const changeType = (t: string) => {
    setType(t);
    setNormalBalance(NORMAL_BALANCE_DEFAULT[t] ?? 'debit');
  };

  const create = async () => {
    if (!code.trim() || !name.trim() || creating) return;
    setCreating(true);
    setErr(null);
    const res = await createStaffOrgAccount(orgId, {
      code: code.trim(),
      name: name.trim(),
      type,
      normal_balance: normalBalance,
      parent_account_id: parent || null,
    });
    setCreating(false);
    if (res.ok && res.data) {
      onCreated(res.data.id);
    } else {
      // Surface backend 400 verbatim (uniqueness etc.) — no client re-validation
      // beyond the required code/name.
      setErr(res.errorDetail ?? 'Failed to create account.');
    }
  };

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">New account</div>
      <div className="grid grid-cols-2 gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className={inputCls} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputCls} />
        <select value={type} onChange={(e) => changeType(e.target.value)} className={inputCls}>
          {TYPE_GROUPS.map((g) => (
            <option key={g.type} value={g.type}>
              {g.label}
            </option>
          ))}
        </select>
        <select value={normalBalance} onChange={(e) => setNormalBalance(e.target.value)} className={inputCls}>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
        <select value={parent} onChange={(e) => setParent(e.target.value)} className={`${inputCls} col-span-2`}>
          <option value="">No parent (optional)</option>
          {parentOptions
            .filter((o) => o.type !== DRAFT_GROUP)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      </div>
      {err && <p className="text-xs text-red-300">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={create}
          disabled={!code.trim() || !name.trim() || creating}
          className="rounded-md bg-[#0066FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0052cc] disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create & select'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Editor ────────────────────────────────────────────────────────────────────

export const RejectCorrectEditor: FC<{
  entry: ReviewEntry;
  submitting: boolean;
  errorDetail: string | null;
  onSubmit: (payload: RejectCorrectPayload) => void;
  onCancel: () => void;
}> = ({ entry, submitting, errorDetail, onSubmit, onCancel }) => {
  const orgId = entry.org_id ?? '';
  const { accounts, refetch: refetchAccounts } = useStaffOrgAccounts(orgId);

  // Full chart options grouped by type, unioned with any draft-line accounts not
  // in the active chart (inactive accounts on the draft stay selectable).
  const accountOptions = useMemo<AccountOption[]>(() => {
    const opts: AccountOption[] = accounts.map((a) => ({
      value: a.id,
      label: a.full_name || `${a.code} — ${a.name}`,
      type: a.type,
    }));
    const known = new Set(accounts.map((a) => a.id));
    for (const l of entry.lines) {
      if (l.account_id && !known.has(l.account_id)) {
        known.add(l.account_id);
        opts.push({
          value: l.account_id,
          label: `${l.account_code ?? '—'} — ${l.account_name ?? ''}`.trim(),
          type: DRAFT_GROUP,
        });
      }
    }
    return opts;
  }, [accounts, entry.lines]);

  const draftOnly = accountOptions.filter((o) => o.type === DRAFT_GROUP);

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
  const [newAcctForKey, setNewAcctForKey] = useState<string | null>(null);

  // Counterparty tri-state (§14 14-C-2b). 'keep' = inherit the original's (payload
  // omits counterparty_id); 'clear' = null; 'set' = a picked UUID.
  const [cpMode, setCpMode] = useState<CpMode>('keep');
  const [cpId, setCpId] = useState('');

  const updateLine = (key: string, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        key: `new-${prev.length}-${prev.reduce((a, l) => a + l.key.length, 0)}`,
        account_id: '',
        debit: '',
        credit: '',
        description: '',
        tax_code: '',
      },
    ]);

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const lineValid = (l: EditLine) => {
    const hasDebit = l.debit.trim() !== '';
    const hasCredit = l.credit.trim() !== '';
    return !!l.account_id && hasDebit !== hasCredit; // exactly one side
  };
  const canSubmit =
    !!reasonCode &&
    lines.length >= 2 &&
    lines.every(lineValid) &&
    (cpMode !== 'set' || !!cpId) &&
    !submitting;

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
    const payload: RejectCorrectPayload = { reason_code: reasonCode, note, lines: payloadLines };
    if (cpMode === 'clear') payload.counterparty_id = null;
    else if (cpMode === 'set') payload.counterparty_id = cpId;
    // 'keep' → omit counterparty_id so the backend inherits the original's.
    onSubmit(payload);
  };

  const renderAccountSelect = (l: EditLine) => (
    <select
      value={l.account_id}
      onChange={(e) => updateLine(l.key, { account_id: e.target.value })}
      className={inputCls}
    >
      <option value="" disabled>
        Select…
      </option>
      {TYPE_GROUPS.map((g) => {
        const groupOpts = accountOptions.filter((o) => o.type === g.type);
        if (!groupOpts.length) return null;
        return (
          <optgroup key={g.type} label={g.label}>
            {groupOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        );
      })}
      {draftOnly.length > 0 && (
        <optgroup label="On draft">
          {draftOnly.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">
          Reason code <span className="text-red-400">*</span>
        </label>
        <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={inputCls}>
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
                  <td className="py-1.5 pr-2 min-w-[11rem]">
                    {renderAccountSelect(l)}
                    <button
                      type="button"
                      onClick={() => setNewAcctForKey(newAcctForKey === l.key ? null : l.key)}
                      className="mt-1 text-[11px] font-medium text-[#4DA6FF] hover:text-white"
                    >
                      + New account
                    </button>
                  </td>
                  <td className="py-1.5 px-2 w-28">
                    <input
                      inputMode="decimal"
                      value={l.debit}
                      onChange={(e) =>
                        updateLine(l.key, { debit: e.target.value, credit: e.target.value ? '' : l.credit })
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
                        updateLine(l.key, { credit: e.target.value, debit: e.target.value ? '' : l.debit })
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

        {newAcctForKey && (
          <div className="mt-2">
            <NewAccountForm
              orgId={orgId}
              parentOptions={accountOptions}
              onCreated={(id) => {
                updateLine(newAcctForKey, { account_id: id });
                setNewAcctForKey(null);
                refetchAccounts();
              }}
              onCancel={() => setNewAcctForKey(null)}
            />
          </div>
        )}

        <p className="mt-2 text-[11px] text-white/30">
          Each line takes exactly one of debit / credit. The ledger engine validates the
          accounts and balance on submit.
        </p>
      </div>

      {/* Counterparty (§14 14-C-2b) — tri-state */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">Counterparty</label>
        <div className="flex flex-wrap items-center gap-4 text-sm text-white/70 mb-2">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={cpMode === 'keep'} onChange={() => setCpMode('keep')} />
            Inherited from original
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={cpMode === 'clear'} onChange={() => setCpMode('clear')} />
            None
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={cpMode === 'set'} onChange={() => setCpMode('set')} />
            Set counterparty
          </label>
        </div>
        {cpMode === 'set' && orgId && (
          <CounterpartyPicker orgId={orgId} value={cpId} onChange={setCpId} />
        )}
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
