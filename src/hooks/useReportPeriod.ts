// useReportPeriod (S68 E3, O-S68-29) — the report period lives in the URL
// (?period=ytd|quarter|month|custom[&from=YYYY-MM-DD&to=YYYY-MM-DD]) so a
// report, its drill-down and a shared link all agree on the window. Custom is
// validated client-side exactly as the backend resolver does (both bounds,
// from <= to, span <= 366 days); anything invalid falls back to ytd so no
// request is ever sent with a half-formed window. The setter writes with
// { replace: true } and preserves every other query param. No localStorage.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseIsoDate } from '@/utils/dates';
import {
  DEFAULT_REPORT_PERIOD,
  type PnlPeriodKind,
  type ReportPeriod,
} from '@/hooks/useReports';

const KINDS: readonly PnlPeriodKind[] = ['ytd', 'quarter', 'month', 'custom'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const CUSTOM_MAX_DAYS = 366;

const isKind = (v: string | null): v is PnlPeriodKind =>
  v !== null && (KINDS as readonly string[]).includes(v);

/** null when the custom bounds are valid, else the reason (for inline UI text). */
export function customRangeError(from: string | undefined, to: string | undefined): string | null {
  if (!from || !to) return 'Choose both a start and an end date.';
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return 'Dates must be YYYY-MM-DD.';
  let start: Date;
  let end: Date;
  try {
    start = parseIsoDate(from);
    end = parseIsoDate(to);
  } catch {
    return 'Dates must be YYYY-MM-DD.';
  }
  if (start > end) return 'The start date must be on or before the end date.';
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days > CUSTOM_MAX_DAYS) return `A custom range may span at most ${CUSTOM_MAX_DAYS} days.`;
  return null;
}

/** Parse ?period/?from/?to from a URLSearchParams; invalid → ytd. */
export function parseReportPeriod(params: URLSearchParams): ReportPeriod {
  const kind = params.get('period');
  if (!isKind(kind)) return DEFAULT_REPORT_PERIOD;
  if (kind !== 'custom') return { period: kind };
  const from = params.get('from') ?? undefined;
  const to = params.get('to') ?? undefined;
  if (customRangeError(from, to) !== null) return DEFAULT_REPORT_PERIOD;
  return { period: 'custom', date_from: from, date_to: to };
}

/** UI query string for links (uses from/to; the API hooks translate to date_from/date_to). */
export function reportPeriodQueryString(p: ReportPeriod): string {
  const q = new URLSearchParams({ period: p.period });
  if (p.period === 'custom' && p.date_from && p.date_to) {
    q.set('from', p.date_from);
    q.set('to', p.date_to);
  }
  return q.toString();
}

export function useReportPeriod(): [ReportPeriod, (p: ReportPeriod) => void] {
  const [params, setParams] = useSearchParams();
  const period = useMemo(() => parseReportPeriod(params), [params]);

  const setPeriod = useCallback((p: ReportPeriod) => {
    const next = new URLSearchParams(params);
    next.set('period', p.period);
    if (p.period === 'custom' && p.date_from && p.date_to) {
      next.set('from', p.date_from);
      next.set('to', p.date_to);
    } else {
      next.delete('from');
      next.delete('to');
    }
    setParams(next, { replace: true });
  }, [params, setParams]);

  return [period, setPeriod];
}
