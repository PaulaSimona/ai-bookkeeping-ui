// Staff tax review hooks (S98 P1d item 1): the list's fixed filter, the file
// read (ready / gone / error / reload) and the decision's dry run and confirm
// run against the backend contract (accounting/tax_review_views.py). Every
// fixture is invented.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  confirmBody,
  useStaffTaxDecision,
  useStaffTaxReviewFile,
  useStaffTaxReviewList,
  type TaxDecisionBody,
  type TaxReviewFile,
} from './useStaffTaxReview';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ROW = '22222222-2222-4222-8222-222222222222';
const ORG = '11111111-1111-4111-8111-111111111111';
const FILE_URL = `/api/accounting/staff/bank-rows/${ROW}/tax-review/`;

const FILE: TaxReviewFile = {
  org_id: ORG,
  itc_accounts: [],
  bank_row: { id: ROW, date: '2026-03-02', direction: 'money_out', amount: '113.00', description: 'INVENTED SUPPLY CO' },
  ticket: null,
  in_tax_review: true,
  open_conditions: [],
  closed_conditions: [],
  document_id: null,
  extraction: null,
  guard: null,
  bank_matches: [],
  entry_chain: [],
  current_treatment: [],
  live_adjustment_entry_id: null,
  dates: {
    transaction_date: '2026-03-02',
    original_tax_period: null,
    adjustment_date: null,
    adjustment_tax_period: null,
    locked_through_date: null,
    adjustment_date_locked: false,
  },
  audit_history: [],
  receipt: null,
};

const BODY: TaxDecisionBody = {
  decision: 'B',
  kinds: ['tax_unverified'],
  reason: 'Receipt checked against the bank row.',
};

const PLAN = { decision: 'B', outcome: 'no_entry', kinds: ['tax_unverified'] };

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('the tax-review list', () => {
  it('asks the bank list for the rows in tax review: tax_review=1', async () => {
    get.mockResolvedValue({ status: 200, data: { count: 0, next: null, previous: null, results: [] } });

    const { result } = renderHook(() => useStaffTaxReviewList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/accounting/review/bank/', {
      params: { tax_review: '1', page: 1, page_size: 50 },
    });
  });

  it('reports a resolved error response as an error, not as an empty list', async () => {
    get.mockResolvedValue({ status: 403, data: { detail: 'Not allowed.' } });

    const { result } = renderHook(() => useStaffTaxReviewList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Not allowed.');
    expect(result.current.items).toEqual([]);
  });
});

describe('the tax-review file', () => {
  it('reads the file of its row once and hands it back', async () => {
    get.mockResolvedValue({ status: 200, data: FILE });

    const { result } = renderHook(() => useStaffTaxReviewFile(ROW));
    expect(result.current.state).toEqual({ kind: 'loading' });
    await waitFor(() => expect(result.current.state.kind).toBe('ready'));

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(FILE_URL);
    expect(result.current.state).toEqual({ kind: 'ready', file: FILE });
    expect(result.current.reloading).toBe(false);
  });

  it('a 404 is "gone"', async () => {
    get.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });

    const { result } = renderHook(() => useStaffTaxReviewFile(ROW));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'gone' }));
  });

  it('checks the status: an error response, a 200 that is not a file and a lost connection are errors', async () => {
    get.mockResolvedValueOnce({ status: 500, data: { detail: 'boom' } });
    const first = renderHook(() => useStaffTaxReviewFile(ROW));
    await waitFor(() =>
      expect(first.result.current.state).toEqual({
        kind: 'error',
        message: 'Could not load the tax-review file.',
      }),
    );

    get.mockResolvedValueOnce({ status: 200, data: { detail: 'not a file' } });
    const second = renderHook(() => useStaffTaxReviewFile(ROW));
    await waitFor(() => expect(second.result.current.state.kind).toBe('error'));

    get.mockRejectedValueOnce(new Error('network down'));
    const third = renderHook(() => useStaffTaxReviewFile(ROW));
    await waitFor(() => expect(third.result.current.state.kind).toBe('error'));
  });

  it("a 429 shows the server's detail", async () => {
    get.mockResolvedValue({
      status: 429,
      data: { detail: 'Request was throttled. Expected available in 12 seconds.' },
    });

    const { result } = renderHook(() => useStaffTaxReviewFile(ROW));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        kind: 'error',
        message: 'Request was throttled. Expected available in 12 seconds.',
      }),
    );
  });

  it('reload reads the file again and keeps the one shown until the new one arrives', async () => {
    get.mockResolvedValueOnce({ status: 200, data: FILE });
    const { result } = renderHook(() => useStaffTaxReviewFile(ROW));
    await waitFor(() => expect(result.current.state.kind).toBe('ready'));

    const next = { ...FILE, in_tax_review: false };
    let release: (value: unknown) => void = () => undefined;
    get.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    act(() => result.current.reload());

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(result.current.reloading).toBe(true);
    expect(result.current.state).toEqual({ kind: 'ready', file: FILE });

    await act(async () => { release({ status: 200, data: next }); });
    await waitFor(() => expect(result.current.reloading).toBe(false));
    expect(result.current.state).toEqual({ kind: 'ready', file: next });
  });
});

