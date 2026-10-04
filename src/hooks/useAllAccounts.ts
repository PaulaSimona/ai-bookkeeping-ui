// useAllAccounts (D-S84-6, D-S85-5) — loads EVERY active account of one org for
// the AccountPicker, page by page. The list endpoints cap a page at 200
// (backend AccountingPagination.max_page_size), so one request cannot be
// trusted to be complete; the older loaders that ask for a single page of 200
// silently truncate a larger chart.
//
// Fail closed. The hook exposes either the whole list or an error, never a
// partial list:
//   • any non-200 response                       → error
//   • still more pages after MAX_PAGES           → error
//   • rows collected ≠ the server's `count`      → error
//   • a row whose org_id is not the org asked for → error
//
// Org binding. The owner / accountant endpoint takes its org from the X-Org-Id
// header, and the api client's request interceptor OVERWRITES that header with
// the module-level active org on every accounting call (utils/api.tsx). A
// per-request header therefore cannot pin the org, so none is sent: the
// org_id check on every row is what proves the response is for the right org.
import { useCallback, useEffect, useState } from 'react';
import type { AxiosResponse } from 'axios';
import api from '@/utils/api';
import type { PickerAccount } from '@/types/account';

// owner and accountant share one endpoint; staff names the org in the path.
export type AccountsLane = 'owner' | 'accountant' | 'staff';

export const PAGE_SIZE = 200; // the server's maximum
export const MAX_PAGES = 10; // 2,000 accounts

const GENERIC_ERROR = 'Failed to load accounts.';

export class AccountsLoadError extends Error {}

const urlFor = (lane: AccountsLane, orgId: string): string =>
  lane === 'staff'
    ? `/api/accounting/staff/orgs/${orgId}/accounts/`
    : '/api/accounting/accounts/';

// The staff endpoint is active-only server-side and takes no filter; the
// owner / accountant endpoint returns inactive accounts unless told not to.
const paramsFor = (lane: AccountsLane, page: number) =>
  lane === 'staff'
    ? { page, page_size: PAGE_SIZE }
    : { page, page_size: PAGE_SIZE, active: true };

/* eslint-disable @typescript-eslint/no-explicit-any */
// Keep the six fields the picker uses. `children` is deliberately never read:
// a child account is already its own row in the flat list.
const toPickerAccount = (row: any, orgId: string): PickerAccount => {
  if (
    row == null ||
    typeof row.id !== 'string' ||
    typeof row.code !== 'string' ||
    typeof row.name !== 'string'
  ) {
    throw new AccountsLoadError(GENERIC_ERROR);
  }
  if (row.org_id !== orgId) {
    throw new AccountsLoadError(
      'The server returned accounts for a different organization. Reload the page and try again.',
    );
  }
  return {
    id: row.id,
    org_id: row.org_id,
    code: row.code,
    name: row.name,
    type: row.type,
    is_active: row.is_active,
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Resolves the complete list, or null when the load was cancelled. Throws
// AccountsLoadError for everything else — there is no partial result.
export const loadAllAccounts = async (
  lane: AccountsLane,
  orgId: string,
  signal: AbortSignal,
): Promise<PickerAccount[] | null> => {
  const url = urlFor(lane, orgId);
  const rows: PickerAccount[] = [];

  // Pages are requested by number. `next` is read only as "there is more" —
  // its absolute URL is never followed.
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // The client's declared return type hides what its response interceptor
    // really resolves with, so spell it out.
    const res = (await api.get(url, {
      params: paramsFor(lane, page),
      signal,
    })) as AxiosResponse | null | undefined;

    // The response interceptor resolves a cancelled request to null. That is
    // a cancellation, not a failure.
    if (signal.aborted || res === null) return null;

    // Other HTTP errors RESOLVE with the error response (and a request that
    // got no response at all resolves undefined), so status-check everything.
    if (res === undefined || res.status !== 200) {
      const detail = res?.data?.detail;
      throw new AccountsLoadError(
        typeof detail === 'string' && detail ? detail : GENERIC_ERROR,
      );
    }

    const data = res.data;
    if (
      data == null ||
      !Array.isArray(data.results) ||
      typeof data.count !== 'number'
    ) {
      throw new AccountsLoadError(GENERIC_ERROR);
    }
    for (const row of data.results) rows.push(toPickerAccount(row, orgId));

    if (data.next == null) {
      // Complete only if every row the server counted arrived exactly once.
      // A duplicate id means the list shifted between page requests, which
      // can hide another account even when the totals happen to agree.
      const distinct = new Set(rows.map((r) => r.id)).size;
      if (rows.length !== data.count || distinct !== rows.length) {
        throw new AccountsLoadError(
          'The account list changed while it was loading. Please try again.',
        );
      }
      return rows;
    }
  }

  throw new AccountsLoadError(
    `Too many accounts to load (more than ${(MAX_PAGES * PAGE_SIZE).toLocaleString('en-CA')}).`,
  );
};

interface LoadState {
  key: string | null;
  status: 'loading' | 'ready' | 'error';
  accounts: PickerAccount[];
  error: string | null;
}

const NO_ACCOUNTS: PickerAccount[] = [];

export const useAllAccounts = (
  lane: AccountsLane,
  orgId: string | null | undefined,
) => {
  // The cache key. Nothing loaded under another key is ever exposed.
  const key = orgId ? `${lane}:${orgId}` : null;

  const [state, setState] = useState<LoadState>({
    key: null,
    status: 'loading',
    accounts: NO_ACCOUNTS,
    error: null,
  });
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!key || !orgId) return;
    // One controller per load: a key change or an unmount aborts whatever is
    // still in flight, and a late response for the old key is discarded.
    const controller = new AbortController();

    // A refetch of the SAME key keeps showing the list it already has (same
    // org, so nothing foreign can show). A new key starts from nothing.
    setState((prev) =>
      prev.key === key && prev.status === 'ready'
        ? { ...prev, status: 'loading' }
        : { key, status: 'loading', accounts: NO_ACCOUNTS, error: null },
    );

    loadAllAccounts(lane, orgId, controller.signal)
      .then((accounts) => {
        if (accounts === null || controller.signal.aborted) return;
        setState({ key, status: 'ready', accounts, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({
          key,
          status: 'error',
          accounts: NO_ACCOUNTS,
          error: err instanceof AccountsLoadError ? err.message : GENERIC_ERROR,
        });
      });

    return () => controller.abort();
  }, [key, lane, orgId, revision]);

  // Exposed only while the stored key is the current one. On an org switch
  // this is already false in the very render that carries the new org id,
  // before the effect above has run.
  const current = key !== null && state.key === key ? state : null;

  return {
    accounts: current?.accounts ?? NO_ACCOUNTS,
    loading: key !== null && (current === null || current.status === 'loading'),
    error: current?.status === 'error' ? current.error : null,
    refetch,
  };
};
