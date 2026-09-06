// useReports (§14 14-C-3 B5) — data layer for the Tier 2 report endpoints
// (seams 31/32/33). SEPARATE data layer per the §14 guardrail: these hooks are
// dedicated to the report reads and never reuse a Tier 1 hook. They follow the
// same api-util interceptor contract as useCounterpartyBalances: null = the
// request was cancelled, res.status === 200 = trust the body, any other status =
// a resolved error response whose `detail` is surfaced; a terminal 401 rejects
// and is caught. Money arrives as two-decimal STRINGS and dates as ISO — the
// pages format for display, never doing arithmetic on the money strings.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

export type PnlPeriodKind = 'ytd' | 'quarter' | 'month' | 'custom';

// ─── Report period (S68 E3, O-S68-29) ────────────────────────────────────────
// The ONE shape every report read and every drill-down link carries. The
// backend resolver (reports.resolve_report_window) validates again server-side.
export type ReportPeriod = {
  period: PnlPeriodKind;
  date_from?: string; // YYYY-MM-DD, custom only
  date_to?: string;   // YYYY-MM-DD, custom only
};

export const DEFAULT_REPORT_PERIOD: ReportPeriod = { period: 'ytd' };

/** API query params for a period — custom carries date_from/date_to, others only period. */
export const periodToParams = (p: ReportPeriod): Record<string, string> =>
  p.period === 'custom' && p.date_from && p.date_to
    ? { period: 'custom', date_from: p.date_from, date_to: p.date_to }
    : { period: p.period };

/** The same params as a query string (no leading '?'). */
export const periodToQuery = (p: ReportPeriod): string =>
  new URLSearchParams(periodToParams(p)).toString();

export interface ReportRow {
  code: string | null; // null for the computed Current-year-earnings equity line
  name: string;
  amount: string;
}

export interface ReportSection {
  rows: ReportRow[];
  total: string;
}

export interface PnlPeriod {
  kind: PnlPeriodKind;
  label: string;
  start: string | null;
  end: string | null;
}

export interface PnlPayload {
  period: PnlPeriod;
  revenue: ReportSection;
  expenses: ReportSection;
  net: string;
}

export interface BalanceSheetPayload {
  as_of: string | null;
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  balances: boolean;
}

export interface FilingPeriod {
  frequency: string;
  period_start: string | null;
  period_end: string | null;
  period_label: string;
  deadline: string | null;
}

export interface TaxSummaryRegistered {
  registered: true;
  period: FilingPeriod | null;
  range: { start: string | null; end: string | null };
  collected: string;
  itc: string;
  net: string;
}

export interface TaxSummaryUnregistered {
  registered: false;
}

export type TaxSummaryPayload = TaxSummaryRegistered | TaxSummaryUnregistered;

export interface ReportResource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Shared read: one GET, the useCounterpartyBalances interceptor contract.
function useReportResource<T>(
  url: string,
  params: Record<string, string> | undefined,
  deps: unknown[],
): ReportResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api.get(url, params ? { params } : undefined)
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) {
          setData(res.data as T);
        } else {
          setData(null);
          setError(res.data?.detail ?? 'Failed to load report');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load report');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);

  return { data, isLoading, error, refetch };
}

export const usePnl = (p: ReportPeriod): ReportResource<PnlPayload> =>
  useReportResource<PnlPayload>(
    '/api/accounting/reports/pnl/', periodToParams(p), [periodToQuery(p)],
  );

// The balance sheet takes the same params; the backend resolves as_of =
// min(window end, today) (E1, O-S68-22).
export const useBalanceSheet = (p: ReportPeriod): ReportResource<BalanceSheetPayload> =>
  useReportResource<BalanceSheetPayload>(
    '/api/accounting/reports/balance-sheet/', periodToParams(p), [periodToQuery(p)],
  );

// Taxes follow the filing period — no period param (unchanged).
export const useTaxSummary = (): ReportResource<TaxSummaryPayload> =>
  useReportResource<TaxSummaryPayload>('/api/accounting/reports/taxes/', undefined, []);

// ─── Account ledger drill-down (E1 endpoint, O-S68-23 / O-S68-30) ─────────────

export interface LedgerLine {
  entry_id: string;
  entry_number: number | null;
  entry_date: string; // YYYY-MM-DD — format with formatIsoDate, never new Date()
  description: string;
  counterparty: { id: string; name: string } | null;
  source: string;
  source_document_id: number | null;
  debit: string | null;
  credit: string | null;
  running_balance: string;
}

export interface AccountLedger {
  account: { code: string; name: string; type: string; normal_balance: string };
  period: { kind: PnlPeriodKind; label: string; start: string | null; end: string | null };
  opening_balance: string | null;
  total_debits: string;
  total_credits: string;
  net_change: string;
  closing_balance: string;
  lines: { count: number; next: string | null; previous: string | null; results: LedgerLine[] };
}

export const useAccountLedger = (
  code: string, p: ReportPeriod, page: number, pageSize = 100,
): ReportResource<AccountLedger> =>
  useReportResource<AccountLedger>(
    `/api/accounting/reports/account/${encodeURIComponent(code)}/ledger/`,
    { ...periodToParams(p), page: String(page), page_size: String(pageSize) },
    [code, periodToQuery(p), page, pageSize],
  );
