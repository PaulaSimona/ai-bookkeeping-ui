// usePaginatedList<T> (§14 14A-2, ruling D2) — generic hook over the Tier 2
// AccountingPagination envelope {count, next, previous, results}. Built
// BESIDE useListEndpoint (useStaffConsole.ts), NOT replacing it: that helper
// stays the private bare-array staff-console reader (the C2 pagination rider
// remains queued for §15). First consumer: 14A-3's /documents/status/ — no
// existing file adopts this hook in this commit.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

// AccountingPagination.max_page_size — the server clamps anyway; we clamp too
// so page/count math on the client stays truthful.
const SERVER_MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

export interface PaginatedEnvelope<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const usePaginatedList = <T>(
  url: string,
  params?: Record<string, string | number | boolean>,
) => {
  const [items, setItems] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setRawPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  const setPageSize = useCallback((n: number) => {
    setRawPageSize(Math.max(1, Math.min(n, SERVER_MAX_PAGE_SIZE)));
  }, []);

  // Serialize extra params so callers can pass inline object literals without
  // re-triggering the effect on every render.
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api.get(url, { params: { ...(params ?? {}), page, page_size: pageSize } })
      .then((res) => {
        if (cancelled) return;
        // Leg 1: the api interceptor RESOLVES non-401 HTTP errors (it returns
        // error.response) and resolves cancellations to null — status-check
        // everything. null = cancelled at the interceptor, silent no-op.
        if (res == null) return;
        if (res.status === 200) {
          const data = res.data as PaginatedEnvelope<T> | null;
          // Trust the envelope; coerce a missing/non-array results to [] so a
          // non-list can never reach a consumer's .map().
          setItems(Array.isArray(data?.results) ? data.results : []);
          setCount(typeof data?.count === 'number' ? data.count : 0);
        } else {
          // Leg 2: a resolved error response (400/403/404/...).
          setItems([]);
          setCount(0);
          setError(res.data?.detail ?? 'Failed to load list');
        }
      })
      .catch((err) => {
        // Leg 3: terminal-401s (failed refresh) and network errors still
        // REJECT — keep the catch.
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load list');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  // params is represented by paramsKey (serialized) — see above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey, page, pageSize, revision]);

  return { items, count, page, setPage, pageSize, setPageSize, isLoading, error, refetch };
};
