// Account ledger drill-down (S68 E3, O-S68-30) — the page a coded report row
// links to: one account's POSTED lines over the SAME URL-backed period as the
// report it came from, with opening / totals / closing and a SQL-computed
// running balance (E1 endpoint). Rows expand the shared EntryDrawer (read-only
// here: the owner sees lines + document, never the accountant actions). Own
// data layer (useReports); t2 presentational bits; tokens only, no hex. No new
// headers, no localStorage — everything through the hooks.
//
// S69 E5-UI (O-S69-15): the summary card and the lines table are the shared
// LedgerSummaryStrip / LedgerTable components; this page is the thin owner
// composition — hooks, URL period/page state, breadcrumb and page chrome.
import { type FC, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { LedgerSummaryStrip } from '@/components/ledger/LedgerSummaryStrip';
import { type EntryState, LedgerTable, humanize } from '@/components/ledger/LedgerTable';
import { Spinner } from '@/views/settings/ui';
import api from '@/utils/api';
import { type LedgerLine, type ReportPeriod, useAccountLedger } from '@/hooks/useReports';
import { reportPeriodQueryString, useReportPeriod } from '@/hooks/useReportPeriod';
import { PeriodControls } from './PeriodControls';
import { ExportBar } from './ExportBar';
import { MONO } from './format';

const PAGE_SIZE = 100;

// ─── Entry fetch for the drawer ──────────────────────────────────────────────
// The drawer renders from a full row (JournalEntrySerializer shape). Fetched ON
// CLICK from the org-scoped detail endpoint; mapped onto the drawer's row type.

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
            <LedgerSummaryStrip
              data={data}
              exportSlot={<ExportBar kind="account" code={data.account.code} period={period} />}
            />

            <LedgerTable
              lines={lines}
              expandedId={openEntryId}
              onRowToggle={setOpenEntryId}
              entry={entry}
              readOnly
              count={count}
              first={first}
              last={last}
              hasPrevious={!!data.lines.previous}
              hasNext={!!data.lines.next}
              onPrevious={() => setPage(page - 1)}
              onNext={() => setPage(page + 1)}
            />

            <Link to={backHref} className="no-print inline-block text-[13px] font-medium text-[var(--color-primary)] hover:underline">
              ← Back to Reports
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
