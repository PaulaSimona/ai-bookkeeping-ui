// useAccountantLedger (Session-25 Phase E, U2) — the accountant Ledger's OWN
// data layer. Reads the shared ledger list endpoint (/api/accounting/entries/)
// but is a standalone hook: it does NOT import the owner's useLedgerEntries. It
// follows the usePaginatedList envelope + api-interceptor contract (res == null =
// cancelled; res.status === 200 = trust the body; any other status = a resolved
// error whose `detail` surfaces). Money arrives as two-decimal STRINGS — display
// only, never arithmetic. Defaults to POSTED entries (the register is the
// already-clean book the accountant adjusts).
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

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
  line_order: number;
}

export interface AccountantLedgerRow {
  id: string;
  entry_number_display: string | null;
  entry_date: string;
  description: string;
  source: string;
  status: string;
  // The real originating Tier-1 Document pk (O-S25-5) — integer, nullable.
  // Present only for document-derived entries; drives the drawer's "View
  // document" action. The list already embeds this (no extra fetch).
  source_document_id: number | null;
  total_debits: string;
  total_credits: string;
  lines: AccountantLedgerLine[];
}

interface Envelope {
  count: number;
  next: string | null;
  previous: string | null;
  results: AccountantLedgerRow[];
}

const PAGE_SIZE = 50;

export const useAccountantLedger = () => {
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

    api.get('/api/accounting/entries/', {
      params: { status: 'posted', page, page_size: PAGE_SIZE },
    })
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
  }, [page, revision]);

  return { items, count, page, setPage, pageSize: PAGE_SIZE, isLoading, error, refetch };
};
