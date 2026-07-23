// New adjustment (/accountant/adjustments/new, Session-25 Phase E, U2). The
// accountant composes a balanced correcting journal entry: a memo, a date, and
// ≥2 lines each with one side (debit XOR credit) and a positive amount. Amounts
// are kept and SENT as strings; the live balance check runs in integer cents so
// no float drift decides "balanced". The backend (§13.2 seam) is authoritative —
// it re-validates debits == credits and posts through the engine; its stable
// { detail } 4xx bodies surface verbatim. Own data layer; tokens only, no hex.
import { type FC, type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgContext } from '@/context/OrgContext';
import { useToast } from '@/hooks/useToast';
import { PageHeader } from '@/components/t2/PageHeader';
import { Card } from '@/components/t2/Card';
import { PageLoader } from '@/components/Loader';
import { useAccountantChart } from './hooks/useAccountantChart';
import { postAdjustment } from './hooks/adjustmentApi';

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const MONO = 'font-[var(--font-family-mono)] tabular-nums';

// A positive amount with up to two decimals. Anything else is not a valid line
// amount (0, negatives, >2dp, non-numeric all rejected — mirrors the backend
// "positive string amount" rule).
const centsOf = (s: string): number | null => {
  const t = s.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents > 0 ? cents : null;
};
const fmtCents = (c: number): string => CAD.format(c / 100);

const today = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

interface DraftLine {
  key: number;
  account_id: string;
  debit: string;
  credit: string;
}

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

const PageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-[860px] px-6 py-8">{children}</div>
  </div>
);

const lineComplete = (l: DraftLine): boolean => {
  if (!l.account_id) return false;
  const d = centsOf(l.debit);
  const c = centsOf(l.credit);
  // exactly one side filled with a valid positive amount
  return (d !== null && l.credit.trim() === '') || (c !== null && l.debit.trim() === '');
};

const AdjustmentForm: FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeOrg } = useOrgContext();
  const { activeAccounts, isLoading, error } = useAccountantChart();

  const [date, setDate] = useState<string>(today());
  const [memo, setMemo] = useState('');
  const [nextKey, setNextKey] = useState(2);
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 0, account_id: '', debit: '', credit: '' },
    { key: 1, account_id: '', debit: '', credit: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Typing an amount on one side clears the other — enforces one side per line.
  const setDebit = (key: number, v: string) => setLine(key, { debit: v, credit: '' });
  const setCredit = (key: number, v: string) => setLine(key, { credit: v, debit: '' });

  const addLine = () => {
    setLines((ls) => [...ls, { key: nextKey, account_id: '', debit: '', credit: '' }]);
    setNextKey((k) => k + 1);
  };
  const removeLine = (key: number) =>
    setLines((ls) => (ls.length <= 2 ? ls : ls.filter((l) => l.key !== key)));

  const { debitCents, creditCents } = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const l of lines) {
      const dc = centsOf(l.debit);
      const cc = centsOf(l.credit);
      if (dc !== null && l.credit.trim() === '') d += dc;
      else if (cc !== null && l.debit.trim() === '') c += cc;
    }
    return { debitCents: d, creditCents: c };
  }, [lines]);

  const balanced = debitCents > 0 && debitCents === creditCents;
  const allComplete = lines.every(lineComplete);
  const canPost = balanced && memo.trim().length > 0 && lines.length >= 2 && allComplete && !submitting;

  const submit = async () => {
    if (!canPost) return;
    setSubmitting(true);
    setFormError(null);
    const payload = {
      date,
      memo: memo.trim(),
      lines: lines.map((l) => ({
        account_id: l.account_id,
        side: (l.debit.trim() !== '' ? 'debit' : 'credit') as 'debit' | 'credit',
        amount: (l.debit.trim() !== '' ? l.debit : l.credit).trim(),
      })),
    };
    try {
      const res = await postAdjustment(payload);
      if (res?.status === 201) {
        showToast({
          title: 'Adjustment posted',
          message: 'The correcting entry is on the ledger.',
          variant: 'success',
        });
        navigate('/accountant/ledger');
      } else {
        setFormError(res?.data?.detail ?? 'The adjustment could not be posted.');
      }
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? 'The adjustment could not be posted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <PageShell>
      <PageHeader
        title="New adjustment"
        subtitle={`${activeOrg?.org_name ?? 'This client'} · post a balanced correcting entry.`}
      />

      {error && (
        <Card padding className="mt-6">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      <Card padding className="mt-6 space-y-6">
        {/* Date + memo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Memo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Reason for the adjustment"
              className={inputCls}
            />
          </div>
        </div>

        {/* Line table */}
        <div>
          <div className="grid grid-cols-[1fr_140px_140px_36px] items-center gap-3 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <span>Account</span>
            <span className="justify-self-end">Debit</span>
            <span className="justify-self-end">Credit</span>
            <span />
          </div>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_140px_140px_36px] items-center gap-3">
                <select
                  value={l.account_id}
                  onChange={(e) => setLine(l.key, { account_id: e.target.value })}
                  className={inputCls}
                  aria-label="Account"
                >
                  <option value="">Select account…</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  value={l.debit}
                  onChange={(e) => setDebit(l.key, e.target.value)}
                  placeholder="0.00"
                  className={`${inputCls} text-right ${MONO}`}
                  aria-label="Debit amount"
                />
                <input
                  inputMode="decimal"
                  value={l.credit}
                  onChange={(e) => setCredit(l.key, e.target.value)}
                  placeholder="0.00"
                  className={`${inputCls} text-right ${MONO}`}
                  aria-label="Credit amount"
                />
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  disabled={lines.length <= 2}
                  aria-label="Remove line"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add line
          </button>
        </div>

        {/* Live balance chip */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <span
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {balanced
              ? `Balanced · ${fmtCents(debitCents)} = ${fmtCents(creditCents)}`
              : `Out of balance · ${fmtCents(debitCents)} ≠ ${fmtCents(creditCents)}`}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/accountant/ledger')}
              className="rounded-lg border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className="rounded-lg bg-[var(--color-navy)] px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? 'Posting…' : 'Post adjustment'}
            </button>
          </div>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </Card>

      {/* Same immutability language as the ledger — an adjustment is a NEW entry. */}
      <p className="mt-4 text-[12.5px] text-gray-400">
        Adjustments post as new balanced entries and pass the posting engine — nothing existing is edited or deleted.
      </p>
    </PageShell>
  );
};

// Remount on client switch (fresh chart under the new X-Org-Id); prompt an
// unselected multi-client accountant to choose first.
export const NewAdjustment: FC = () => {
  const { activeOrgId, needsSelection } = useOrgContext();
  if (needsSelection) {
    return (
      <PageShell>
        <PageHeader title="New adjustment" subtitle="Choose a client from the sidebar first." />
      </PageShell>
    );
  }
  return <AdjustmentForm key={activeOrgId ?? 'none'} />;
};
