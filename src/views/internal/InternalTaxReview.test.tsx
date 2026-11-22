// InternalTaxReview (S98 P1d item 3): the staff list of bank rows that wait
// for a tax decision. Every value on screen is the server's own; the amount is
// its string. All fixtures are invented.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type TaxReviewRow } from '@/hooks/useStaffTaxReview';
import { InternalTaxReview } from './InternalTaxReview';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

type Params = Record<string, string | number | boolean>;
const get = api.get as unknown as Mock<
  (url: string, config?: { params?: Params }) => Promise<unknown>
>;

const LIST_URL = '/api/accounting/review/bank/';
const ORGS_URL = '/api/accounting/orgs/';
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const EMPTY = 'No bank rows are waiting for a tax decision.';
const LONG_EVIDENCE =
  'Receipt total 113.00 with tax 13.00 (HST); the tax kind could not be confirmed against the registration on file.';

const row = (over: Partial<TaxReviewRow>): TaxReviewRow => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  org_id: ORG_A,
  org_name: 'Maple Test Co',
  bank_account_id: 'f0000000-0000-4000-8000-000000000001',
  bank_account_name: 'Operating chequing',
  feed_mask: '000011114321',
  feed_account_code: '1010',
  date: '2026-11-03',
  direction: 'money_out',
  amount: '113.00',
  currency: 'CAD',
  counterparty_name: 'Invented Hardware',
  description: 'POS PURCHASE',
  source: 'plaid',
  suggested_match: null,
  settled_match: null,
  row_kind: 'matched',
  pending: false,
  excluded: false,
  excluded_reason: '',
  ticket_status: 'in_review',
  ticket_status_label: 'In review',
  routing_reason: 'tax_review',
  routing_reason_label: 'Tax review',
  resolution_note: null,
  duplicate_sibling: null,
  reported_amount: null,
  reported_direction: null,
  reported_date: null,
  reported_at: null,
  routed_from_status: null,
  routed_from_reason: null,
  tax_condition_kinds: ['tax_unverified', 'tax_unexplained_amount'],
  tax_condition_raised_at: '2026-11-04T15:30:00Z',
  tax_matched_document_id: 4101,
  tax_evidence_summary: LONG_EVIDENCE,
  ...over,
});

const FIRST = row({});
const SECOND = row({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  org_id: ORG_B,
  org_name: 'Birch Test Ltd',
  bank_account_name: 'Card feed',
  feed_mask: null,
  date: '2026-11-05',
  amount: '1250.10',
  tax_condition_kinds: ['tax_kind_not_recoverable'],
  tax_condition_raised_at: null,
  tax_matched_document_id: null,
  tax_evidence_summary: null,
});

