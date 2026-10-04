// useAllAccounts (D-S84-6, D-S85-5): paging, the hard cap, fail-closed errors,
// the org_id check, and never exposing one org's accounts under another's key.
import { type FC } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { AccountPicker } from '@/components/AccountPicker';
import {
  MAX_PAGES,
  PAGE_SIZE,
  useAllAccounts,
  type AccountsLane,
} from './useAllAccounts';

// The real client is never loaded: no network, and no token / env reads.
vi.mock('@/utils/api', () => ({ default: { get: vi.fn() } }));

interface RequestConfig {
  params: { page: number; page_size: number; active?: boolean };
  signal: AbortSignal;
  headers?: unknown;
}
const get = api.get as unknown as Mock<
  (url: string, config: RequestConfig) => Promise<unknown>
>;

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const OWNER_URL = '/api/accounting/accounts/';

// One row as the backend's AccountSerializer sends it.
const row = (org: string, n: number, extra: Record<string, unknown> = {}) => ({
  id: `${org}-acct-${n}`,
  org_id: org,
  code: String(1000 + n),
  name: `Account ${n}`,
  type: 'asset',
  normal_balance: 'debit',
  is_active: true,
  parent_account_id: null,
  parent_account_code: null,
  full_name: `${1000 + n} — Account ${n}`,
  has_posted_lines: false,
  children: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...extra,
});

const rows = (org: string, from: number, howMany: number) =>
  Array.from({ length: howMany }, (_, i) => row(org, from + i));

const ok = (results: unknown[], count: number, next: string | null) => ({
  status: 200,
  data: { count, next, previous: null, results },
});

// An absolute URL, as DRF sends it. The loader must never request it.
const NEXT = 'https://api.example.test/api/accounting/accounts/?page=2&page_size=200';

const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

// 200 + 200 + 50.
const threePages = (org: string) => (_url: string, config: RequestConfig) => {
  const { page } = config.params;
  if (page === 1) return Promise.resolve(ok(rows(org, 0, 200), 450, NEXT));
  if (page === 2) return Promise.resolve(ok(rows(org, 200, 200), 450, NEXT));
  return Promise.resolve(ok(rows(org, 400, 50), 450, null));
};

const settled = async (result: { current: { loading: boolean } }) =>
  waitFor(() => expect(result.current.loading).toBe(false));

// The hook wired to the picker, as a screen will wire it.
const Screen: FC<{ lane: AccountsLane; orgId: string | null }> = ({ lane, orgId }) => {
  const { accounts, loading, error } = useAllAccounts(lane, orgId);
  return (
    <AccountPicker
      id="acct"
      ariaLabel="Account"
      value=""
      onChange={() => undefined}
      accounts={accounts}
      loading={loading}
      error={error}
    />
  );
};

beforeEach(() => {
  get.mockReset();
});

describe('paging', () => {
  it('loads 200 + 200 + 50 as 450 accounts, requesting pages by number', async () => {
    get.mockImplementation(threePages(ORG_A));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));

    expect(result.current.loading).toBe(true);
    expect(result.current.accounts).toEqual([]);
    await settled(result);

    expect(result.current.error).toBeNull();
    expect(result.current.accounts).toHaveLength(450);
    expect(new Set(result.current.accounts.map((a) => a.id)).size).toBe(450);

    // Same relative URL every time, page 1..3 — the absolute `next` URL is
    // never followed.
    expect(get.mock.calls.map(([url, config]) => [url, config.params])).toEqual([
      [OWNER_URL, { page: 1, page_size: PAGE_SIZE, active: true }],
      [OWNER_URL, { page: 2, page_size: PAGE_SIZE, active: true }],
      [OWNER_URL, { page: 3, page_size: PAGE_SIZE, active: true }],
    ]);
  });

  it('makes an account from the third page findable by its code', async () => {
    const user = userEvent.setup();
    get.mockImplementation(threePages(ORG_A));
    render(<Screen lane="owner" orgId={ORG_A} />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    // n = 449 is the last row of page 3.
    await user.click(screen.getByRole('combobox', { name: 'Account' }));
    await user.keyboard('1449');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '1449 — Account 449',
    ]);
  });

  it('sends no X-Org-Id of its own (the interceptor would overwrite it)', async () => {
    get.mockResolvedValue(ok(rows(ORG_A, 0, 2), 2, null));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(get.mock.calls[0][1].headers).toBeUndefined();
  });

  it('uses the same endpoint for the accountant lane', async () => {
    get.mockResolvedValue(ok(rows(ORG_A, 0, 2), 2, null));
    const { result } = renderHook(() => useAllAccounts('accountant', ORG_A));
    await settled(result);
    expect(get.mock.calls[0][0]).toBe(OWNER_URL);
    expect(get.mock.calls[0][1].params).toEqual({
      page: 1,
      page_size: PAGE_SIZE,
      active: true,
    });
  });

  it('names the org in the path on the staff lane, with no active filter', async () => {
    get.mockResolvedValue(ok(rows(ORG_A, 0, 2), 2, null));
    const { result } = renderHook(() => useAllAccounts('staff', ORG_A));
    await settled(result);

    expect(get.mock.calls[0][0]).toBe(`/api/accounting/staff/orgs/${ORG_A}/accounts/`);
    expect(get.mock.calls[0][1].params).toEqual({ page: 1, page_size: PAGE_SIZE });
    expect(result.current.accounts).toHaveLength(2);
  });

  it('requests nothing while there is no org', () => {
    const { result } = renderHook(() => useAllAccounts('owner', null));
    expect(get).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ accounts: [], loading: false, error: null });
  });
});

