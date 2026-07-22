// useCounterpartyBalances (§14 14-C-2b, D-14C2-5/-20; rewired 14-C-4 U3) — reads
// GET /api/accounting/counterparties/balances/ with EXPLICIT params per tab
// (role, archived, search, page, page_size) and surfaces the standard
// AccountingPagination envelope PLUS the top-level `summary`, so it does NOT
// reuse usePaginatedList (which drops the summary). Post-C4 every row carries the
// counterparty's identity/display fields (contact_name/email/city/payment_terms)
// alongside balance + aging, so this hook is now the SOLE data source for the
// Clients/Suppliers table — the old CRUD-list + balMap id-join is retired.
// Follows usePaginatedList's three-leg interceptor contract (null = cancelled,
// 200 = trust, else a resolved error body). The caller resets page to 1 on tab
// change and on the (debounced) search settling.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import type { CounterpartyRole } from '@/hooks/useCounterparties';

const DEFAULT_PAGE_SIZE = 50; // the table pages at 50; the C4 server clamps at 200.

export interface AgingBuckets {
  current: string;
  d31_60: string;
  d61_90: string;
  d90_plus: string;
}

export interface CounterpartyBalanceRow {
  id: string;
  name: string;
  archived: boolean;
  // Identity/display fields (C4) — the table's sole source, no CRUD join.
  contact_name: string;
  email: string;
  city: string;
  payment_terms: string;
  balance: string;
  aging: AgingBuckets;
  entry_count: number;
  last_activity: string | null;
}

export interface BalancesSummary {
  balance: string;
  aging: AgingBuckets;
}

const EMPTY_AGING: AgingBuckets = {
  current: '0.00', d31_60: '0.00', d61_90: '0.00', d90_plus: '0.00',
};
const EMPTY_SUMMARY: BalancesSummary = { balance: '0.00', aging: EMPTY_AGING };

interface Params {
  role: CounterpartyRole;
  archived: boolean;
  search: string;
}

export const useCounterpartyBalances = ({ role, archived, search }: Params) => {
  const [items, setItems] = useState<CounterpartyBalanceRow[]>([]);
  const [summary, setSummary] = useState<BalancesSummary>(EMPTY_SUMMARY);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Explicit per-tab params; ?search omitted when empty.
    const params: Record<string, string | number | boolean> = {
      role, archived, page, page_size: pageSize,
    };
    if (search) params.search = search;

    api.get('/api/accounting/counterparties/balances/', { params })
      .then((res) => {
        if (cancelled) return;
        if (res == null) return;
        if (res.status === 200) {
          const data = res.data as {
            results?: CounterpartyBalanceRow[];
            count?: number;
            summary?: BalancesSummary;
          } | null;
          setItems(Array.isArray(data?.results) ? data!.results! : []);
          setCount(typeof data?.count === 'number' ? data!.count! : 0);
          setSummary(data?.summary ?? EMPTY_SUMMARY);
        } else {
          setItems([]);
          setCount(0);
          setSummary(EMPTY_SUMMARY);
          setError(res.data?.detail ?? 'Failed to load balances');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load balances');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [role, archived, search, page, revision]);

  return { summary, items, count, page, setPage, pageSize, isLoading, error, refetch };
};
