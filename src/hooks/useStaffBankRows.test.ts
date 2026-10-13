// Staff bank rows API (S87 B2b U1, O-S87-2 / O-S87-3): the list's query
// string, the merge and release-flag requests against the backend contract
// (accounting/bank_review_views.py, accounting/bank_duplicate_views.py), and
// how a refusal comes back.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  BANK_ROW_TICKET_STATUSES,
  BANK_ROW_TICKET_STATUS_LABELS,
  NO_DOCUMENT_NOTE_MAX,
  NO_DOCUMENT_REASONS,
  REOPEN_REASON_MAX,
  bankRowParams,
  labelOrCode,
  markNoDocument,
  mergeBankRow,
  releaseBankRowFlag,
  reopenBankRow,
  type BankMergePlan,
  type BankNoDocumentPlan,
  type BankReleasePlan,
  type BankReopenPlan,
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

// Release C2: the plan of "no document needed", exactly as the server sends it
// (accounting/bank_ticket_service.py NoDocumentPlan._image).
const NO_DOCUMENT_URL = `/api/accounting/staff/bank-rows/${SURVIVING}/no-document/`;
const NO_DOCUMENT_PLAN: BankNoDocumentPlan = {
  row_id: SURVIVING,
  row: { date: '2026-09-20', direction: 'money_out', amount: '80.00', currency: 'CAD' },
  ticket: {
    before: { status: 'waiting_document', routing_reason: null },
    after: { status: 'no_document_needed', routing_reason: 'other' },
  },
  reason: 'other',
  reason_label: 'Other',
  note: 'Paid in cash',
  entry: {
    entry_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    entry_number: 68,
    entry_date: '2026-09-21',
  },
  matched: { match_id: 'mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm', state: 'auto_matched' },
};

