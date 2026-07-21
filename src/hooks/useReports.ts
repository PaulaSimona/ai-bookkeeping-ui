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

export type PnlPeriodKind = 'ytd' | 'quarter';

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

export const usePnl = (period: PnlPeriodKind): ReportResource<PnlPayload> =>
  useReportResource<PnlPayload>('/api/accounting/reports/pnl/', { period }, [period]);

export const useBalanceSheet = (): ReportResource<BalanceSheetPayload> =>
  useReportResource<BalanceSheetPayload>('/api/accounting/reports/balance-sheet/', undefined, []);

export const useTaxSummary = (): ReportResource<TaxSummaryPayload> =>
  useReportResource<TaxSummaryPayload>('/api/accounting/reports/taxes/', undefined, []);
