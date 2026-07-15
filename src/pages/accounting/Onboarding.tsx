// Onboarding wizard (§14 14A-2) — 3 steps: tax profile (shared TaxProfileForm),
// opening balance (once-ever choice), bank-connection pointer. Soft gate per
// ruling D1: this page is a guided path, never a wall — uploads are not blocked
// anywhere. Route carries the interim RequireStaffOrSuperuser gate (D-14A2-4).
import { Fragment, type FC, type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { PageLoader } from '@/components/Loader';
import { TaxProfileForm } from '@/components/accounting/TaxProfileForm';
import { useAccounts, useOrgMe } from '@/hooks/useAccounts';
import { useTaxProfile, type SaveTaxProfileResult } from '@/hooks/useTaxProfile';

// ─── Types ────────────────────────────────────────────────────────────────────

type ObMode = 'starting_fresh' | 'opening_balances';

interface ObLine {
  key: number;
  account_code: string;
  debit: string;
  credit: string;
}

// 201 response of POST /api/accounting/opening-balance/ (backend 4249a88).
interface ObResult {
  choice: ObMode;
  books_start_date: string;
  locked_through_date: string;
  entry_id: string | null;
}

// The server-owned balancing account: never selectable, never submitted —
// sending a 3500 line is a 400 ("server-owned — added automatically").
const OBE_CODE = '3500';

// ─── Money helpers (integer-cents math — no floating-point drift) ─────────────

// Parse a money string to integer cents. '' → null (side not used);
// malformed → NaN (validation error).
const toCents = (raw: string): number | null => {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(s)) return Number.NaN;
  const [whole, frac = ''] = s.split('.');
  return parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
};

// Integer-only formatting — no float division anywhere.
const fmtCents = (cents: number): string => {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

// Client-side mirror of the server's future-date rule (today is allowed).
// NOTE: this mirror uses the browser-LOCAL date; the server compares
// timezone.now().date() (UTC) and remains authoritative — a UTC-rollover
// disagreement renders through the normal 400 path by design.
const isFutureLocalDate = (iso: string): boolean => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return iso > today; // ISO YYYY-MM-DD compares lexicographically
};

// ─── Shared styling (light content-area standard) ─────────────────────────────

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed';

const cardCls = 'rounded-2xl bg-white border border-gray-100 shadow-sm p-6';

const primaryBtnCls =
  'flex items-center justify-center gap-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors';

// ─── Step indicator ───────────────────────────────────────────────────────────

