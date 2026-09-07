// Account ledger drill-down (S68 E3, O-S68-30) — the page a coded report row
// links to: one account's POSTED lines over the SAME URL-backed period as the
// report it came from, with opening / totals / closing and a SQL-computed
// running balance (E1 endpoint). Rows expand the shared EntryDrawer (read-only
// here: the owner sees lines + document, never the accountant actions). Own
// data layer (useReports); t2 presentational bits; tokens only, no hex. No new
// headers, no localStorage — everything through the hooks.
import { type FC, Fragment, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { EntryDrawer } from '@/components/ledger/EntryDrawer';
import { type AccountantLedgerRow } from '@/views/accountant/hooks/useAccountantLedger';
import { Spinner } from '@/views/settings/ui';
import api from '@/utils/api';
import { formatIsoDate } from '@/utils/dates';
import { type LedgerLine, type ReportPeriod, useAccountLedger } from '@/hooks/useReports';
import { reportPeriodQueryString, useReportPeriod } from '@/hooks/useReportPeriod';
import { PeriodControls } from './PeriodControls';
import { ExportBar } from './ExportBar';
import { fmtMoney, MONO } from './format';

const PAGE_SIZE = 100;

const fmtDate = (iso: string | null): string =>
  iso === null ? '—' : formatIsoDate(iso);

const humanize = (s: string): string => {
  const t = s.replace(/_/g, ' ').trim();
  return t.length === 0 ? '—' : t.charAt(0).toUpperCase() + t.slice(1);
};

// ─── Entry fetch for the drawer ──────────────────────────────────────────────
// The drawer renders from a full row (JournalEntrySerializer shape). Fetched ON
// CLICK from the org-scoped detail endpoint; mapped onto the drawer's row type.

type EntryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; row: AccountantLedgerRow };

const useEntryDetail = (entryId: string | null): EntryState | null => {
  const [state, setState] = useState<EntryState | null>(null);
  useEffect(() => {
    if (!entryId) { setState(null); return; }
    let cancelled = false;
    setState({ kind: 'loading' });
    api.get(`/api/accounting/entries/${encodeURIComponent(entryId)}/`).then((res) => {
      if (cancelled) return;
      if (res?.status === 200 && res.data) {
        const d = res.data;
        setState({
          kind: 'ready',
          row: {
            id: d.id,
            entry_number_display: d.entry_number_display ?? null,
            entry_date: d.entry_date,
            description: d.description ?? '',
            source: d.source,
            status: d.status,
            created_by: d.created_by,
            voided_at: d.voided_at ?? null,
            voided_by: d.voided_by ?? null,
            void_reason: d.void_reason ?? '',
            source_document_id: d.source_document_id ?? null,
            total_debits: d.total_debits,
            total_credits: d.total_credits,
            lines: (d.lines ?? []).map((l: any) => ({
              id: l.id,
              account_id: l.account_id,
              account_code: l.account_code ?? null,
              account_name: l.account_name ?? null,
              debit: l.debit ?? null,
              credit: l.credit ?? null,
              description: l.description ?? '',
              line_order: l.line_order,
            })),
          },
        });
      } else {
        setState({ kind: 'error', message: res?.data?.detail ?? 'Could not load this entry.' });
      }
    });
    return () => { cancelled = true; };
  }, [entryId]);
  return state;
};

// ─── Page ────────────────────────────────────────────────────────────────────

const Stat: FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
    <div className={`mt-0.5 text-[14px] text-gray-900 ${mono ? MONO : ''}`}>{value}</div>
  </div>
);

const cellCls = 'whitespace-nowrap px-4 py-3 text-gray-700';
const moneyCls = `whitespace-nowrap px-4 py-3 text-right text-gray-900 ${MONO}`;