describe('the page cap', () => {
  const endless = (_url: string, config: RequestConfig) =>
    Promise.resolve(
      ok(rows(ORG_A, (config.params.page - 1) * PAGE_SIZE, PAGE_SIZE), 5000, NEXT),
    );

  it('stops at the cap with an error and no list when `next` never ends', async () => {
    get.mockImplementation(endless);
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);

    expect(get).toHaveBeenCalledTimes(MAX_PAGES);
    expect(result.current.error).toBe('Too many accounts to load (more than 2,000).');
    expect(result.current.accounts).toEqual([]);
  });

  it('gives the picker an error and no options', async () => {
    const user = userEvent.setup();
    get.mockImplementation(endless);
    render(<Screen lane="owner" orgId={ORG_A} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many accounts to load');
    await user.click(screen.getByRole('combobox', { name: 'Account' }));
    await user.keyboard('1');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('accepts a chart that ends exactly on the last allowed page', async () => {
    const total = MAX_PAGES * PAGE_SIZE;
    get.mockImplementation((_url, config) =>
      Promise.resolve(
        ok(
          rows(ORG_A, (config.params.page - 1) * PAGE_SIZE, PAGE_SIZE),
          total,
          config.params.page < MAX_PAGES ? NEXT : null,
        ),
      ),
    );
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toBeNull();
    expect(result.current.accounts).toHaveLength(total);
  });
});

describe('an org switch', () => {
  it('exposes no accounts while B is pending, ignores a late A response, then shows only B', async () => {
    const a = deferred();
    const b = deferred();
    get.mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise);

    const { result, rerender } = renderHook(
      ({ orgId }: { orgId: string }) => useAllAccounts('owner', orgId),
      { initialProps: { orgId: ORG_A } },
    );
    expect(get).toHaveBeenCalledTimes(1);

    // Switch to B while A is still in flight.
    rerender({ orgId: ORG_B });
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1].signal.aborted).toBe(true);
    expect(get.mock.calls[1][1].signal.aborted).toBe(false);
    expect(result.current.accounts).toEqual([]);
    expect(result.current.loading).toBe(true);

    // A answers late, with a perfectly valid page of A's accounts.
    await act(async () => {
      a.resolve(ok(rows(ORG_A, 0, 3), 3, null));
      await a.promise;
    });
    expect(result.current.accounts).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      b.resolve(ok(rows(ORG_B, 0, 2), 2, null));
      await b.promise;
    });
    await settled(result);
    expect(result.current.accounts.map((acc) => acc.org_id)).toEqual([ORG_B, ORG_B]);
  });

  it('never exposes the accounts loaded for A in any render that carries B', async () => {
    const b = deferred();
    get
      .mockImplementationOnce(() => Promise.resolve(ok(rows(ORG_A, 0, 3), 3, null)))
      .mockImplementationOnce(() => b.promise);

    // Every render: the org it was for, and the orgs of the accounts exposed.
    const renders: { orgId: string; exposed: string[] }[] = [];
    const { result, rerender } = renderHook(
      ({ orgId }: { orgId: string }) => {
        const state = useAllAccounts('owner', orgId);
        renders.push({ orgId, exposed: [...new Set(state.accounts.map((acc) => acc.org_id))] });
        return state;
      },
      { initialProps: { orgId: ORG_A } },
    );
    await settled(result);
    expect(result.current.accounts).toHaveLength(3);

    rerender({ orgId: ORG_B });
    expect(result.current.accounts).toEqual([]);
    await act(async () => {
      b.resolve(ok(rows(ORG_B, 0, 2), 2, null));
      await b.promise;
    });
    await settled(result);

    const underB = renders.filter((r) => r.orgId === ORG_B);
    expect(underB.length).toBeGreaterThan(0);
    for (const r of underB) expect(r.exposed.filter((o) => o !== ORG_B)).toEqual([]);
    expect(result.current.accounts.map((acc) => acc.org_id)).toEqual([ORG_B, ORG_B]);
  });

  it('aborts the request in flight on unmount', () => {
    get.mockImplementation(() => deferred().promise);
    const { unmount } = renderHook(() => useAllAccounts('staff', ORG_A));
    const { signal } = get.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});

