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
  collectFeeds,
  labelOrCode,
  markNoDocument,
  mergeBankRow,
  releaseBankRowFlag,
  reopenBankRow,
  MATCH_REASON_MAX,
  canDecideSuggestion,
  canManualMatch,
  canUnmatch,
  confirmBankMatch,
  fetchMatchCandidates,
  manualMatchBankRow,
  rejectBankMatch,
  unmatchBankRow,
  type BankMatchCandidate,
  type BankMatchPlan,
  type BankMergePlan,
  type BankNoDocumentPlan,
  type BankReleasePlan,
  type BankReopenPlan,
  type BankRow,
} from './useStaffBankRows';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

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

// Release C2 (N-S88-2): the feed filter's options are the feeds of the rows the
// list has shown — no endpoint lists the feeds a staff viewer may see.
describe('feeds seen in the list', () => {
  const OTHER_FEED = '0f0f0f0f-0000-4000-8000-00000000000f';

  // A row as the list sends it, on the given feed.
  const rowOn = (id: string, feed: string, name: string | null, mask: string | null): BankRow => ({
    id,
    org_id: '11111111-1111-4111-8111-111111111111',
    org_name: 'Acme Ltd',
    bank_account_id: feed,
    bank_account_name: name,
    feed_mask: mask,
    feed_account_code: '1010',
    date: '2026-09-20',
    direction: 'money_out',
    amount: '80.00',
    currency: 'CAD',
    counterparty_name: '',
    description: '',
    source: 'plaid',
    suggested_match: null,
    settled_match: null,
    row_kind: 'unmatched',
    pending: false,
    excluded: false,
    excluded_reason: '',
    ticket_status: 'pending',
    ticket_status_label: 'Pending',
    routing_reason: null,
    routing_reason_label: null,
    resolution_note: null,
    duplicate_sibling: null,
  });

  it('collects each feed once from the rows it has seen, in the order first seen', () => {
    const feeds = collectFeeds(
      [],
      [
        rowOn(STALE, FEED, 'Business Mastercard', '3277'),
        rowOn(SURVIVING, OTHER_FEED, 'Operating Chequing', null),
        rowOn('cccccccc-cccc-4ccc-8ccc-cccccccccccc', FEED, 'Business Mastercard', '3277'),
      ],
    );

    expect(feeds).toEqual([
      { id: FEED, name: 'Business Mastercard', mask: '3277', orgName: 'Acme Ltd' },
      { id: OTHER_FEED, name: 'Operating Chequing', mask: null, orgName: 'Acme Ltd' },
    ]);
  });

  it('keeps the feeds it already knows when a later page has none of them', () => {
    const first = collectFeeds([], [rowOn(STALE, FEED, 'Business Mastercard', '3277')]);

    // A page narrowed to another feed adds that feed and drops nothing.
    const second = collectFeeds(first, [rowOn(SURVIVING, OTHER_FEED, 'Operating Chequing', null)]);
    expect(second.map((feed) => feed.id)).toEqual([FEED, OTHER_FEED]);

    // An empty page, or one with nothing new, leaves the very same list.
    expect(collectFeeds(second, [])).toBe(second);
    expect(collectFeeds(second, [rowOn(STALE, FEED, 'Renamed since', '0000')])).toBe(second);
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

// ─── Match actions (Release D2; backend Release D1, O-S89-4 / O-S89-5) ─────────

const ROW = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LINE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ENTRY = '99999999-9999-4999-8999-999999999999';
const MATCH_URL = (action: string) => `/api/accounting/staff/bank-rows/${ROW}/match/${action}/`;
const CANDIDATES_URL = `/api/accounting/staff/bank-rows/${ROW}/match-candidates/`;

// A plan exactly as the server sends it (bank_match_actions.py
// MatchActionPlan._image).
const MATCH_PLAN: BankMatchPlan = {
  action: 'confirm',
  row_id: ROW,
  row: { date: '2026-09-20', direction: 'money_out', amount: '6.00', currency: 'CAD' },
  match: {
    match_id: 'c1c1c1c1-0000-4000-8000-000000000001',
    state: { before: 'suggested', after: 'confirmed' },
    journal_line_id: LINE,
    account_code: '1010',
    line_debit: null,
    line_credit: '6.00',
    entry: { entry_id: ENTRY, entry_number: 66, entry_date: '2026-09-19' },
  },
  ticket: {
    before: { status: 'needs_review', routing_reason: 'suggested_match_review' },
    after: { status: 'no_document_needed', routing_reason: 'account_rule' },
  },
  follow: 'account_rule',
  relink: null,
  reason: null,
  note: null,
  routing_reason_label: 'No-document account',
};

const CANDIDATE: BankMatchCandidate = {
  journal_line_id: LINE,
  entry: { entry_id: ENTRY, entry_number: 66, entry_date: '2026-09-19' },
  entry_description: 'Bank draft: fixture',
  entry_source: 'bank_feed',
  account_code: '1010',
  line_debit: null,
  line_credit: '6.00',
};

const row = (over: Partial<BankRow> = {}): BankRow => ({
  id: ROW,
  org_id: null,
  org_name: null,
  bank_account_id: FEED,
  bank_account_name: 'Chequing',
  feed_mask: '1234',
  feed_account_code: '1010',
  date: '2026-09-20',
  direction: 'money_out',
  amount: '6.00',
  currency: 'CAD',
  counterparty_name: '',
  description: '',
  source: 'plaid',
  suggested_match: null,
  settled_match: null,
  row_kind: 'unmatched',
  pending: false,
  excluded: false,
  excluded_reason: '',
  ticket_status: 'pending',
  ticket_status_label: 'Pending',
  routing_reason: null,
  routing_reason_label: null,
  resolution_note: null,
  duplicate_sibling: null,
  ...over,
});
const SUMMARY = {
  id: 'c1c1c1c1-0000-4000-8000-000000000001',
  state: 'suggested',
  similarity: '0.00',
  date_delta_days: 1,
  rationale: 'suggested',
  created_at: '2026-09-20T10:00:00Z',
  journal_line_id: LINE,
  entry_id: ENTRY,
  entry_date: '2026-09-19',
  entry_description: 'Bank draft',
  line_debit: null,
  line_credit: '6.00',
  account_code: '1010',
};

describe('match actions: confirm and reject a suggestion', () => {
  it('confirmBankMatch asks for the plan with confirm false, then confirms with confirm true', async () => {
    post.mockResolvedValueOnce(ok(false, MATCH_PLAN)).mockResolvedValueOnce(ok(true, MATCH_PLAN));

    expect(await confirmBankMatch(ROW, false)).toEqual({ ok: true, executed: false, plan: MATCH_PLAN });
    expect(await confirmBankMatch(ROW, true)).toEqual({ ok: true, executed: true, plan: MATCH_PLAN });

    expect(post.mock.calls).toEqual([
      [MATCH_URL('confirm'), { confirm: false }],
      [MATCH_URL('confirm'), { confirm: true }],
    ]);
  });

  it('rejectBankMatch sends the reason trimmed, and leaves it out when it is blank', async () => {
    post.mockResolvedValue(ok(false, { ...MATCH_PLAN, action: 'reject' }));

    await rejectBankMatch(ROW, '  not this entry ', false);
    await rejectBankMatch(ROW, '   ', true);

    expect(post.mock.calls).toEqual([
      [MATCH_URL('reject'), { reason: 'not this entry', confirm: false }],
      [MATCH_URL('reject'), { confirm: true }],
    ]);
    expect(MATCH_REASON_MAX).toBe(200);
  });

  it('hands back a refusal with the server code and its own words, and a 404 as not found', async () => {
    const detail = 'This journal line cannot be confirmed.';
    post.mockResolvedValueOnce({ status: 409, data: { code: 'line_not_live', detail } });
    expect(await confirmBankMatch(ROW, true)).toEqual({
      ok: false,
      refusal: { status: 409, code: 'line_not_live', detail, context: { code: 'line_not_live', detail } },
    });
    post.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    expect(await rejectBankMatch(ROW, '', false)).toEqual({
      ok: false,
      refusal: { status: 404, detail: 'Not found', context: { detail: 'Not found.' } },
    });
  });
});

describe('match actions: a match made by hand', () => {
  it('manualMatchBankRow sends the line and the trimmed note, and leaves the note out when blank', async () => {
    post.mockResolvedValue(ok(false, { ...MATCH_PLAN, action: 'manual_match' }));

    await manualMatchBankRow(ROW, LINE, '  by hand ', false);
    await manualMatchBankRow(ROW, LINE, '', true);

    expect(post.mock.calls).toEqual([
      [MATCH_URL('manual'), { journal_line_id: LINE, note: 'by hand', confirm: false }],
      [MATCH_URL('manual'), { journal_line_id: LINE, confirm: true }],
    ]);
  });

  it('fetchMatchCandidates hands back the candidates as sent, and a refusal otherwise', async () => {
    get.mockResolvedValueOnce({ status: 200, data: { row_id: ROW, candidates: [CANDIDATE] } });
    expect(await fetchMatchCandidates(ROW)).toEqual({ ok: true, candidates: [CANDIDATE] });
    expect(get).toHaveBeenCalledWith(CANDIDATES_URL);

    get.mockResolvedValueOnce({ status: 409, data: { code: 'row_pending', detail: 'Pending.' } });
    expect(await fetchMatchCandidates(ROW)).toEqual({
      ok: false,
      refusal: { status: 409, code: 'row_pending', detail: 'Pending.', context: { code: 'row_pending', detail: 'Pending.' } },
    });
    get.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    expect((await fetchMatchCandidates(ROW)) as { ok: boolean }).toMatchObject({ ok: false, refusal: { status: 404 } });
    get.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchMatchCandidates(ROW)).toMatchObject({ ok: false, refusal: { context: {} } });
  });
});

describe('match actions: unmatch (super users)', () => {
  it('unmatchBankRow sends the reason trimmed with confirm', async () => {
    post.mockResolvedValue(ok(true, { ...MATCH_PLAN, action: 'unmatch' }));

    const outcome = await unmatchBankRow(ROW, '  Wrong entry. ', true);

    expect(post).toHaveBeenCalledWith(MATCH_URL('unmatch'), { reason: 'Wrong entry.', confirm: true });
    expect(outcome).toEqual({ ok: true, executed: true, plan: { ...MATCH_PLAN, action: 'unmatch' } });
  });
});

describe('match actions: which rows offer which action', () => {
  it('canDecideSuggestion: a row with a suggested match, settled at the bank and in the books', () => {
    const suggested = row({ row_kind: 'suggested', suggested_match: SUMMARY });
    expect(canDecideSuggestion(suggested)).toBe(true);
    expect(canDecideSuggestion(row())).toBe(false);
    expect(canDecideSuggestion({ ...suggested, pending: true })).toBe(false);
    expect(canDecideSuggestion({ ...suggested, excluded: true })).toBe(false);
  });

  it('canManualMatch: an unmatched row, settled at the bank and in the books', () => {
    expect(canManualMatch(row())).toBe(true);
    expect(canManualMatch(row({ row_kind: 'suggested', suggested_match: SUMMARY }))).toBe(false);
    expect(canManualMatch(row({ row_kind: 'matched', settled_match: { ...SUMMARY, state: 'confirmed' } }))).toBe(false);
    expect(canManualMatch(row({ pending: true }))).toBe(false);
    expect(canManualMatch(row({ excluded: true }))).toBe(false);
  });

  it('canUnmatch: a row with a settled match that is in the books (who may is the caller\'s question)', () => {
    const settled = row({ row_kind: 'matched', settled_match: { ...SUMMARY, state: 'auto_matched' } });
    expect(canUnmatch(settled)).toBe(true);
    expect(canUnmatch(row())).toBe(false);
    expect(canUnmatch(row({ row_kind: 'suggested', suggested_match: SUMMARY }))).toBe(false);
    expect(canUnmatch({ ...settled, excluded: true })).toBe(false);
  });
});
