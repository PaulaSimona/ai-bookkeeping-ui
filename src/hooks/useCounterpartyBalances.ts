// useCounterpartyBalances (§14 14-C-2b, D-14C2-5/-20) — reads
// GET /api/accounting/counterparties/balances/?role=. The response is the
// standard AccountingPagination envelope PLUS a top-level `summary`, so this
// hook does NOT reuse usePaginatedList (which drops the summary). It fetches via
// the same api util, following usePaginatedList's three-leg interceptor
// contract, and surfaces {summary, items, count, page, setPage, isLoading,
// error, refetch}. It pulls a full page (server max) so pages can join balances
// to the counterparty list by id.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import type { CounterpartyRole } from '@/hooks/useCounterparties';

const FULL_PAGE = 200; // AccountingPagination.max_page_size — one page covers all

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

export const useCounterpartyBalances = (role: CounterpartyRole) => {
  const [items, setItems] = useState<CounterpartyBalanceRow[]>([]);
  const [summary, setSummary] = useState<BalancesSummary>(EMPTY_SUMMARY);
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

    api.get('/api/accounting/counterparties/balances/', {
      params: { role, page, page_size: FULL_PAGE },
    })
      .then((res) => {
        if (cancelled) return;
        // Same interceptor contract as usePaginatedList: null = cancelled;
        // status 200 = trust; else a resolved error response.
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
  }, [role, page, revision]);

  return { summary, items, count, page, setPage, isLoading, error, refetch };
};
