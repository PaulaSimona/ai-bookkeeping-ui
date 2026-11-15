// useAccountCategories (J1c-1): the accounts that may carry a job cost
// category, and the one write that sets it.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  JOB_COST_CATEGORIES,
  jobCostCategoryLabel,
  setAccountJobCostCategory,
  useAccountCategories,
} from './useAccountCategories';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

// AccountCategorySerializer.
const MATERIALS = {
  account_id: 'a0000000-0000-4000-8000-000000005000',
  code: '5000',
  name: 'Materials',
  type: 'expense',
  is_active: true,
  job_cost_category: 'materials',
};

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});

describe('useAccountCategories', () => {
  it('reads the accounts as a paged list', async () => {
    get.mockResolvedValue({
      status: 200,
      data: { count: 1, next: null, previous: null, results: [MATERIALS] },
    });

    const { result } = renderHook(() => useAccountCategories());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([MATERIALS]);
    expect(get).toHaveBeenCalledWith('/api/accounting/projects/account-categories/', {
      params: { page: 1, page_size: 50 },
    });
  });

  it('sets a category, and clears it with null', async () => {
    patch.mockResolvedValue({ status: 200, data: {} });

    await setAccountJobCostCategory(MATERIALS.account_id, 'labour');
    await setAccountJobCostCategory(MATERIALS.account_id, null);

    const url = `/api/accounting/accounts/${MATERIALS.account_id}/job-cost-category/`;
    expect(patch).toHaveBeenNthCalledWith(1, url, { job_cost_category: 'labour' });
    expect(patch).toHaveBeenNthCalledWith(2, url, { job_cost_category: null });
  });

  it('offers the six categories an account may carry, never "not a job cost"', () => {
    expect(JOB_COST_CATEGORIES).toEqual([
      { value: 'materials', label: 'Materials' },
      { value: 'labour', label: 'Labour' },
      { value: 'subcontractors', label: 'Subcontractors' },
      { value: 'equipment', label: 'Equipment' },
      { value: 'permits_fees', label: 'Permits & fees' },
      { value: 'other_direct', label: 'Other direct cost' },
    ]);
    expect(jobCostCategoryLabel('permits_fees')).toBe('Permits & fees');
    expect(jobCostCategoryLabel(null)).toBe('None');
  });
});
