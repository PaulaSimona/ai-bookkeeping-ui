// useAccountantReports (Session-25 Phase E, U3) — the accountant Reports page's
// OWN read of the aggregate report endpoints (seams 31/32/33). A dedicated data
// layer per the §14 role-surface separation: it does NOT import the owner's
// useReports. Money arrives as two-decimal STRINGS, dates as ISO (null → null);
// the page formats for display only. api-interceptor contract: res == null =
// cancelled; res.status === 200 = trust the body; else a resolved error's
// `detail` surfaces.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

export type PnlPeriodKind = 'ytd' | 'quarter';

export interface ReportRow {
  code: string | null;
  name: string;
  amount: string;
}
export interface ReportSection {
  rows: ReportRow[];
  total: string;
}
export interface PnlPayload {
  period: { kind: PnlPeriodKind; label: string; start: string | null; end: string | null };
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
export type TaxPayload =
  | { registered: false }
  | {
      registered: true;
      period: FilingPeriod | null;
      range: { start: string | null; end: string | null };
      collected: string;
      itc: string;
      net: string;
    };

export interface ReportResource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

function useResource<T>(
  url: string,
  params: Record<string, string> | undefined,
  deps: unknown[],
): ReportResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable stringified params key so inline literals don't retrigger every render.
  const paramsKey = JSON.stringify(params ?? {});
  const load = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get(url, params ? { params } : undefined)
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) setData(res.data as T);
        else { setData(null); setError(res.data?.detail ?? 'Failed to load report.'); }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load report.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey]);

  useEffect(load, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading, error };
}

export const useAccountantPnl = (period: PnlPeriodKind) =>
  useResource<PnlPayload>('/api/accounting/reports/pnl/', { period }, [period]);

export const useAccountantBalanceSheet = () =>
  useResource<BalanceSheetPayload>('/api/accounting/reports/balance-sheet/', undefined, []);

export const useAccountantTax = () =>
  useResource<TaxPayload>('/api/accounting/reports/taxes/', undefined, []);
