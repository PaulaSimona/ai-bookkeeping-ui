// useAccountantLedger (Session-25 Phase E, U2) — the accountant Ledger's OWN
// data layer. Reads the shared ledger list endpoint (/api/accounting/entries/)
// but is a standalone hook: it does NOT import the owner's useLedgerEntries. It
// follows the usePaginatedList envelope + api-interceptor contract (res == null =
// cancelled; res.status === 200 = trust the body; any other status = a resolved
// error whose `detail` surfaces). Money arrives as two-decimal STRINGS — display
// only, never arithmetic. The list is POSTED entries only (the register is the
// already-clean book the accountant adjusts); an optional registry status
// narrows it (D-S84-4).
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { type RegistryFields } from '@/utils/entryStatus';

export interface AccountantLedgerLine {
  id: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit: string | null;
  credit: string | null;
  // Per-line memo (backend JournalLineSerializer.description). Optional here —
  // the drill-down shows it when present, but never depends on it.
  description?: string;
  // Per-line tax code (JournalLineSerializer.tax_code). A staff correction
  // carries it onto the corrected line (D-S85-17).
  tax_code?: string;
  line_order: number;
  // The id of the line this one REVERSES, or null (S84 CW7, D-S85-18). Set on
  // the reversing half of a one-entry correction and on every line of a
  // reversal entry. Read-only: never sent back.
  reverses_line_id: string | null;
}

// The registry fields (display_status, corrected_by, live_entry, chain_root,
// chain, chain_truncated — S84 CW5) come from RegistryFields.
export interface AccountantLedgerRow extends RegistryFields {
  id: string;
  // Present on every list row and detail read; optional so older fixtures
  // type-check.
  entry_number?: number | null;
  entry_number_display: string | null;
  entry_date: string;
  description: string;
  source: string;
  status: string;
  // Author UUID (the drafting/posting user). Backend already serializes
  // created_by on the entry field set — TS-only addition (O-S26-2). Drives the
  // drawer's author-gated Void affordance (mirrors the backend author-equality
  // fence; the backend remains authoritative).
  created_by: string;
  // Void provenance (W-S25-6) — null/empty on non-voided rows; the backend
  // serializes these on the entry field set. Shown in the drawer's voided state.
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string;
  // The real originating Tier-1 Document pk (O-S25-5) — integer, nullable.
  // Present only for document-derived entries; drives the drawer's "View
  // document" action. The list already embeds this (no extra fetch).
  source_document_id: number | null;
  total_debits: string;
  total_credits: string;
  lines: AccountantLedgerLine[];
  // F-S71-2 / O-S73-2: reversal + correction linkage (same six fields as
  // LedgerEntryRow — the backend serializes them on the accountant and staff
  // detail lanes too). UUID-string ids; "JE-nnnn" display twins (O-S73-1).
  reverses_entry_id?: string | null;
  reversed_by_entry_id?: string | null;
  corrects_entry_id?: string | null;
  reverses_entry_number_display?: string | null;
  reversed_by_entry_number_display?: string | null;
  corrects_entry_number_display?: string | null;
  // {id, name} when attributed, null otherwise (JournalEntrySerializer).
  counterparty?: { id: string; name: string } | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// One entry as the API sends it (the registry serializer on a detail read, or
// a list row) mapped onto the row the shared drawer renders. The ONE mapper for
// the owner and the staff detail reads, so neither can drop a field the other
// keeps — the six registry fields included.
export const toLedgerRow = (d: any): AccountantLedgerRow => ({
  id: d.id,
  entry_number: d.entry_number ?? null,
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
  counterparty: d.counterparty ?? null,
  // F-S71-2 / O-S71-6: reversal + correction linkage (UUID-string ids and
  // their "JE-nnnn" display twins, O-S73-1).
  reverses_entry_id: d.reverses_entry_id ?? null,
  reversed_by_entry_id: d.reversed_by_entry_id ?? null,
  corrects_entry_id: d.corrects_entry_id ?? null,
  reverses_entry_number_display: d.reverses_entry_number_display ?? null,
  reversed_by_entry_number_display: d.reversed_by_entry_number_display ?? null,
  corrects_entry_number_display: d.corrects_entry_number_display ?? null,
  // S84 CW5: where the entry stands in its chain. Passed through as sent —
  // absent stays absent, so a payload without them is never read as live.
  display_status: d.display_status,
  corrected_by: d.corrected_by,
  live_entry: d.live_entry,
  chain_root: d.chain_root,
  chain: d.chain,
  chain_truncated: d.chain_truncated,
  lines: (d.lines ?? []).map((l: any) => ({
    id: l.id,
    account_id: l.account_id,
    account_code: l.account_code ?? null,
    account_name: l.account_name ?? null,
    debit: l.debit ?? null,
    credit: l.credit ?? null,
    description: l.description ?? '',
    tax_code: l.tax_code ?? '',
    line_order: l.line_order,
    // Passed through as sent — NOT defaulted to null: a read that lacks the
    // field must not make a reversing line look like the entry's own.
    reverses_line_id: l.reverses_line_id,
  })),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── One entry by id ───────────────────────────────────────────────────────────
// GET /api/accounting/entries/<id>/ — the org-scoped detail read the owner and
// the accountant share (X-Org-Id). It answers with the same registry payload a
// list row carries, so the result goes through the one mapper. Used by the
// account-ledger drill-down (the drawer opens on a ledger LINE, which is not an
// entry) and by "Open JE-xxxx" in a chain panel, which re-targets a panel to
// another entry of the chain.
export type EntryDetailState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; row: AccountantLedgerRow };

export const useEntryDetail = (
  entryId: string | null,
): { entry: EntryDetailState | null; refetch: () => void } => {
  const [state, setState] = useState<EntryDetailState | null>(null);
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!entryId) { setState(null); return; }
    let cancelled = false;
    setState({ kind: 'loading' });
    api.get(`/api/accounting/entries/${encodeURIComponent(entryId)}/`)
      .then((res) => {
        if (cancelled) return;
        if (res?.status === 200 && res.data) {
          setState({ kind: 'ready', row: toLedgerRow(res.data) });
        } else {
          setState({ kind: 'error', message: res?.data?.detail ?? 'Could not load this entry.' });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error', message: 'Could not load this entry.' });
      });
    return () => { cancelled = true; };
  }, [entryId, revision]);

  return { entry: state, refetch };
};

interface Envelope {
  count: number;
  next: string | null;
  previous: string | null;
  results: AccountantLedgerRow[];
}

const PAGE_SIZE = 50;

// `status` is one of the shared registry filter values (entryStatus
// REGISTRY_STATUS_OPTIONS); '' is "Posted", the endpoint's default.
export const useAccountantLedger = (status = '') => {
  const [items, setItems] = useState<AccountantLedgerRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // The only filter sent is ?status=, and only when one is chosen: the list
    // is posted entries by default, so "Posted" sends nothing. No other filter
    // param goes out — a voided entry is never listed (D-S85-16).
    const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
    if (status) params.status = status;

    api.get('/api/accounting/entries/', { params })
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) {
          const data = res.data as Envelope | null;
          setItems(Array.isArray(data?.results) ? data.results : []);
          setCount(typeof data?.count === 'number' ? data.count : 0);
        } else {
          setItems([]);
          setCount(0);
          setError(res.data?.detail ?? 'Failed to load the ledger.');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load the ledger.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [page, revision, status]);

  return { items, count, page, setPage, pageSize: PAGE_SIZE, isLoading, error, refetch };
};
