// Staff bank rows API (S87 B2b U1, O-S87-2 / O-S87-3): the list's query
// string, the merge and release-flag requests against the backend contract
// (accounting/bank_review_views.py, accounting/bank_duplicate_views.py), and
// how a refusal comes back.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  BANK_ROW_TICKET_STATUSES,
  BANK_ROW_TICKET_STATUS_LABELS,
  bankRowParams,
  labelOrCode,
  mergeBankRow,
  releaseBankRowFlag,
  type BankMergePlan,
  type BankReleasePlan,
} from './useStaffBankRows';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const STALE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SURVIVING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FEED = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const MERGE_URL = `/api/accounting/staff/bank-rows/${STALE}/merge/`;
const RELEASE_URL = `/api/accounting/staff/bank-rows/${SURVIVING}/release-flag/`;

// The plans exactly as the server sends them (bank_duplicate_service.py
// MergePlan._image / ReleasePlan._image).
const MERGE_PLAN: BankMergePlan = {
  stale_row_id: STALE,
  surviving_row_id: SURVIVING,
  moves_match: {
    match_id: 'mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm',
    state: 'auto_matched',
    journal_line_id: 'llllllll-llll-4lll-8lll-llllllllllll',
    entry_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    entry_number: 68,
  },
  moves_entry: null,
  stale_ticket: null,
  surviving_ticket: {
    before: { status: 'needs_review', routing_reason: 'possible_duplicate_bank_row' },
    after: { status: 'documented', routing_reason: 'bank_duplicate_merged' },
  },
  excluded_reason: 'duplicate',
};

const RELEASE_PLAN: BankReleasePlan = {
  row_id: SURVIVING,
  sibling_id: STALE,
  ticket: {
    before: { status: 'needs_review', routing_reason: 'possible_duplicate_bank_row' },
    after: { status: 'pending', routing_reason: null },
  },
  matched: null,
};

const ok = (executed: boolean, plan: unknown) => ({ status: 200, data: { executed, plan } });

beforeEach(() => {
  post.mockReset();
});

describe('bank row list filters', () => {
  it('omits every filter that is not set', () => {
    expect(bankRowParams({})).toEqual({});
    expect(
      bankRowParams({
        ticketStatus: '',
        possibleDuplicate: false,
        bankAccountId: '',
        dateFrom: '',
        dateTo: '',
      }),
    ).toEqual({});
  });

  it('sends each set filter under the name the server reads', () => {
    expect(
      bankRowParams({
        ticketStatus: 'needs_review',
        possibleDuplicate: true,
        bankAccountId: FEED,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-05',
      }),
    ).toEqual({
      ticket_status: 'needs_review',
      possible_duplicate: '1',
      bank_account_id: FEED,
      date_from: '2026-10-01',
      date_to: '2026-10-05',
    });
    // One at a time: nothing else rides along.
    expect(bankRowParams({ possibleDuplicate: true })).toEqual({ possible_duplicate: '1' });
    expect(bankRowParams({ dateTo: '2026-10-05' })).toEqual({ date_to: '2026-10-05' });
  });
});

// Release C2 (N-S88-3): a status or a reason is shown by the server's label.
describe('ticket statuses and labels', () => {
  it("names the server's eight ticket statuses, each with its label for the filter", () => {
    // accounting/models.py BankTransactionAccountingState.Status, in its order.
    expect(BANK_ROW_TICKET_STATUSES).toEqual([
      'pending',
      'processing',
      'needs_review',
      'failed',
      'waiting_document',
      'documented',
      'closed',
      'no_document_needed',
    ]);
    expect(BANK_ROW_TICKET_STATUS_LABELS).toEqual({
      pending: 'Pending',
      processing: 'Processing',
      needs_review: 'Needs Review',
      failed: 'Failed',
      waiting_document: 'Waiting for Document',
      documented: 'Documented',
      closed: 'Closed',
      no_document_needed: 'No document needed',
    });
  });

  it("gives the server's label, the code as sent when there is none, and a dash when there is neither", () => {
    expect(labelOrCode('Waiting for Document', 'waiting_document')).toBe('Waiting for Document');
    // No label: the code, exactly as it was sent — never reworded here.
    expect(labelOrCode(null, 'needs_review')).toBe('needs_review');
    expect(labelOrCode(undefined, 'period_locked')).toBe('period_locked');
    expect(labelOrCode('', 'needs_review')).toBe('needs_review');
    expect(labelOrCode(null, null)).toBe('—');
    expect(labelOrCode(undefined, undefined)).toBe('—');
  });
});