const serve = (
  rows: TaxReviewRow[],
  { count, orgs = [{ id: ORG_A }] }: { count?: number; orgs?: unknown[] } = {},
) => {
  get.mockImplementation((url) => {
    if (url === ORGS_URL) return Promise.resolve({ status: 200, data: orgs });
    if (url === LIST_URL)
      return Promise.resolve({
        status: 200,
        data: { count: count ?? rows.length, next: null, previous: null, results: rows },
      });
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/internal/tax-review']}>
      <InternalTaxReview />
    </MemoryRouter>,
  );

const listCalls = () => get.mock.calls.filter(([url]) => url === LIST_URL);
const headings = () => screen.getAllByRole('columnheader').map((th) => th.textContent);
const rowOf = async (date: string) =>
  (await screen.findByRole('link', { name: new RegExp(date) })).closest('tr') as HTMLElement;
const cellsOf = (tr: HTMLElement) => within(tr).getAllByRole('cell');

beforeEach(() => {
  get.mockReset();
});

describe('InternalTaxReview — the read', () => {
  it('asks the bank list for tax_review=1, page 1', async () => {
    serve([FIRST]);
    renderPage();
    await rowOf('2026-11-03');
    expect(listCalls()).toHaveLength(1);
    expect(listCalls()[0][1]).toEqual({ params: { tax_review: '1', page: 1, page_size: 50 } });
  });

  it('shows a loading state until the list answers', async () => {
    let answer: (value: unknown) => void = () => {};
    get.mockImplementation((url) =>
      url === ORGS_URL
        ? Promise.resolve({ status: 200, data: [] })
        : new Promise((resolve) => {
            answer = resolve;
          }),
    );
    renderPage();
    expect(screen.getByText('Loading tax review…')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    answer({ status: 200, data: { count: 0, next: null, previous: null, results: [] } });
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByText('Loading tax review…')).not.toBeInTheDocument();
  });

  it('says so when nothing waits', async () => {
    serve([]);
    renderPage();
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server error with a retry that reads again', async () => {
    get.mockImplementation((url) =>
      Promise.resolve(
        url === ORGS_URL
          ? { status: 200, data: [] }
          : { status: 403, data: { detail: 'Invented refusal.' } },
      ),
    );
    renderPage();
    expect(await screen.findByText('Invented refusal.')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    serve([FIRST]);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await rowOf('2026-11-03');
    expect(screen.queryByText('Invented refusal.')).not.toBeInTheDocument();
  });
});

describe('InternalTaxReview — the columns', () => {
  it('lists every column for a one-org viewer, without Org', async () => {
    serve([FIRST, SECOND]);
    renderPage();
    await rowOf('2026-11-03');
    expect(headings()).toEqual([
      'Date',
      'Feed',
      'Amount',
      'Kinds',
      'Held since',
      'Receipt',
      'Evidence',
    ]);
  });

  it('adds the Org column for a viewer of several orgs', async () => {
    serve([FIRST, SECOND], { orgs: [{ id: ORG_A }, { id: ORG_B }] });
    renderPage();
    await waitFor(() => expect(headings()).toContain('Org'));
    expect(headings()[1]).toBe('Org');
    const cells = cellsOf(await rowOf('2026-11-03'));
    expect(cells[1]).toHaveTextContent('Maple Test Co');
    expect(cells[1]).toHaveTextContent('11111111');
    expect(cellsOf(await rowOf('2026-11-05'))[1]).toHaveTextContent('Birch Test Ltd');
  });

  it('fills each cell from the row, the amount as the server sent it', async () => {
    serve([FIRST, SECOND]);
    renderPage();
    const first = cellsOf(await rowOf('2026-11-03'));
    expect(within(first[0]).getByRole('link')).toHaveAttribute(
      'href',
      `/internal/tax-review/${FIRST.id}`,
    );
    // Feed: the name and the last four digits, never more of the mask.
    expect(first[1]).toHaveTextContent('Operating chequing ····4321');
    expect(first[1].textContent).not.toContain('0000');
    expect(first[2]).toHaveTextContent('Money out 113.00 CAD');
    expect(within(first[3]).getByText('Tax unverified')).toBeInTheDocument();
    expect(within(first[3]).getByText('Unexplained amount')).toBeInTheDocument();
    expect(first[4]).toHaveTextContent('2026-11-04');
    expect(first[5]).toHaveTextContent('Yes');
    // Evidence: cut short by the layout, whole in the tooltip.
    const evidence = within(first[6]).getByText(LONG_EVIDENCE);
    expect(evidence).toHaveAttribute('title', LONG_EVIDENCE);
    expect(evidence.className).toContain('truncate');

    const second = cellsOf(await rowOf('2026-11-05'));
    expect(second[1]).toHaveTextContent('Card feed');
    expect(second[2]).toHaveTextContent('1250.10 CAD');
    expect(within(second[3]).getByText('Tax kind not recoverable')).toBeInTheDocument();
    expect(second[4]).toHaveTextContent('—');
    expect(second[5]).toHaveTextContent('No');
    expect(second[6]).toHaveTextContent('—');
  });

  it('shows a kind it does not know rather than hiding it', async () => {
    serve([row({ tax_condition_kinds: ['tax_invented_kind'] })]);
    renderPage();
    expect(within(cellsOf(await rowOf('2026-11-03'))[3]).getByText('Tax Invented Kind')).toBeInTheDocument();
  });
});

describe('InternalTaxReview — pages', () => {
  it('pages as the bank list does', async () => {
    serve([FIRST], { count: 120 });
    renderPage();
    await rowOf('2026-11-03');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toEqual({
        params: { tax_review: '1', page: 2, page_size: 50 },
      }),
    );
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('shows no pager for a single page', async () => {
    serve([FIRST]);
    renderPage();
    await rowOf('2026-11-03');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
