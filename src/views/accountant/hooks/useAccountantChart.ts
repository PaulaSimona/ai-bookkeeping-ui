// useAccountantChart (Session-25 Phase E, U2) — the accountant surfaces' OWN
// read of the org chart of accounts (/api/accounting/accounts/), flattened to a
// single active-account list. Used to (a) feed the New-adjustment account picker
// and (b) classify a ledger row as revenue/expense (from the real account.type,
// never an assumed code range). Standalone — does not import the owner hooks.
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/utils/api';

export type ChartAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: ChartAccountType;
  is_active: boolean;
  full_name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// The endpoint returns a paginated envelope of parent accounts, each with a
// `children` array. Flatten parents + children into one list; tolerate a bare
// array too. Only the fields the accountant surfaces need are kept.
const flatten = (raw: any): ChartAccount[] => {
  const parents: any[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
  const out: ChartAccount[] = [];
  for (const p of parents) {
    out.push({
      id: p.id, code: p.code, name: p.name, type: p.type,
      is_active: p.is_active, full_name: p.full_name,
    });
    for (const c of p.children ?? []) {
      out.push({
        id: c.id, code: c.code, name: c.name, type: c.type,
        is_active: c.is_active, full_name: c.full_name,
      });
    }
  }
  return out;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export const useAccountantChart = () => {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    // Chart is bounded (CA 140 / US 146) — one page of 200 covers it.
    api.get('/api/accounting/accounts/', { params: { page_size: 200 } })
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) {
          setAccounts(flatten(res.data));
        } else {
          setAccounts([]);
          setError(res.data?.detail ?? 'Failed to load the chart of accounts.');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load the chart of accounts.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  // Active accounts only, sorted by code — the picker's option list.
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active).sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  // Ids of every revenue/expense account — drives the ledger's "Adjust" action.
  const revenueExpenseIds = useMemo(
    () => new Set(accounts.filter((a) => a.type === 'revenue' || a.type === 'expense').map((a) => a.id)),
    [accounts],
  );

  return { accounts, activeAccounts, revenueExpenseIds, isLoading, error, refetch };
};