describe('merge a duplicate bank row', () => {
  it('asks for the plan first: the stale row in the path, the row that stays in the body', async () => {
    post.mockResolvedValue(ok(false, MERGE_PLAN));

    const outcome = await mergeBankRow(STALE, SURVIVING, false);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(MERGE_URL, { surviving_row_id: SURVIVING, confirm: false });
    expect(outcome).toEqual({ ok: true, executed: false, plan: MERGE_PLAN });
  });

  it('confirms with the same request and confirm true', async () => {
    post.mockResolvedValue(ok(true, MERGE_PLAN));

    const outcome = await mergeBankRow(STALE, SURVIVING, true);

    expect(post).toHaveBeenCalledWith(MERGE_URL, { surviving_row_id: SURVIVING, confirm: true });
    expect(outcome).toEqual({ ok: true, executed: true, plan: MERGE_PLAN });
  });

  it('hands back a refusal with the server code and its own words', async () => {
    const detail =
      'The surviving row is still pending at the bank; work cannot move onto it until it settles.';
    post.mockResolvedValue({ status: 409, data: { code: 'surviving_pending', detail } });

    const outcome = await mergeBankRow(STALE, SURVIVING, true);

    expect(outcome).toEqual({
      ok: false,
      refusal: {
        status: 409,
        code: 'surviving_pending',
        detail,
        context: { code: 'surviving_pending', detail },
      },
    });
  });

  it('reports not found, the hourly limit and a lost connection without inventing a plan', async () => {
    post.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    const missing = await mergeBankRow(STALE, SURVIVING, false);
    expect(missing).toMatchObject({ ok: false, refusal: { status: 404, detail: 'Not found' } });

    post.mockResolvedValueOnce({ status: 429, data: { detail: 'Request was throttled.' } });
    const limited = await mergeBankRow(STALE, SURVIVING, false);
    expect(limited).toMatchObject({
      ok: false,
      refusal: {
        status: 429,
        detail: 'The hourly limit for this action has been reached. Try again later.',
      },
    });

    post.mockRejectedValueOnce(new Error('network down'));
    const lost = await mergeBankRow(STALE, SURVIVING, true);
    expect(lost).toEqual({ ok: false, refusal: { detail: 'Merge failed.', context: {} } });
  });
});

describe('release a possible-duplicate flag', () => {
  it('asks for the plan first with confirm false', async () => {
    post.mockResolvedValue(ok(false, RELEASE_PLAN));

    const outcome = await releaseBankRowFlag(SURVIVING, false);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(RELEASE_URL, { confirm: false });
    expect(outcome).toEqual({ ok: true, executed: false, plan: RELEASE_PLAN });
  });

  it('confirms with confirm true', async () => {
    post.mockResolvedValue(ok(true, RELEASE_PLAN));

    const outcome = await releaseBankRowFlag(SURVIVING, true);

    expect(post).toHaveBeenCalledWith(RELEASE_URL, { confirm: true });
    expect(outcome).toEqual({ ok: true, executed: true, plan: RELEASE_PLAN });
  });

  it('hands back a refusal with the server code and its own words', async () => {
    post.mockResolvedValue({
      status: 409,
      data: { code: 'not_flagged', detail: 'This row is not flagged as a possible duplicate.' },
    });

    const outcome = await releaseBankRowFlag(SURVIVING, true);

    expect(outcome).toMatchObject({
      ok: false,
      refusal: {
        status: 409,
        code: 'not_flagged',
        detail: 'This row is not flagged as a possible duplicate.',
      },
    });
  });
});