// The plan of a reopen (accounting/bank_ticket_service.py ReopenPlan._image).
const REOPEN_URL = `/api/accounting/staff/bank-rows/${SURVIVING}/reopen/`;
const REOPEN_PLAN: BankReopenPlan = {
  row_id: SURVIVING,
  row: { date: '2026-09-20', direction: 'money_out', amount: '80.00', currency: 'CAD' },
  ticket: {
    before: { status: 'no_document_needed', routing_reason: 'bank_fee' },
    after: { status: 'waiting_document', routing_reason: null },
  },
  reason: 'Receipt turned up',
  entry: {
    entry_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    entry_number: 68,
    entry_date: '2026-09-21',
  },
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

// Release C2 (O-S88-3): POST staff/bank-rows/<id>/no-document/
// {reason, note?, confirm} — a dry run unless confirm is true.
describe('close a ticket: no document needed', () => {
  it('asks for the plan first: the reason and the note in the body, confirm false', async () => {
    post.mockResolvedValue(ok(false, NO_DOCUMENT_PLAN));

    const outcome = await markNoDocument(SURVIVING, 'other', '  Paid in cash  ', false);

    expect(post).toHaveBeenCalledTimes(1);
    // The note travels trimmed, as the server would store it.
    expect(post).toHaveBeenCalledWith(NO_DOCUMENT_URL, {
      reason: 'other',
      note: 'Paid in cash',
      confirm: false,
    });
    expect(outcome).toEqual({ ok: true, executed: false, plan: NO_DOCUMENT_PLAN });
  });

  it('confirms with the same reason and note and confirm true', async () => {
    post.mockResolvedValue(ok(true, NO_DOCUMENT_PLAN));

    const outcome = await markNoDocument(SURVIVING, 'other', 'Paid in cash', true);

    expect(post).toHaveBeenCalledWith(NO_DOCUMENT_URL, {
      reason: 'other',
      note: 'Paid in cash',
      confirm: true,
    });
    expect(outcome).toEqual({ ok: true, executed: true, plan: NO_DOCUMENT_PLAN });
  });

  it('leaves the note out of the body when it is blank', async () => {
    post.mockResolvedValue(ok(false, NO_DOCUMENT_PLAN));

    await markNoDocument(SURVIVING, 'bank_fee', '', false);
    expect(post).toHaveBeenLastCalledWith(NO_DOCUMENT_URL, { reason: 'bank_fee', confirm: false });

    await markNoDocument(SURVIVING, 'bank_fee', '   ', true);
    expect(post).toHaveBeenLastCalledWith(NO_DOCUMENT_URL, { reason: 'bank_fee', confirm: true });
  });

  it('hands back a refusal with the server code and its own words', async () => {
    const detail = 'This row is not waiting for a document.';
    post.mockResolvedValue({ status: 409, data: { code: 'not_waiting_document', detail } });

    const outcome = await markNoDocument(SURVIVING, 'bank_fee', '', true);

    expect(outcome).toEqual({
      ok: false,
      refusal: {
        status: 409,
        code: 'not_waiting_document',
        detail,
        context: { code: 'not_waiting_document', detail },
      },
    });
  });

  it("hands back the server's words when it turns the reason or the note down", async () => {
    // A 400 names the field, with no code: the message is what staff read.
    post.mockResolvedValueOnce({ status: 400, data: { note: 'The reason "other" needs a note.' } });
    const noNote = await markNoDocument(SURVIVING, 'other', '', false);
    expect(noNote).toEqual({
      ok: false,
      refusal: {
        status: 400,
        code: undefined,
        detail: 'The reason "other" needs a note.',
        context: { note: 'The reason "other" needs a note.' },
      },
    });

    const reasons =
      'Must be one of: bank_fee, interest, transfer, card_payment, loan, tax_remittance, other.';
    post.mockResolvedValueOnce({ status: 400, data: { reason: reasons } });
    const badReason = await markNoDocument(SURVIVING, 'rent', '', false);
    expect(badReason).toMatchObject({ ok: false, refusal: { status: 400, detail: reasons } });
  });

  it("names the seven staff reasons in the server's order, each with its label for the picker", () => {
    // accounting/bank_ticket_service.py STAFF_REASONS, with the labels of
    // accounting/bank_ticket_labels.py.
    expect(NO_DOCUMENT_REASONS).toEqual([
      { code: 'bank_fee', label: 'Bank fee' },
      { code: 'interest', label: 'Interest' },
      { code: 'transfer', label: 'Transfer between own accounts' },
      { code: 'card_payment', label: 'Card payment' },
      { code: 'loan', label: 'Loan' },
      { code: 'tax_remittance', label: 'Tax remittance' },
      { code: 'other', label: 'Other' },
    ]);
    expect(NO_DOCUMENT_NOTE_MAX).toBe(200);
  });
});

// Release C2 (O-S88-3): POST staff/bank-rows/<id>/reopen/ {reason, confirm} —
// super users only; the server answers anyone else with its 404.
describe('reopen a ticket closed as no document needed', () => {
  it('asks for the plan first: the reason in the body, confirm false', async () => {
    post.mockResolvedValue(ok(false, REOPEN_PLAN));

    const outcome = await reopenBankRow(SURVIVING, '  Receipt turned up ', false);

    expect(post).toHaveBeenCalledTimes(1);
    // The reason travels trimmed, as the server would record it.
    expect(post).toHaveBeenCalledWith(REOPEN_URL, { reason: 'Receipt turned up', confirm: false });
    expect(outcome).toEqual({ ok: true, executed: false, plan: REOPEN_PLAN });
  });

  it('confirms with the same reason and confirm true', async () => {
    post.mockResolvedValue(ok(true, REOPEN_PLAN));

    const outcome = await reopenBankRow(SURVIVING, 'Receipt turned up', true);

    expect(post).toHaveBeenCalledWith(REOPEN_URL, { reason: 'Receipt turned up', confirm: true });
    expect(outcome).toEqual({ ok: true, executed: true, plan: REOPEN_PLAN });
    expect(REOPEN_REASON_MAX).toBe(200);
  });

  it('hands back a refusal with the server code and its own words', async () => {
    const detail = 'This row is not closed as "no document needed".';
    post.mockResolvedValue({ status: 409, data: { code: 'not_no_document_needed', detail } });

    const outcome = await reopenBankRow(SURVIVING, 'Receipt turned up', true);

    expect(outcome).toEqual({
      ok: false,
      refusal: {
        status: 409,
        code: 'not_no_document_needed',
        detail,
        context: { code: 'not_no_document_needed', detail },
      },
    });
  });

  it('reports a 404 as not found, whoever asked, and invents no plan', async () => {
    // A reviewer, a row of another client and a row that is gone all get the
    // same answer from the server; nothing here tells them apart.
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });

    const outcome = await reopenBankRow(SURVIVING, 'Receipt turned up', false);

    expect(outcome).toEqual({
      ok: false,
      refusal: { status: 404, detail: 'Not found', context: { detail: 'Not found.' } },
    });
  });
});
