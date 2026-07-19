// useLedgerEntries (§14 14-C-1, U1) — Tier 2 Ledger register data hook. A thin
// typed wrapper over the generic usePaginatedList (reused, not modified), so the
// Ledger keeps its own data layer separate from any Tier 1 hook. Only filters
// that are actually set become query params — the backend 400s on an empty
// ?tab= (present-but-empty is invalid), so we never send blank values.
import { usePaginatedList } from '@/hooks/usePaginatedList';

export type LedgerTab = 'revenue' | 'expenses' | 'payable' | 'receivable' | 'cash';

// UI mirror of the backend ledger_tabs.VALID_TABS (single-source there).
export const LEDGER_TABS: { value: LedgerTab; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'payable', label: 'Payable' },
  { value: 'receivable', label: 'Receivable' },
  { value: 'cash', label: 'Cash' },
];

// Typed per JournalLineSerializer.
export interface LedgerEntryLine {
  id: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit: string | null;   // two-decimal string | null (display only, no JS math)
  credit: string | null;
  description: string;
  tax_code: string;
  line_order: number;
}

// Typed per JournalEntrySerializer (the C2 read contract, incl. needs_review).
export interface LedgerEntryRow {
  id: string;
  entry_number: number | null;
  entry_number_display: string | null;
  entry_date: string;
  description: string;
  source: string;
  status: string;
  needs_review: boolean;
  posted_at: string | null;
  total_debits: string;
  total_credits: string;
  is_balanced: boolean;
  lines: LedgerEntryLine[];
  created_at: string;
  updated_at: string;
}

export interface LedgerFilters {
  tab?: LedgerTab;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export const useLedgerEntries = (filters: LedgerFilters) => {
  const params: Record<string, string> = {};
  if (filters.tab) params.tab = filters.tab;
  if (filters.status) params.status = filters.status;
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  return usePaginatedList<LedgerEntryRow>('/api/accounting/entries/', params);
};
