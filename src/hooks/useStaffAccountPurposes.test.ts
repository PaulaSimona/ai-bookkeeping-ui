// A client's account purposes (S98 P1d item 1): the read, the dry run and the
// confirm run against the backend contract
// (accounting/account_purpose_views.py). Every fixture is invented.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  ALLOCATION_PURPOSES,
  useStaffAccountPurposeAction,
  useStaffAccountPurposes,
  type AccountPurposeRow,
} from './useStaffAccountPurposes';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const READ_URL = `/api/accounting/staff/orgs/${ORG}/account-purposes/`;

const SUPPLIES: AccountPurposeRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: '9101',
  name: 'Invented Supplies',
  type: 'expense',
  is_active: true,
  purpose: 'expense',
  allowed_for_allocation: true,
  allowed_purposes: ['expense', 'cost_of_sales', 'depreciation', 'unclassified'],
};
const ACTION_URL = `/api/accounting/staff/accounts/${SUPPLIES.id}/purpose/`;

const PLAN = {
  account_id: SUPPLIES.id,
  code: '9101',
  name: 'Invented Supplies',
  type: 'expense',
  before: 'expense',
  after: 'cost_of_sales',
  allowed_for_allocation: true,
  changes: true,
  reason: 'Goods bought for resale.',
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('the ALLOCATION_PURPOSES pin', () => {
  it('is exactly the five purposes that take a purchase allocation', () => {
    expect(ALLOCATION_PURPOSES).toEqual([
      'expense',
      'cost_of_sales',
      'inventory',
      'prepaid',
      'fixed_asset',
    ]);
  });
});

describe("a client's account purposes: the read", () => {
  it("reads the org's accounts from its own URL, unpaginated", async () => {
    get.mockResolvedValue({ status: 200, data: { count: 1, accounts: [SUPPLIES] } });

    const { result } = renderHook(() => useStaffAccountPurposes(ORG));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(READ_URL);
    expect(result.current.accounts).toEqual([SUPPLIES]);
    expect(result.current.error).toBeNull();
  });

  it('reads nothing until it has an org', () => {
    const { result } = renderHook(() => useStaffAccountPurposes(null));

    expect(get).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.accounts).toEqual([]);
  });

  it('checks the status: not found, an error and a lost connection are never an empty list', async () => {
    get.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    const gone = renderHook(() => useStaffAccountPurposes(ORG));
    await waitFor(() => expect(gone.result.current.isLoading).toBe(false));
    expect(gone.result.current.notFound).toBe(true);
    expect(gone.result.current.error).toBe('Not found');

    get.mockResolvedValueOnce({ status: 500, data: null });
    const failed = renderHook(() => useStaffAccountPurposes(ORG));
    await waitFor(() => expect(failed.result.current.isLoading).toBe(false));
    expect(failed.result.current.error).toBe('Could not load the account purposes.');
    expect(failed.result.current.notFound).toBe(false);

    get.mockRejectedValueOnce(new Error('network down'));
    const lost = renderHook(() => useStaffAccountPurposes(ORG));
    await waitFor(() => expect(lost.result.current.isLoading).toBe(false));
    expect(lost.result.current.error).toBe('Could not load the account purposes.');
  });
});

describe("a client's account purposes: the change", () => {
  it('the dry run posts purpose and reason alone and keeps the preview token', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { executed: false, plan: PLAN, preview_token: 'tok-invented-2' },
    });
    const { result } = renderHook(() => useStaffAccountPurposeAction());

    const outcome = await result.current.preview(SUPPLIES.id, 'cost_of_sales', PLAN.reason);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(ACTION_URL, { purpose: 'cost_of_sales', reason: PLAN.reason });
    expect(outcome).toEqual({ ok: true, executed: false, plan: PLAN, previewToken: 'tok-invented-2' });
  });

  it("the confirm run sends the dry run's token with the same purpose and reason", async () => {
    post.mockResolvedValue({ status: 200, data: { executed: true, plan: PLAN } });
    const { result } = renderHook(() => useStaffAccountPurposeAction());

    const outcome = await result.current.confirm(
      SUPPLIES.id,
      'cost_of_sales',
      PLAN.reason,
      'tok-invented-2',
    );

    expect(post).toHaveBeenCalledWith(ACTION_URL, {
      purpose: 'cost_of_sales',
      reason: PLAN.reason,
      confirm: true,
      preview_token: 'tok-invented-2',
    });
    expect(outcome).toMatchObject({ ok: true, executed: true });
  });

  it('hands back a 409 with the server code and its own words', async () => {
    const detail = 'An asset account cannot have the purpose expense.';
    post.mockResolvedValue({ status: 409, data: { code: 'purpose_type_mismatch', detail } });
    const { result } = renderHook(() => useStaffAccountPurposeAction());

    expect(await result.current.preview(SUPPLIES.id, 'inventory', 'A reason.')).toEqual({
      ok: false,
      refusal: {
        status: 409,
        code: 'purpose_type_mismatch',
        detail,
        context: { code: 'purpose_type_mismatch', detail },
      },
    });
  });
});
