// useCounterparties (§14 14-C-2b, D-14C2-5) — Tier 2 Clients/Suppliers data
// hook. A thin typed wrapper over the generic usePaginatedList (reused, not
// modified), mirroring useLedgerEntries: only filters that are actually set
// become query params. Mutation helpers follow the house write pattern (api
// util; the interceptor resolves non-401 errors, so callers status-check).
import { usePaginatedList } from '@/hooks/usePaginatedList';
import api from '@/utils/api';

export type CounterpartyRole = 'client' | 'supplier';

// Typed per CounterpartySerializer.
export interface CounterpartyRow {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  city: string;
  province: string;
  payment_terms: string;
  is_client: boolean;
  is_supplier: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CounterpartyFilters {
  role?: CounterpartyRole;
  archived?: boolean;
  search?: string;
}

export const useCounterparties = (filters: CounterpartyFilters) => {
  const params: Record<string, string> = {};
  if (filters.role) params.role = filters.role;
  if (filters.archived !== undefined) params.archived = filters.archived ? 'true' : 'false';
  if (filters.search) params.search = filters.search;
  return usePaginatedList<CounterpartyRow>('/api/accounting/counterparties/', params);
};

// ── Mutations (house pattern; return the api promise, caller status-checks) ──
export interface CounterpartyPayload {
  name: string;
  contact_name?: string;
  email?: string;
  city?: string;
  province?: string;
  payment_terms?: string;
  is_client?: boolean;
  is_supplier?: boolean;
}

export const createCounterparty = (payload: CounterpartyPayload) =>
  api.post('/api/accounting/counterparties/', payload);

export const updateCounterparty = (id: string, payload: Partial<CounterpartyPayload>) =>
  api.patch(`/api/accounting/counterparties/${id}/`, payload);

export const archiveCounterparty = (id: string) =>
  api.post(`/api/accounting/counterparties/${id}/archive/`);

export const unarchiveCounterparty = (id: string) =>
  api.post(`/api/accounting/counterparties/${id}/unarchive/`);