const StepIndicator: FC<{
  current: number;
  taxDone: boolean;
  obDone: boolean;
  onGo: (n: 1 | 2 | 3) => void;
}> = ({ current, taxDone, obDone, onGo }) => {
  const steps: { n: 1 | 2 | 3; label: string; done: boolean }[] = [
    { n: 1, label: 'Tax profile', done: taxDone },
    { n: 2, label: 'Opening balance', done: obDone },
    { n: 3, label: 'Connect a bank', done: false },
  ];
  return (
    <div className="flex items-center gap-3 mb-8">
      {steps.map((s, i) => {
        const reachable = s.n <= current || s.done;
        const circle = s.done
          ? 'bg-emerald-500 text-white'
          : s.n === current
            ? 'bg-[#0066FF] text-white'
            : 'bg-gray-200 text-gray-500';
        return (
          <Fragment key={s.n}>
            {i > 0 && <div className="flex-1 h-px bg-gray-200" />}
            <button
              type="button"
              onClick={() => reachable && onGo(s.n)}
              disabled={!reachable}
              className={`flex items-center gap-2 ${reachable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${circle}`}>
                {s.done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  s.n
                )}
              </span>
              <span className={`text-sm font-medium ${s.n === current ? 'text-gray-900' : 'text-gray-500'}`}>
                {s.label}
              </span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const Onboarding: FC = () => {
  const navigate = useNavigate();
  const org = useOrgMe();
  const isOwner = org.role === 'owner';

  const { profile, isLoading: profileLoading, refetch: refetchProfile } = useTaxProfile();
  const { accounts } = useAccounts({ active: true });

  const [step, setStep] = useState<1 | 2 | 3 | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [chartReseeded, setChartReseeded] = useState(false);

  // ── Step 2 form state ──
  const [mode, setMode] = useState<ObMode | null>(null);
  const [booksStartDate, setBooksStartDate] = useState('');
  const [lines, setLines] = useState<ObLine[]>([{ key: 0, account_code: '', debit: '', credit: '' }]);
  const [nextKey, setNextKey] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});
  const [obResult, setObResult] = useState<ObResult | null>(null);

  // Open on the first incomplete step, once org state has loaded.
  useEffect(() => {
    if (!org.isLoading && step === null) {
      setStep(org.hasTaxProfile ? 2 : 1);
    }
  }, [org.isLoading, org.hasTaxProfile, step]);

  // Selectable accounts for opening-balance lines: active, minus the
  // server-owned 3500 (submitting it is a 400).
  const accountOptions = useMemo(
    () => accounts.filter((a) => a.is_active && a.code !== OBE_CODE),
    [accounts],
  );
  const obeName = accounts.find((a) => a.code === OBE_CODE)?.name ?? 'Opening Balance Equity';

  // Live balancing preview: net = total debits − total credits, in cents.
  const netCents = useMemo(() => {
    let net = 0;
    for (const l of lines) {
      const d = toCents(l.debit);
      const c = toCents(l.credit);
      if (typeof d === 'number' && !Number.isNaN(d)) net += d;
      if (typeof c === 'number' && !Number.isNaN(c)) net -= c;
    }
    return net;
  }, [lines]);

  const addLine = () => {
    setLines((ls) => [...ls, { key: nextKey, account_code: '', debit: '', credit: '' }]);
    setNextKey((k) => k + 1);
  };
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));
  const patchLine = (key: number, patch: Partial<ObLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const handleProfileSaved = (result: SaveTaxProfileResult) => {
    // chart_reseeded is ABSENT (not false) when the save didn't change the
    // country — truthy check only.
    if (result.chart_reseeded) setChartReseeded(true);
    org.refetch();
    refetchProfile();
    setEditingProfile(false);
    setStep(2);
  };

  // Client-side mirrors of the server rules — the server stays authoritative.
  const validate = (): boolean => {
    let ok = true;
    setDateError(null);
    setLineErrors({});
    setTopError(null);
    if (!booksStartDate) {
      setDateError('books_start_date is required.');
      ok = false;
    } else if (isFutureLocalDate(booksStartDate)) {
      setDateError('books_start_date cannot be in the future.');
      ok = false;
    }
    if (mode === 'opening_balances') {
      if (lines.length === 0) {
        setTopError('Add at least one line.');
        ok = false;
      }
      const errs: Record<number, string> = {};
      lines.forEach((l) => {
        const d = toCents(l.debit);
        const c = toCents(l.credit);
        if (!l.account_code) {
          errs[l.key] = 'Select an account.';
        } else if (Number.isNaN(d) || Number.isNaN(c)) {
          errs[l.key] = 'Amounts must be numbers with up to 2 decimals, e.g. 1234.56.';
        } else {
          // A side counts as used only if its cents value is positive — mirror
          // and payload must agree. A set-but-zero side ("0.00") is an error,
          // not an absent side.
          const hasDebit = d !== null && d > 0;
          const hasCredit = c !== null && c > 0;
          const zeroSet = (d !== null && d === 0) || (c !== null && c === 0);
          if (zeroSet || hasDebit === hasCredit) {
            errs[l.key] = 'Exactly one of debit/credit must be a positive amount.';
          }
        }
      });
      if (Object.keys(errs).length) {
        setLineErrors(errs);
        ok = false;
      }
    }
    return ok;
  };

  // 400 shapes differ: {"detail": str} (service rules), DRF field errors
  // ({"books_start_date": [...]}), or a PostingEngine exc.to_dict() payload,
  // which has NO detail wrapper — surface its message field(s).
  const applyServerError = (data: unknown) => {
    const d = data as Record<string, unknown> | null;
    if (typeof d?.detail === 'string') {
      setTopError(d.detail);
      return;
    }
    if (d && typeof d === 'object') {
      const parts: string[] = [];
      const bsd = d.books_start_date;
      if (bsd) setDateError(Array.isArray(bsd) ? String(bsd[0]) : String(bsd));
      if (d.mode) parts.push(Array.isArray(d.mode) ? String((d.mode as unknown[])[0]) : String(d.mode));
      if (d.lines) parts.push(JSON.stringify(d.lines));
      if (!bsd && !d.mode && !d.lines) {
        parts.push(String(d.message ?? d.error ?? d.code ?? JSON.stringify(d)));
      }
      if (parts.length) setTopError(parts.join(' '));
      return;
    }
    setTopError('Request failed — please try again.');
  };

  const handleObSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mode || !confirmed || submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { mode, books_start_date: booksStartDate };
      if (mode === 'opening_balances') {
        // Client lines ONLY. The 3500 balancing line is server-owned and the
        // preview row below is display-only — it is never sent.
        // A side counts as used only if its cents value is positive — mirror
        // and payload must agree; never key on string emptiness (a "0.00"
        // string is non-empty but is NOT a used side).
        payload.lines = lines.map((l) => {
          const d = toCents(l.debit);
          const c = toCents(l.credit);
          return {
            account_code: l.account_code,
            debit: typeof d === 'number' && !Number.isNaN(d) && d > 0 ? l.debit.trim() : null,
            credit: typeof c === 'number' && !Number.isNaN(c) && c > 0 ? l.credit.trim() : null,
          };
        });
      }
      const res = await api.post('/api/accounting/opening-balance/', payload);
      // Leg 1: the api interceptor RESOLVES non-401 HTTP errors (it returns
      // error.response) and resolves cancellations to null — status-check
      // everything. null = cancelled, ignore silently.
      if (res == null) return;
      if (res.status === 201) {
        setObResult(res.data as ObResult);
        org.refetch();
        setStep(3);
        return;
      }
      if (res.status === 409) {
        // Once-ever latch already set (double submit / second device). Show
        // the detail; the refetch flips step 2 into the recorded state.
        setTopError(
          typeof (res.data as Record<string, unknown>)?.detail === 'string'
            ? String((res.data as Record<string, unknown>).detail)
            : 'Opening-balance choice already recorded.',
        );
        org.refetch();
        return;
      }
      // Leg 2: 400 (service rule / DRF field / PostingEngine dict) and 403.
      applyServerError(res.data);
    } catch (err: unknown) {
      // Leg 3: the interceptor still REJECTS terminal-401s (failed refresh)
      // and network errors — keep a catch so those surface, not explode.
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setTopError(detail ?? 'Request failed — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (org.isLoading || profileLoading || step === null) {
    return <PageLoader />;
  }

  const obRecorded = !!org.openingBalanceChoice;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Set up your books</h1>
          <p className="mt-1 text-sm text-gray-500">
            Three quick steps so the accounting agent can treat every document correctly.
          </p>
        </div>

        {/* Read-only note for non-owners (TaxProfile page treatment) */}
        {!isOwner && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 mb-6">
            Only the account owner can edit these settings. You can view the current setup below.
          </div>
        )}

        <StepIndicator
          current={step}
          taxDone={!!org.hasTaxProfile}
          obDone={obRecorded}
          onGo={(n) => setStep(n)}
        />

        {/* ── STEP 1 — Tax profile ─────────────────────────────────────────── */}
        {step === 1 && (
          <section>
            {org.hasTaxProfile && !editingProfile ? (
              <div className={cardCls}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Tax profile complete</h2>
                    {profile && (
                      <dl className="mt-3 space-y-1.5 text-sm text-gray-600">
                        <div><dt className="inline text-gray-400">Country: </dt><dd className="inline">{profile.country === 'CA' ? 'Canada' : 'United States'}</dd></div>
                        <div><dt className="inline text-gray-400">GST/HST registered: </dt><dd className="inline">{profile.gst_hst_registered ? `Yes${profile.gst_hst_number ? ` (${profile.gst_hst_number})` : ''}` : 'No'}</dd></div>
                        {profile.province && (
                          <div><dt className="inline text-gray-400">Province/State: </dt><dd className="inline">{profile.province}</dd></div>
                        )}
                        <div><dt className="inline text-gray-400">Home currency: </dt><dd className="inline">{profile.home_currency}</dd></div>
                      </dl>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(true)}
                    className="shrink-0 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-5">
                  <button type="button" onClick={() => setStep(2)} className={primaryBtnCls}>
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <TaxProfileForm profile={profile} isOwner={isOwner} onSaved={handleProfileSaved} />
            )}
          </section>
        )}

        {/* ── STEP 2 — Opening balance ─────────────────────────────────────── */}
        {step === 2 && (
          <section className="space-y-4">
            {/* Non-blocking reseed warning from step 1's save */}
            {chartReseeded && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                Your chart of accounts was reseeded for the new country.
              </div>
            )}

            {topError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {topError}
              </div>
            )}

            {obRecorded ? (
              /* Already recorded — once-ever, read-only for everyone. */
              <div className={cardCls}>
                <h2 className="text-base font-semibold text-gray-900">Opening balance recorded</h2>
                <dl className="mt-3 space-y-1.5 text-sm text-gray-600">
                  <div>
                    <dt className="inline text-gray-400">Choice: </dt>
                    <dd className="inline">
                      {org.openingBalanceChoice === 'starting_fresh' ? 'Starting fresh' : 'Opening balances entered'}
                    </dd>
                  </div>
                  {org.booksStartDate && (
                    <div><dt className="inline text-gray-400">Books start date: </dt><dd className="inline">{org.booksStartDate}</dd></div>
                  )}
                </dl>
                <p className="mt-3 text-xs text-gray-400">
                  This choice is recorded once and cannot be changed.
                </p>
                <div className="mt-5">
                  <button type="button" onClick={() => setStep(3)} className={primaryBtnCls}>
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleObSubmit} className={`${cardCls} space-y-5`}>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Opening balance</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Tell us where your books begin. This is recorded once.
                  </p>
                </div>

                {/* Choice cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { value: 'starting_fresh', title: 'Starting fresh', body: 'New business or no prior books — begin at zero from your start date.' },
                    { value: 'opening_balances', title: 'Enter opening balances', body: 'Carry over account balances from your previous bookkeeping.' },
                  ] as { value: ObMode; title: string; body: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!isOwner}
                      onClick={() => setMode(opt.value)}
                      className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        mode === opt.value
                          ? 'border-[#0066FF] ring-1 ring-[#0066FF] bg-blue-50/40'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
                      <p className="mt-1 text-xs text-gray-500">{opt.body}</p>
                    </button>
                  ))}
                </div>

                {mode && (
                  <>
                    {/* books_start_date — required on both paths */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Books start date</label>
                      <input
                        type="date"
                        value={booksStartDate}
                        disabled={!isOwner}
                        onChange={(e) => setBooksStartDate(e.target.value)}
                        className={inputCls}
                      />
                      {dateError && <p className="mt-1 text-xs text-red-600">{dateError}</p>}
                      <p className="mt-1.5 text-xs text-gray-400">
                        {mode === 'starting_fresh'
                          ? 'Nothing can ever be posted before this date.'
                          : 'Your opening-balance entry is posted on this date; everything else must come after it.'}
                      </p>
                    </div>

                    {/* Line rows — opening_balances only */}
                    {mode === 'opening_balances' && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-gray-500">Opening balances by account</p>
                        {lines.map((l) => (
                          <div key={l.key}>
                            <div className="flex gap-2 items-start">
                              <select
                                value={l.account_code}
                                disabled={!isOwner}
                                onChange={(e) => patchLine(l.key, { account_code: e.target.value })}
                                className={`${inputCls} flex-1 min-w-0`}
                              >
                                <option value="">— Select account —</option>
                                {accountOptions.map((a) => (
                                  <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Debit"
                                value={l.debit}
                                disabled={!isOwner}
                                onChange={(e) => patchLine(l.key, { debit: e.target.value })}
                                className={`${inputCls} w-28`}
                              />
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Credit"
                                value={l.credit}
                                disabled={!isOwner}
                                onChange={(e) => patchLine(l.key, { credit: e.target.value })}
                                className={`${inputCls} w-28`}
                              />
                              <button
                                type="button"
                                disabled={!isOwner || lines.length === 1}
                                onClick={() => removeLine(l.key)}
                                className="shrink-0 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Remove line"
                              >
                                ✕
                              </button>
                            </div>
                            {lineErrors[l.key] && (
                              <p className="mt-1 text-xs text-red-600">{lineErrors[l.key]}</p>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          disabled={!isOwner}
                          onClick={addLine}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                        >
                          + Add line
                        </button>

                        {/* Balancing preview — DISPLAY ONLY, never submitted */}
                        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
                          {netCents === 0 ? (
                            <p className="text-gray-600">Entry is balanced — no balancing line needed.</p>
                          ) : (
                            <p className="text-gray-600">
                              <span className="font-medium text-gray-900">
                                {OBE_CODE} — {obeName}
                              </span>{' '}
                              · {netCents > 0 ? 'credit' : 'debit'} {fmtCents(Math.abs(netCents))}
                              <span className="ml-2 inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                                added automatically
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Once-ever confirmation — mirrors the server's 409 latch */}
                    {isOwner && (
                      <>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                          />
                          <span className="text-sm text-gray-700">
                            I understand this choice is recorded once and cannot be changed
                          </span>
                        </label>

                        <div className="pt-1">
                          <button type="submit" disabled={!confirmed || submitting} className={primaryBtnCls}>
                            {submitting && (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            )}
                            {submitting ? 'Recording…' : 'Record opening balance'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </form>
            )}
          </section>
        )}

        {/* ── STEP 3 — Connect a bank (optional) ───────────────────────────── */}
        {step === 3 && (
          <section className="space-y-4">
            {/* Success panel from the 201 — response fields, not local state */}
            {obResult && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4">
                <p className="text-sm font-semibold text-emerald-800">Opening balance recorded</p>
                <dl className="mt-2 space-y-1 text-sm text-emerald-700">
                  <div>
                    <dt className="inline">Choice: </dt>
                    <dd className="inline">
                      {obResult.choice === 'starting_fresh' ? 'Starting fresh' : 'Opening balances entered'}
                    </dd>
                  </div>
                  <div><dt className="inline">Books start date: </dt><dd className="inline">{obResult.books_start_date}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-emerald-700">
                  Nothing can be posted on or before {obResult.locked_through_date}.
                </p>
              </div>
            )}

            <div className={cardCls}>
              <h2 className="text-base font-semibold text-gray-900">Connect a bank (optional)</h2>
              <p className="mt-1 text-sm text-gray-500">
                Connect a chequing, savings, or credit card account and transactions flow into
                your books automatically. You can do this any time.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Link to="/accounting/bank-connections" className={primaryBtnCls}>
                  Go to Bank connections
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Finish
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
