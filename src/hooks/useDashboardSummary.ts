import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';

// ── DashboardSummary ──────────────────────────────────────────────────────────
// The GET /api/accounting/dashboard/ 200 contract (D-14B-5). Money figures are
// two-decimal STRINGS (never floats — format for display, never math in JS).
// tax_net / tax_mode / currency / fiscal_year are null for a not-yet-onboarded
// org (no tax profile / unregistered → no tax position; no fiscal year set).
export interface FiscalYear {
  start: string; // ISO date
  end: string;   // ISO date
}

export interface DashboardSummary {
  cash_on_hand: string;
  receivables: string;
  payables: string;
  tax_net: string | null;
  tax_mode: string | null;
  profit_to_date: string;
  currency: string | null;
  fiscal_year: FiscalYear | null;
  as_of: string; // ISO date
}

// ── useDashboardSummary ───────────────────────────────────────────────────────
// Single-resource fetch, mirroring useOrgMe (hooks/useAccounts.ts): useState
// data/isLoading/error, revision-based refetch, and the status-check guard
// against the api interceptor's non-401-resolves-to-response / cancel-resolves-
// to-null contract.

export const useDashboardSummary = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get('/api/accounting/dashboard/')
      .then((res) => {
        if (cancelled) return;
        // The api interceptor RESOLVES non-401 HTTP errors (it returns
        // error.response) and resolves cancellations to null — so a 403 body
        // ("Not available on your plan.") would land HERE, not in .catch.
        // Consumers must never receive a non-200 body as data: status-check
        // before trusting it. null = cancelled → no-op.
        if (res == null) return;
        if (res.status === 200) {
          setData(res.data);
        } else {
          setData(null);
          setError(res.data?.detail ?? 'Failed to load dashboard');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load dashboard');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  return { data, isLoading, error, refetch };
};
