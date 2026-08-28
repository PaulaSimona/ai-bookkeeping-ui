// Bank Transactions data hooks (O-S57-2 / O-S57-3, Chain 2B). All calls go
// through the wrapped axios client, which resolves error responses instead of
// throwing — so every hook status-checks, never try/catches. Types mirror the
// Chain 2A serializers EXACTLY (accounting/bank_public_serializers.py); no
// invented fields. The public status vocabulary is the only status the wire
// carries — never a reviewer-internal word (R6).
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import type { PlaidItem } from './usePlaid';

// ─── Public vocabulary (O-S57-2) ────────────────────────────────────────────

export const PUBLIC_STATUSES = ['Imported', 'Matched', 'Posted', 'Excluded'] as const;
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

// ─── Types (mirror bank_public_serializers.py) ──────────────────────────────

export interface BankTransactionRow {
  id: string;
  date: string;
  description: string;
  counterparty_name: string;
  amount: string;            // DecimalField → string
  signed_amount: string;     // money_out negative, money_in positive
  currency: string;
  direction: string;
  bank_account_id: string;
  bank_account_name: string | null;
  bank_account_mask: string | null;
  public_status: PublicStatus;
  pending: boolean;
}

export interface JournalLineEffect {
  account_code: string | null;
  account_name: string | null;
  debit: string | null;
  credit: string | null;
  description: string;
}

export interface JournalEntryEffect {
  entry_number: number | null;
  entry_date: string;
  description: string;
  lines: JournalLineEffect[];
}

export interface BankTransactionDetail extends BankTransactionRow {
  journal_entries: JournalEntryEffect[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BalanceResponse {
  opening_balance: string;
  closing_balance: string;
}

export interface TransactionFilters {
  bank_account?: string;
  date_from?: string;
  date_to?: string;
  status?: PublicStatus;
}

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number; error: string };

// ─── Error mapping ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorMessage = (response: any): string => {
  if (response?.status === 403) {
    return 'Only the account owner can manage bank transactions.';
  }
  // 400 (bad filter), 404, 502 (Plaid unreachable on disconnect) carry a
  // human-readable detail from the backend — surface it as-is.
  if (typeof response?.data?.detail === 'string') {
    return response.data.detail;
  }
  return 'Something went wrong. Please try again.';
};

const buildQuery = (filters: TransactionFilters, page?: number): string => {
  const q = new URLSearchParams();
  if (filters.bank_account) q.set('bank_account', filters.bank_account);
  if (filters.date_from) q.set('date_from', filters.date_from);
  if (filters.date_to) q.set('date_to', filters.date_to);
  if (filters.status) q.set('status', filters.status);
  if (page && page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `?${s}` : '';
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** GET /transactions/ — paginated, filtered list. Refetches when the query
 *  (filters + page) changes or refetch() is called. */
export const useBankTransactions = (
  filters: TransactionFilters,
  page: number,
) => {
  const [data, setData] =
    useState<PaginatedResponse<BankTransactionRow> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);
  const query = buildQuery(filters, page);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get(`/api/accounting/transactions/${query}`).then((response) => {
      if (cancelled) return;
      if (response?.status === 200) {
        setData(response.data as PaginatedResponse<BankTransactionRow>);
      } else {
        setError(errorMessage(response));
      }
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [query, revision]);

  return { data, isLoading, error, refetch };
};

/** GET /transactions/balance/ — opening/closing for the current filter window
 *  (page-independent). */
export const useBankBalance = (filters: TransactionFilters) => {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);
  const query = buildQuery(filters);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get(`/api/accounting/transactions/balance/${query}`).then((response) => {
      if (cancelled) return;
      if (response?.status === 200) {
        setBalance(response.data as BalanceResponse);
      } else {
        setError(errorMessage(response));
      }
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [query, revision]);

  return { balance, isLoading, error, refetch };
};

/** GET /transactions/<id>/ — on-demand detail (row expand / drawer). */
export const useBankTransactionDetail = () => {
  const loadDetail = async (
    id: string,
  ): Promise<Result<BankTransactionDetail>> => {
    const response = await api.get(`/api/accounting/transactions/${id}/`);
    if (response?.status === 200) {
      return { ok: true, data: response.data as BankTransactionDetail };
    }
    return { ok: false, status: response?.status, error: errorMessage(response) };
  };
  return { loadDetail };
};

/** POST /plaid/disconnect/ — durable disconnect; returns the retired item. */
export const useDisconnectItem = () => {
  const disconnect = async (itemId: string): Promise<Result<PlaidItem>> => {
    const response = await api.post(
      '/api/accounting/plaid/disconnect/', { item_id: itemId },
    );
    if (response?.status === 200) {
      return { ok: true, data: response.data as PlaidItem };
    }
    return { ok: false, status: response?.status, error: errorMessage(response) };
  };
  return { disconnect };
};

/** GET /transactions/export/pdf/ — returns the PDF blob for the current filter
 *  window. The caller triggers the browser download (keeps DOM out of the
 *  hook). Uses the wrapped client so the JWT Bearer rides along. */
export const useExportPdf = () => {
  const exportPdf = async (
    filters: TransactionFilters,
  ): Promise<Result<Blob>> => {
    const response = await api.get(
      `/api/accounting/transactions/export/pdf/${buildQuery(filters)}`,
      { responseType: 'blob' },
    );
    if (response?.status === 200) {
      return { ok: true, data: response.data as Blob };
    }
    return { ok: false, status: response?.status, error: errorMessage(response) };
  };
  return { exportPdf };
};