describe('failing closed', () => {
  it('turns a non-200 response into an error, not an empty list', async () => {
    get.mockResolvedValue({ status: 403, data: { detail: 'Not available on your plan.' } });
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toBe('Not available on your plan.');
    expect(result.current.accounts).toEqual([]);
  });

  it('uses a generic message when the error response carries no detail', async () => {
    get.mockResolvedValue({ status: 500, data: '<html>Server Error</html>' });
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toBe('Failed to load accounts.');
  });

  it('treats a request that got no response at all as an error', async () => {
    // What the client resolves with on a network failure: undefined.
    get.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toBe('Failed to load accounts.');
    expect(result.current.accounts).toEqual([]);
  });

  it('treats a rejected request as an error', async () => {
    get.mockRejectedValue(new Error('refresh failed'));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toBe('Failed to load accounts.');
  });

  it('keeps no partial list when a later page fails', async () => {
    get
      .mockResolvedValueOnce(ok(rows(ORG_A, 0, 200), 250, NEXT))
      .mockResolvedValueOnce({ status: 429, data: { detail: 'Request was throttled.' } });
    const { result } = renderHook(() => useAllAccounts('staff', ORG_A));
    await settled(result);
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBe('Request was throttled.');
    expect(result.current.accounts).toEqual([]);
  });

  it('treats a null result as a cancellation, not an error', async () => {
    // What the client resolves with for a cancelled request: null.
    const pending = deferred();
    get.mockImplementation(() => pending.promise);
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await act(async () => {
      pending.resolve(null);
      await pending.promise;
    });
    expect(result.current.error).toBeNull();
    expect(result.current.accounts).toEqual([]);
  });

  it('fails the whole load when a row belongs to another org', async () => {
    const mixed = [...rows(ORG_A, 0, 2), row(ORG_B, 2)];
    get.mockResolvedValue(ok(mixed, 3, null));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toMatch(/different organization/);
    expect(result.current.accounts).toEqual([]);
  });

  it('fails when the server answers for a different org altogether', async () => {
    // The stale-header case: the hook asked for A, the response is all B.
    get.mockResolvedValue(ok(rows(ORG_B, 0, 3), 3, null));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toMatch(/different organization/);
    expect(result.current.accounts).toEqual([]);
  });

  it('fails when the rows collected do not add up to `count`', async () => {
    get.mockResolvedValue(ok(rows(ORG_A, 0, 3), 4, null));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toMatch(/changed while it was loading/);
    expect(result.current.accounts).toEqual([]);
  });

  it('fails when the same account arrives on two pages', async () => {
    // The total agrees with `count`, yet one account is doubled — which is how
    // a list that shifted between page requests hides another account.
    get
      .mockResolvedValueOnce(ok(rows(ORG_A, 0, 2), 4, NEXT))
      .mockResolvedValueOnce(ok(rows(ORG_A, 1, 2), 4, null));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toMatch(/changed while it was loading/);
    expect(result.current.accounts).toEqual([]);
  });

  it('fails on a body that is not the paginated envelope', async () => {
    get.mockResolvedValue({ status: 200, data: rows(ORG_A, 0, 2) });
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);
    expect(result.current.error).toBe('Failed to load accounts.');
  });
});

describe('children', () => {
  it('lists an account once when it is both a flat row and inside the children of its parent', async () => {
    const child = row(ORG_A, 10);
    const parent = row(ORG_A, 0, {
      children: [{ id: child.id, code: child.code, name: child.name, type: 'asset' }],
    });
    // The server's flat list: the parent (carrying the child) AND the child.
    get.mockResolvedValue(ok([parent, { ...child, parent_account_id: parent.id }], 2, null));
    const { result } = renderHook(() => useAllAccounts('owner', ORG_A));
    await settled(result);

    expect(result.current.accounts.map((acc) => acc.id)).toEqual([parent.id, child.id]);
    // Only the six picker fields are kept — `children` is never carried over.
    for (const acc of result.current.accounts) {
      expect(Object.keys(acc).sort()).toEqual([
        'code',
        'id',
        'is_active',
        'name',
        'org_id',
        'type',
      ]);
    }
  });
});

describe('refetch', () => {
  it('reloads under the same key and keeps the list it already has meanwhile', async () => {
    const second = deferred();
    get
      .mockImplementationOnce(() => Promise.resolve(ok(rows(ORG_A, 0, 2), 2, null)))
      .mockImplementationOnce(() => second.promise);
    const { result } = renderHook(() => useAllAccounts('staff', ORG_A));
    await settled(result);
    expect(result.current.accounts).toHaveLength(2);

    act(() => result.current.refetch());
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    expect(result.current.accounts).toHaveLength(2);

    await act(async () => {
      second.resolve(ok(rows(ORG_A, 0, 3), 3, null));
      await second.promise;
    });
    await settled(result);
    expect(result.current.accounts).toHaveLength(3);
  });

  it('drops the list when the reload fails', async () => {
    get
      .mockResolvedValueOnce(ok(rows(ORG_A, 0, 2), 2, null))
      .mockResolvedValueOnce({ status: 500, data: null });
    const { result } = renderHook(() => useAllAccounts('staff', ORG_A));
    await settled(result);
    expect(result.current.accounts).toHaveLength(2);

    act(() => result.current.refetch());
    await settled(result);
    expect(result.current.error).toBe('Failed to load accounts.');
    expect(result.current.accounts).toEqual([]);
  });
});
