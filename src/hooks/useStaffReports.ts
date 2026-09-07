// useStaffReports (S69 E5-UI / E8, O-S69-9 / O-S69-15) — the internal-staff
// data layer for a client's reports. Every call is org-ADDRESSED under
// /api/accounting/staff/orgs/<orgId>/reports/… (backend E5, O-S69-3): the staff
// gate resolves the org from the PATH, never from X-Org-Id — the api client's
// header injection is left as is and the staff lane never reads it. No
// impersonation: these are the staff endpoints, audited per read.
//
// Own hooks in the useStaffResolution.ts style (same api client, same
// cancelled-flag + status-check + `detail`-verbatim contract). No owner hook
// gains a staff branch — the owner response TYPES are reused because the staff
// payloads are byte-identical (O-S69-4), and the owner period helpers
// (periodToParams) are reused because the query params are the same.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import {
  type AccountLedger,
  type BalanceSheetPayload,
  type PnlPayload,
  type ReportPeriod,
  type ReportResource,
  periodToParams,
  periodToQuery,
} from '@/hooks/useReports';
import { type ExportUrlBuilder, KIND_PATH } from '@/hooks/useReportExport';
import { type EntryState } from '@/components/ledger/LedgerTable';

const STAFF_ORG = (orgId: string) => `/api/accounting/staff/orgs/${encodeURIComponent(orgId)}`;

// One GET → ReportResource<T>, the useReports interceptor contract: null = the
// request was cancelled, 200 = trust the body, any other status = a resolved
// error response whose `detail` is surfaced; a terminal 401 rejects and is
// caught. `status` lets a page tell a 404 from anything else.
function useStaffResource<T>(
  url: string,
  params: Record<string, string> | undefined,
  deps: unknown[],
): ReportResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setStatus(null);

    api.get(url, params ? { params } : undefined)
      .then((res) => {
        if (cancelled || res == null) return;
        setStatus(res.status ?? null);
        if (res.status === 200) {
          setData(res.data as T);
        } else {
          setData(null);
          setError(res.data?.detail ?? 'Failed to load report');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus(err?.response?.status ?? null);
          setError(err?.response?.data?.detail ?? 'Failed to load report');
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);

  return { data, isLoading, error, status, refetch };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export const useStaffPnl = (orgId: string, p: ReportPeriod): ReportResource<PnlPayload> =>
  useStaffResource<PnlPayload>(
    `${STAFF_ORG(orgId)}/reports/pnl/`, periodToParams(p), [orgId, periodToQuery(p)],
  );

export const useStaffBalanceSheet = (
  orgId: string, p: ReportPeriod,
): ReportResource<BalanceSheetPayload> =>
  useStaffResource<BalanceSheetPayload>(
    `${STAFF_ORG(orgId)}/reports/balance-sheet/`, periodToParams(p), [orgId, periodToQuery(p)],
  );

// Same query params the owner hook sends (useReports.useAccountLedger).
export const useStaffAccountLedger = (
  orgId: string, code: string, p: ReportPeriod, page: number, pageSize = 100,
): ReportResource<AccountLedger> =>
  useStaffResource<AccountLedger>(
    `${STAFF_ORG(orgId)}/reports/account/${encodeURIComponent(code)}/ledger/`,
    { ...periodToParams(p), page: String(page), page_size: String(pageSize) },
    [orgId, code, periodToQuery(p), page, pageSize],
  );

// ─── Export URL builder (ExportBar exportUrl prop, fence 1) ──────────────────
// Returns the PATH only; useReportExport appends the same format/period query
// and does the blob download — nothing re-implemented here.

export const staffExportUrl = (orgId: string): ExportUrlBuilder => (kind, code) =>
  kind === 'account'
    ? `${STAFF_ORG(orgId)}/reports/account/${encodeURIComponent(code ?? '')}/export/`
    : `${STAFF_ORG(orgId)}/reports/${KIND_PATH[kind]}/export/`;

// ─── Entry detail for the drawer (F-S69-5) ───────────────────────────────────
// GET /api/accounting/staff/entries/<id>/ serializes the SAME
// JournalEntrySerializer as the owner detail, so the mapping onto the drawer's
// row type is the owner page's mapping, unchanged.

export const useStaffEntryDetail = (entryId: string | null): EntryState | null => {
  const [state, setState] = useState<EntryState | null>(null);
  useEffect(() => {
    if (!entryId) { setState(null); return; }
    let cancelled = false;
    setState({ kind: 'loading' });
    api.get(`/api/accounting/staff/entries/${encodeURIComponent(entryId)}/`).then((res) => {
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
