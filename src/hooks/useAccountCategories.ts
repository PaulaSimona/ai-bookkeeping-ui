// useAccountCategories (J1c-1) — the org's accounts that may carry a job cost
// category (GET projects/account-categories/), and the one write that sets or
// clears it. Client lane only. House pattern: usePaginatedList for the list;
// the write returns the api promise and the caller status-checks.
import { usePaginatedList } from '@/hooks/usePaginatedList';
import api from '@/utils/api';

// The six categories an account may carry (JobCostCategory), in the server's
// order. "Not a job cost" is a choice for one ledger line, never for an
// account, so it is not here.
export const JOB_COST_CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'labour', label: 'Labour' },
  { value: 'subcontractors', label: 'Subcontractors' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'permits_fees', label: 'Permits & fees' },
  { value: 'other_direct', label: 'Other direct cost' },
];

export const NO_CATEGORY_LABEL = 'None';

export const jobCostCategoryLabel = (value: string | null): string =>
  value === null
    ? NO_CATEGORY_LABEL
    : (JOB_COST_CATEGORIES.find((category) => category.value === value)?.label ?? value);

// Typed per AccountCategorySerializer.
export interface AccountCategoryRow {
  account_id: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  job_cost_category: string | null;
}

export const useAccountCategories = () =>
  usePaginatedList<AccountCategoryRow>('/api/accounting/projects/account-categories/');

// Answer: {id, code, job_cost_category, posted_lines_not_affected}.
export const setAccountJobCostCategory = (accountId: string, value: string | null) =>
  api.patch(`/api/accounting/accounts/${accountId}/job-cost-category/`, {
    job_cost_category: value,
  });
