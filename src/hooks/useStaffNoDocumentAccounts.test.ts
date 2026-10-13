// A client's "no document" accounts (Release C2 U7; backend Release C1,
// O-S88-4): the list's request, the mark and unmark requests against the
// backend contract (accounting/bank_ticket_views.py
// StaffOrgNoDocumentAccountsView), and how an answer or a refusal comes back.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  setNoDocumentAccount,
  useStaffNoDocumentAccounts,
  type NoDocumentAccount,
} from './useStaffNoDocumentAccounts';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const URL = `/api/accounting/staff/orgs/${ORG}/no-document-accounts/`;

const FEES: NoDocumentAccount = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: '5700',
  name: 'Bank Charges',
  no_document: false,
};
const INTEREST: NoDocumentAccount = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  code: '5710',
  name: 'Interest Expense',
  no_document: true,
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("a client's no-document accounts: the list", () => {
  it("reads the org's expense accounts from its own URL, a page at a time", async () => {
    get.mockResolvedValue({
      status: 200,
      data: { count: 73, next: null, previous: null, results: [FEES, INTEREST] },
    });

    const { result } = renderHook(() => useStaffNoDocumentAccounts(ORG));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(URL, { params: { page: 1, page_size: 50 } });
    expect(result.current.items).toEqual([FEES, INTEREST]);
    // The server's count, not the rows on the page.
    expect(result.current.count).toBe(73);
    expect(result.current.error).toBeNull();
  });
});

describe("a client's no-document accounts: mark and unmark", () => {
  it('marks an account: its id and no_document true in the body', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { account: { ...FEES, no_document: true }, changed: true },
    });

    await setNoDocumentAccount(ORG, FEES.id, true);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(URL, { account_id: FEES.id, no_document: true });
  });

  it('unmarks an account: no_document false', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { account: { ...INTEREST, no_document: false }, changed: true },
    });

    await setNoDocumentAccount(ORG, INTEREST.id, false);

    expect(post).toHaveBeenCalledWith(URL, { account_id: INTEREST.id, no_document: false });
  });

  it('hands back the account and whether anything changed, as the server said', async () => {
    // Already marked: the server says so, and that nothing changed.
    const marked = { ...FEES, no_document: true };
    post.mockResolvedValueOnce({ status: 200, data: { account: marked, changed: false } });
    expect(await setNoDocumentAccount(ORG, FEES.id, true)).toEqual({
      ok: true,
      account: marked,
      changed: false,
    });

    post.mockResolvedValueOnce({ status: 200, data: { account: marked, changed: true } });
    expect(await setNoDocumentAccount(ORG, FEES.id, true)).toEqual({
      ok: true,
      account: marked,
      changed: true,
    });

    // The mark is the server's, never the one that was asked for.
    post.mockResolvedValueOnce({ status: 200, data: { account: FEES, changed: false } });
    const outcome = await setNoDocumentAccount(ORG, FEES.id, true);
    expect(outcome).toMatchObject({ ok: true, account: { no_document: false }, changed: false });

    // A 200 that does not say how the account stands is not a success.
    post.mockResolvedValueOnce({ status: 200, data: { changed: true } });
    expect(await setNoDocumentAccount(ORG, FEES.id, true)).toMatchObject({ ok: false });
  });

  it('hands back a refusal with the server code and its own words', async () => {
    const detail = 'This account is inactive.';
    post.mockResolvedValue({ status: 409, data: { code: 'account_inactive', detail } });

    const outcome = await setNoDocumentAccount(ORG, FEES.id, true);

    expect(outcome).toEqual({
      ok: false,
      refusal: {
        status: 409,
        code: 'account_inactive',
        detail,
        context: { code: 'account_inactive', detail },
      },
    });
  });

  it('reports not found, the hourly limit and a lost connection without inventing an answer', async () => {
    post.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    expect(await setNoDocumentAccount(ORG, FEES.id, true)).toMatchObject({
      ok: false,
      refusal: { status: 404, detail: 'Not found' },
    });

    post.mockResolvedValueOnce({ status: 429, data: { detail: 'Request was throttled.' } });
    expect(await setNoDocumentAccount(ORG, FEES.id, true)).toMatchObject({
      ok: false,
      refusal: {
        status: 429,
        detail: 'The hourly limit for this action has been reached. Try again later.',
      },
    });

    post.mockRejectedValueOnce(new Error('network down'));
    expect(await setNoDocumentAccount(ORG, FEES.id, true)).toEqual({
      ok: false,
      refusal: { detail: 'Could not mark the account.', context: {} },
    });

    post.mockRejectedValueOnce(new Error('network down'));
    expect(await setNoDocumentAccount(ORG, INTEREST.id, false)).toEqual({
      ok: false,
      refusal: { detail: 'Could not remove the mark.', context: {} },
    });
  });
});
