import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type OrgRole = 'owner' | 'accountant' | 'reviewer';

export interface Account {
  id: string;
  org_id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  is_active: boolean;
  parent_account_id: string | null;
  parent_account_code: string | null;
  full_name: string;
  has_posted_lines: boolean;
  children: ChildAccount[];
  created_at: string;
  updated_at: string;
}

export interface ChildAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  is_active: boolean;
  full_name: string;
}

export interface AccountFilters {
  type?: AccountType;
  active?: boolean;
  search?: string;
}

export interface OrgMe {
  org_id: string;
  org_name: string;
  role: OrgRole;
  base_currency: string;
  // §14 onboarding-completeness reads (backend 14A-1, merged 4249a88).
  // has_tax_profile is a real boolean, never null; opening_balance_choice is
  // serialized ''→null server-side, so null = not yet recorded;
  // books_start_date is an ISO 'YYYY-MM-DD' string or null.
  has_tax_profile: boolean;
  opening_balance_choice: 'starting_fresh' | 'opening_balances' | null;
  books_start_date: string | null;
}

export interface CreateAccountPayload {
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  parent_account_id?: string | null;
  is_active?: boolean;
}

// ── useOrgMe ──────────────────────────────────────────────────────────────────

export const useOrgMe = () => {
  const [data, setData] = useState<OrgMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get('/api/accounting/me/')
      .then((res) => {
        if (cancelled) return;
        // The api interceptor RESOLVES non-401 HTTP errors (it returns
        // error.response) and resolves cancellations to null — so a 403 body
        // ("No active organization membership found") would land HERE, not in
        // .catch. Consumers must never receive a non-200 body as data:
        // status-check before trusting it. null = cancelled → no-op.
        if (res == null) return;
        if (res.status === 200) {
          setData(res.data);
        } else {
          setData(null);
          setError(res.data?.detail ?? 'Failed to load org info');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load org info');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  return {
    orgId: data?.org_id,
    orgName: data?.org_name,
    role: data?.role,
    baseCurrency: data?.base_currency,
    hasTaxProfile: data?.has_tax_profile,
    openingBalanceChoice: data?.opening_balance_choice,
    booksStartDate: data?.books_start_date,
    isLoading,
    error,
    refetch,
  };
};

// ── useAccounts ───────────────────────────────────────────────────────────────

export const useAccounts = (filters?: AccountFilters) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    if (filters?.type) params.type = filters.type;
    if (filters?.active !== undefined) params.active = String(filters.active);
    if (filters?.search) params.search = filters.search;
    // This endpoint is paginated (PageNumberPagination, page_size 50, max 200).
    // The chart of accounts is bounded well under 200 (CA 140 / US 146), so
    // pull it in one page. If a chart ever exceeds 200, add real pagination.
    params.page_size = '200';

    api.get('/api/accounting/accounts/', { params })
      .then((res) => {
        // The response is a paginated envelope {count, next, previous, results}.
        // Read results, but tolerate a plain array too, and coerce anything
        // non-array to [] so a non-list can never reach .map() and white-screen
        // the page — it degrades to the empty state instead.
        const data = res?.data;
        if (!cancelled) setAccounts(Array.isArray(data) ? data : (data?.results ?? []));
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load accounts');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.type, filters?.active, filters?.search, revision]);

  return { accounts, isLoading, error, refetch };
};

// ── useCreateAccount ──────────────────────────────────────────────────────────

export const useCreateAccount = (refetch: () => void) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);

  const createAccount = useCallback(async (payload: CreateAccountPayload) => {
    setIsSubmitting(true);
    setErrors(null);
    try {
      const res = await api.post('/api/accounting/accounts/create/', payload);
      if (res?.status === 201) {
        refetch();
        return { ok: true, data: res.data as Account };
      }
      return { ok: false, data: null };
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      return { ok: false, data: null };
    } finally {
      setIsSubmitting(false);
    }
  }, [refetch]);

  return { createAccount, isSubmitting, errors, clearErrors: () => setErrors(null) };
};

// ── useUpdateAccount ──────────────────────────────────────────────────────────

export const useUpdateAccount = (id: string, refetch: () => void) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);

  const updateAccount = useCallback(async (payload: Partial<CreateAccountPayload>) => {
    setIsSubmitting(true);
    setErrors(null);
    try {
      const res = await api.patch(`/api/accounting/accounts/${id}/`, payload);
      if (res?.status === 200) {
        refetch();
        return { ok: true, data: res.data as Account };
      }
      if (res?.status === 400) {
        const detail = res.data?.detail;
        if (detail) setErrors({ detail: [detail] });
        else if (res.data) setErrors(res.data);
      }
      return { ok: false, data: null };
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      return { ok: false, data: null };
    } finally {
      setIsSubmitting(false);
    }
  }, [id, refetch]);

  return { updateAccount, isSubmitting, errors, clearErrors: () => setErrors(null) };
};
