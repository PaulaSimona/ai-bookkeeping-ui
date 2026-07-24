import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { type LedgerEntryRow } from '@/hooks/useLedgerEntries';

/**
 * Internal-staff client-data resolution (backend s28, fe71367). Lets an assigned
 * reviewer / super user read+create the client records needed to resolve a review:
 *   GET/POST /api/accounting/staff/orgs/<org_id>/accounts/
 *   GET/POST /api/accounting/staff/orgs/<org_id>/counterparties/
 *   POST     /api/accounting/staff/entries/<id>/attribute/
 *   GET      /api/accounting/staff/orgs/<org_id>/entries/  (paginated)
 * Same error/auth handling as useInternalReview: the api interceptor RESOLVES
 * non-401 errors, so every call status-checks the resolved response and surfaces
 * the backend `detail` verbatim.
 */

// Mirrors accounting/serializers.py AccountSerializer (the read shape we use).
export interface StaffAccount {
  id: string;
  code: string;
  name: string;
  type: string; // asset | liability | equity | revenue | expense
  normal_balance: string; // debit | credit
  is_active: boolean;
  parent_account_id: string | null;
  full_name: string; // "code — name"
}

// Mirrors accounting/counterparty_serializers.py CounterpartySerializer.
export interface StaffCounterparty {
  id: string;
  name: string;
  is_client: boolean;
  is_supplier: boolean;
  archived: boolean;
}

// The staff entries endpoint serializes JournalEntrySerializer — same row shape
// the owner ledger uses (reuse the type; do not redefine).
export type StaffLedgerEntry = LedgerEntryRow;

export interface WriteResult<T = unknown> {
  ok: boolean;
  data?: T;
  status?: number;
  errorDetail?: string;
}

const extractDetail = (res: unknown, fallback: string): string => {
  const data = (res as { data?: unknown } | null | undefined)?.data;
  if (data == null || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string' && obj.detail) return obj.detail;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'code') continue;
    if (Array.isArray(val)) parts.push(val.map((v) => String(v)).join(' '));
    else if (typeof val === 'string') parts.push(val);
  }
  return parts.length ? parts.join(' ') : fallback;
};

// Read the full list off a paginated envelope in one page (pickers need the whole
// set; the chart / active counterparties fit under the 200 server max).
const fetchAll = async <T>(url: string, params?: Record<string, string>): Promise<T[]> => {
  const res = await api.get(url, { params: { ...(params ?? {}), page_size: 200 } });
  if (res == null || res.status !== 200) return [];
  const data = res.data;
  if (Array.isArray(data)) return data as T[];
  return Array.isArray(data?.results) ? (data.results as T[]) : [];
};

// ─── Accounts (the reject-correct chart picker) ────────────────────────────────

export const useStaffOrgAccounts = (orgId: string | null | undefined) => {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!orgId) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchAll<StaffAccount>(`/api/accounting/staff/orgs/${orgId}/accounts/`)
      .then((rows) => {
        if (!cancelled) setAccounts(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load accounts.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, revision]);

  return { accounts, isLoading, error, refetch };
};

export const createStaffOrgAccount = async (
  orgId: string,
  payload: {
    code: string;
    name: string;
    type: string;
    normal_balance: string;
    parent_account_id?: string | null;
  },
): Promise<WriteResult<StaffAccount>> => {
  try {
    const res = await api.post(`/api/accounting/staff/orgs/${orgId}/accounts/`, payload);
    if (res && res.status === 201) return { ok: true, data: res.data as StaffAccount };
    return { ok: false, status: res?.status, errorDetail: extractDetail(res, 'Failed to create account.') };
  } catch {
    return { ok: false, errorDetail: 'Failed to create account.' };
  }
};

// ─── Counterparties (the attribution picker) ───────────────────────────────────

export const useStaffOrgCounterparties = (
  orgId: string | null | undefined,
  opts?: { archived?: boolean },
) => {
  const archived = opts?.archived ? 'true' : 'false';
  const [counterparties, setCounterparties] = useState<StaffCounterparty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!orgId) {
      setCounterparties([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchAll<StaffCounterparty>(`/api/accounting/staff/orgs/${orgId}/counterparties/`, { archived })
      .then((rows) => {
        if (!cancelled) setCounterparties(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load counterparties.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, archived, revision]);

  return { counterparties, isLoading, error, refetch };
};

export const createStaffOrgCounterparty = async (
  orgId: string,
  payload: { name: string; is_client?: boolean; is_supplier?: boolean },
): Promise<WriteResult<StaffCounterparty>> => {
  try {
    const res = await api.post(`/api/accounting/staff/orgs/${orgId}/counterparties/`, payload);
    if (res && res.status === 201) return { ok: true, data: res.data as StaffCounterparty };
    return { ok: false, status: res?.status, errorDetail: extractDetail(res, 'Failed to create counterparty.') };
  } catch {
    return { ok: false, errorDetail: 'Failed to create counterparty.' };
  }
};

// ─── Entry attribution ─────────────────────────────────────────────────────────

export const attributeStaffEntry = async (
  entryId: string,
  counterpartyId: string,
): Promise<WriteResult> => {
  try {
    const res = await api.post(`/api/accounting/staff/entries/${entryId}/attribute/`, {
      counterparty_id: counterpartyId,
    });
    if (res && res.status === 200) return { ok: true, status: 200 };
    return { ok: false, status: res?.status, errorDetail: extractDetail(res, 'Attribution failed.') };
  } catch {
    return { ok: false, errorDetail: 'Attribution failed.' };
  }
};

// ─── Entries list (the per-client entries surface) ─────────────────────────────

export interface StaffEntriesFilters {
  status?: string;
  unattributed?: boolean;
}

export const useStaffOrgEntries = (orgId: string, filters: StaffEntriesFilters) => {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.unattributed) params.unattributed = 'true';
  return usePaginatedList<StaffLedgerEntry>(`/api/accounting/staff/orgs/${orgId}/entries/`, params);
};
