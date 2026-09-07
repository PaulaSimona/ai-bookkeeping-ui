// useReportExport (S68 E4, O-S68-31) — download a report export (PDF / XLSX)
// through the shared api client. The backend export endpoints return the file
// BYTES with an attachment Content-Disposition (E2); auth is the Bearer header
// + X-Org-Id the interceptor injects, so the file is fetched as a blob and
// handed to the browser via a temporary object URL — NEVER an <a href> to the
// API and never a token in a URL. Same blob mechanics as useInvoicePdf (S41),
// which stays untouched (invoice-specific, opens a tab instead of saving).
import { useCallback, useState } from 'react';
import api from '@/utils/api';
import { periodToQuery, type ReportPeriod } from '@/hooks/useReports';

export type ExportKind = 'pnl' | 'balance_sheet' | 'taxes' | 'account';
export type ExportFormat = 'pdf' | 'xlsx';

export type ExportResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

// URL segment per kind (the backend's <kind> route uses hyphenated names).
const KIND_PATH: Record<Exclude<ExportKind, 'account'>, string> = {
  pnl: 'pnl',
  balance_sheet: 'balance-sheet',
  taxes: 'taxes',
};

export type ExportUrlBuilder = (kind: ExportKind, code?: string) => string;

// Default (owner-lane) export endpoint. A caller may pass its own builder
// (S69 E5-UI, O-S69-15) — e.g. the staff lane's staff/orgs/<id>/reports/… —
// but the query string, blob handling and filename logic below are shared.
const exportUrl: ExportUrlBuilder = (kind, code) =>
  kind === 'account'
    ? `/api/accounting/reports/account/${encodeURIComponent(code ?? '')}/export/`
    : `/api/accounting/reports/${KIND_PATH[kind]}/export/`;

const exportQuery = (kind: ExportKind, fmt: ExportFormat, period: ReportPeriod): string =>
  // Taxes follow the filing period — no period param.
  kind === 'taxes' ? `format=${fmt}` : `format=${fmt}&${periodToQuery(period)}`;

/** filename="…" from a Content-Disposition header, else the fallback. */
export const filenameFromDisposition = (header: string | undefined | null, fallback: string): string => {
  if (!header) return fallback;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return m?.[1] ? decodeURIComponent(m[1]) : fallback;
};

const readBlobDetail = async (data: unknown, fallback: string): Promise<string> => {
  try {
    if (data instanceof Blob) {
      const parsed = JSON.parse(await data.text());
      if (typeof parsed?.detail === 'string') return parsed.detail;
    }
  } catch { /* keep fallback */ }
  return fallback;
};

const errorMessage = async (status: number, data: unknown): Promise<string> => {
  if (status === 413) return 'This export is too large. Narrow the period and try again.';
  if (status === 429) return 'Too many exports — please wait a minute.';
  if (status === 403) return 'You do not have access to this report.';
  if (status === 404) return 'Account not found.';
  return readBlobDetail(data, 'The export could not be generated. Please try again.');
};

export async function downloadReportExport(
  kind: ExportKind, fmt: ExportFormat, period: ReportPeriod, code?: string,
  urlFor: ExportUrlBuilder = exportUrl,
): Promise<ExportResult> {
  const url = `${urlFor(kind, code)}?${exportQuery(kind, fmt, period)}`;
  const res = await api.get(url, { responseType: 'blob' } as any);
  if (res == null) {
    return { ok: false, status: 0, message: 'The export could not be generated. Please try again.' };
  }
  if (res.status !== 200) {
    return { ok: false, status: res.status, message: await errorMessage(res.status, res.data) };
  }
  const fallback = `${kind === 'account' && code ? `account_${code}` : kind}.${fmt}`;
  const headerStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const filename = filenameFromDisposition(headerStr(res.headers?.['content-disposition']), fallback);
  const blob = new Blob([res.data], {
    type: headerStr(res.headers?.['content-type']) || 'application/octet-stream',
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke once the click has been handed to the browser's download manager.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return { ok: true };
}

export const useReportExport = () => {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const exportReport = useCallback(async (
    kind: ExportKind, fmt: ExportFormat, period: ReportPeriod, code?: string,
    urlFor?: ExportUrlBuilder,
  ): Promise<ExportResult> => {
    setBusy(fmt);
    try {
      return await downloadReportExport(kind, fmt, period, code, urlFor);
    } finally {
      setBusy(null);
    }
  }, []);

  return { exportReport, busy };
};