describe('the tax decision', () => {
  it('a preview posts the body alone — no confirm, token or key — and keeps the preview token', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { executed: false, plan: PLAN, preview_token: 'tok-invented-1' },
    });
    const { result } = renderHook(() => useStaffTaxDecision(ROW));

    const outcome = await result.current.preview(BODY);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(FILE_URL, BODY);
    expect(outcome).toEqual({ ok: true, executed: false, plan: PLAN, previewToken: 'tok-invented-1' });
  });

  it('a confirm posts the same body with confirm, the token and the key', async () => {
    post.mockResolvedValue({ status: 200, data: { executed: true, plan: PLAN } });
    const { result } = renderHook(() => useStaffTaxDecision(ROW));

    const outcome = await result.current.confirm(BODY, 'tok-invented-1', 'key-invented-1');

    expect(post).toHaveBeenCalledWith(FILE_URL, {
      ...BODY,
      confirm: true,
      preview_token: 'tok-invented-1',
      idempotency_key: 'key-invented-1',
    });
    expect(outcome).toEqual({ ok: true, executed: true, plan: PLAN, previewToken: null });
  });

  it('confirmBody adds its three fields and changes nothing else', () => {
    const body: TaxDecisionBody = {
      decision: 'A',
      kinds: ['tax_unverified'],
      reason: 'Split per the receipt.',
      transaction_date: '2026-03-02',
      lines: [{ account_id: 'acc-1', amount: '100.00' }, { account_id: 'acc-2', amount: '13.00' }],
      tax_breakdown: [{ kind: 'hst', amount: '13.00', recoverable: true }],
    };
    const frozen = JSON.stringify(body);

    const sent = confirmBody(body, 't', 'k');

    expect(sent).toEqual({ ...body, confirm: true, preview_token: 't', idempotency_key: 'k' });
    expect(JSON.stringify(body)).toBe(frozen);
  });

  it('executed is true only when the server says so', async () => {
    post.mockResolvedValue({ status: 200, data: { executed: 'yes', plan: PLAN } });
    const { result } = renderHook(() => useStaffTaxDecision(ROW));

    expect(await result.current.confirm(BODY, 't', 'k')).toMatchObject({ ok: true, executed: false });
  });

  it('a 200 with no plan is not a success', async () => {
    post.mockResolvedValue({ status: 200, data: { executed: true } });
    const { result } = renderHook(() => useStaffTaxDecision(ROW));

    expect(await result.current.confirm(BODY, 't', 'k')).toMatchObject({ ok: false });
  });

  it('hands back a 409 with the server code and words, and a 400 with its field', async () => {
    const { result } = renderHook(() => useStaffTaxDecision(ROW));

    const detail = 'Something changed since this preview. Preview again, then confirm.';
    post.mockResolvedValueOnce({ status: 409, data: { code: 'preview_stale', detail } });
    expect(await result.current.confirm(BODY, 't', 'k')).toEqual({
      ok: false,
      refusal: { status: 409, code: 'preview_stale', detail, context: { code: 'preview_stale', detail } },
    });

    post.mockResolvedValueOnce({ status: 400, data: { reason: 'A reason is required.' } });
    expect(await result.current.preview(BODY)).toMatchObject({
      ok: false,
      refusal: { status: 400, context: { reason: 'A reason is required.' } },
    });
  });

  it("a 429 reads as the server's detail; not found and a lost connection invent nothing", async () => {
    const { result } = renderHook(() => useStaffTaxDecision(ROW));

    post.mockResolvedValueOnce({
      status: 429,
      data: { detail: 'Request was throttled. Expected available in 1800 seconds.' },
    });
    expect(await result.current.preview(BODY)).toMatchObject({
      ok: false,
      refusal: { status: 429, detail: 'Request was throttled. Expected available in 1800 seconds.' },
    });

    post.mockResolvedValueOnce({ status: 429, data: null });
    expect(await result.current.preview(BODY)).toMatchObject({
      ok: false,
      refusal: { status: 429, detail: 'The limit for this action has been reached. Try again later.' },
    });

    post.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    expect(await result.current.preview(BODY)).toMatchObject({
      ok: false,
      refusal: { status: 404, detail: 'Not found' },
    });

    // No answer at all: no status, so the caller can tell it from a refusal.
    post.mockRejectedValueOnce(new Error('network down'));
    expect(await result.current.preview(BODY)).toEqual({
      ok: false,
      refusal: { detail: 'Could not preview the decision.', context: {} },
    });
    post.mockResolvedValueOnce(undefined);
    expect(await result.current.confirm(BODY, 't', 'k')).toEqual({
      ok: false,
      refusal: { detail: 'Could not confirm the decision.', context: {} },
    });
  });
});