export const AccountLedgerPage: FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const [period] = useReportPeriod();
  const [params, setParams] = useSearchParams();
  const fromReport = params.get('from_report') === 'balance_sheet' ? 'Balance Sheet' : 'Profit & Loss';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  // Period changes reset the page; both live in the URL (replace, other params kept).
  const setPeriodAndResetPage = (p: ReportPeriod) => {
    const next = new URLSearchParams(params);
    next.set('period', p.period);
    if (p.period === 'custom' && p.date_from && p.date_to) {
      next.set('from', p.date_from);
      next.set('to', p.date_to);
    } else {
      next.delete('from');
      next.delete('to');
    }
    next.delete('page');
    setParams(next, { replace: true });
  };
  const setPage = (n: number) => {
    const next = new URLSearchParams(params);
    if (n <= 1) next.delete('page'); else next.set('page', String(n));
    setParams(next, { replace: true });
  };

  const { data, isLoading, error, status } = useAccountLedger(code, period, page, PAGE_SIZE);

  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const entry = useEntryDetail(openEntryId);
  useEffect(() => { setOpenEntryId(null); }, [code, page, reportPeriodQueryString(period)]);

  const backHref = `/accounting/reports?${reportPeriodQueryString(period)}`;
  const title = data ? `${data.account.code} · ${data.account.name}` : code;

  const lines: LedgerLine[] = data?.lines.results ?? [];
  const count = data?.lines.count ?? 0;
  const first = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = count === 0 ? 0 : first + lines.length - 1;

  return (
    <div className="reports-print min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-none space-y-6 px-6 py-8">
        <nav aria-label="Breadcrumb" className="no-print text-[13px] text-gray-500">
          <Link to={backHref} className="font-medium text-[var(--color-primary)] hover:underline">Reports</Link>
          <span className="mx-1.5 text-gray-300">›</span>
          <Link to={backHref} className="hover:underline">{fromReport}</Link>
          <span className="mx-1.5 text-gray-300">›</span>
          <span className={`text-gray-700 ${MONO}`}>{title}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHeader
            title={title}
            subtitle={data ? `${humanize(data.account.type)} · ${data.period.label}` : 'Account ledger'}
          />
          <PeriodControls period={period} setPeriod={setPeriodAndResetPage} />
        </div>

        {isLoading && (
          <Card padding><div className="flex h-24 items-center justify-center"><Spinner /></div></Card>
        )}

        {!isLoading && status === 404 && (
          <Card padding className="space-y-3">
            <p className="text-[14px] text-gray-700">Account not found.</p>
            <Link to={backHref} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">← Back to Reports</Link>
          </Card>
        )}

        {!isLoading && error && status !== 404 && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {!isLoading && data && !error && (
          <>
            <Card padding>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">Summary</span>
                <ExportBar kind="account" code={data.account.code} period={period} />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                <Stat label="Account" value={`${data.account.code} · ${data.account.name}`} mono={false} />
                <Stat
                  label="Period"
                  value={`${fmtDate(data.period.start)} → ${fmtDate(data.period.end)}`}
                  mono={false}
                />
                <Stat label="Opening balance" value={data.opening_balance === null ? '—' : fmtMoney(data.opening_balance)} />
                <Stat label="Total debits" value={fmtMoney(data.total_debits)} />
                <Stat label="Total credits" value={fmtMoney(data.total_credits)} />
                <Stat label="Net change" value={fmtMoney(data.net_change)} />
                <Stat label="Closing balance" value={fmtMoney(data.closing_balance)} />
              </div>
            </Card>

            <Card>
              {lines.length === 0 ? (
                <div className="px-6 py-10 text-center text-[13px] text-gray-400">
                  No posted transactions in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed min-w-[64rem] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        <th className="w-28 px-4 py-2 text-left">Date</th>
                        <th className="w-20 px-4 py-2 text-left">Entry</th>
                        {/* Description carries no width: table-fixed gives it
                            every remaining pixel as the page widens (O-S69-13). */}
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="w-44 px-4 py-2 text-left">Counterparty</th>
                        <th className="w-40 px-4 py-2 text-left">Source</th>
                        <th className="w-32 px-4 py-2 text-right">Debit</th>
                        <th className="w-32 px-4 py-2 text-right">Credit</th>
                        <th className="w-32 px-4 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lines.map((l, i) => {
                        const open = openEntryId === l.entry_id;
                        return (
                          <Fragment key={`${l.entry_id}-${i}`}>
                            <tr
                              className={`cursor-pointer transition-colors hover:bg-gray-50 ${open ? 'bg-gray-50' : ''}`}
                              onClick={() => setOpenEntryId(open ? null : l.entry_id)}
                            >
                              <td className={cellCls}>{formatIsoDate(l.entry_date)}</td>
                              <td className={`${cellCls} ${MONO}`}>{l.entry_number != null ? `#${l.entry_number}` : '—'}</td>
                              <td className="truncate px-4 py-3 text-gray-700" title={l.description}>{l.description || '—'}</td>
                              <td className={`${cellCls} truncate`} title={l.counterparty?.name ?? '—'}>{l.counterparty?.name ?? '—'}</td>
                              <td className={`${cellCls} truncate`} title={humanize(l.source)}>{humanize(l.source)}</td>
                              <td className={moneyCls}>{fmtMoney(l.debit)}</td>
                              <td className={moneyCls}>{fmtMoney(l.credit)}</td>
                              <td className={`${moneyCls} font-semibold`}>{fmtMoney(l.running_balance)}</td>
                            </tr>
                            {open && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  {entry?.kind === 'loading' && (
                                    <div className="flex h-16 items-center justify-center bg-gray-50"><Spinner /></div>
                                  )}
                                  {entry?.kind === 'error' && (
                                    <div className="bg-gray-50 px-5 py-3 text-[13px] text-red-600">{entry.message}</div>
                                  )}
                                  {entry?.kind === 'ready' && (
                                    <EntryDrawer
                                      row={entry.row}
                                      readOnly
                                      adjustOpen={false}
                                      onToggleAdjust={() => undefined}
                                      onPosted={() => undefined}
                                    />
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {count > 0 && (
                <div className="no-print flex items-center justify-between border-t border-gray-100 px-4 py-3 text-[13px] text-gray-500">
                  <span>{first}–{last} of {count}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!data.lines.previous}
                      onClick={() => setPage(page - 1)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={!data.lines.next}
                      onClick={() => setPage(page + 1)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </Card>

            <Link to={backHref} className="no-print inline-block text-[13px] font-medium text-[var(--color-primary)] hover:underline">
              ← Back to Reports
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
