// InternalBankRows (S87 B2b U3, O-S87-8): the staff bank-rows screen — every
// bank row waiting on staff, across the orgs the viewer may see. The list is
// what the server sent: amounts as its strings, bank text as plain text, a feed
// by its name and last four digits. The O-S87-3 filters are sent only when set,
// and a row opens beside the row it may be a copy of.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { BANK_ROW_TICKET_STATUSES, type BankRow } from '@/hooks/useStaffBankRows';
import { InternalBankRows } from './InternalBankRows';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn() } }));

type Params = Record<string, string | number | boolean>;
const get = api.get as unknown as Mock<
  (url: string, config?: { params?: Params }) => Promise<unknown>
>;

const ROWS_URL = '/api/accounting/review/bank/';
const ORGS_URL = '/api/accounting/orgs/';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const FEED = 'f1f1f1f1-0000-4000-8000-000000000001';
const FLAGGED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAIN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SIBLING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const ACME = { id: ORG_A, name: 'Acme Ltd' };
const BIRCH = { id: ORG_B, name: 'Birch Inc' };

// A row as the server sends it (bank_review_serializers.py BankRowSerializer).
const bankRow = (over: Partial<BankRow> = {}): BankRow => ({
  id: PLAIN_ID,
  org_id: ORG_A,
  org_name: 'Acme Ltd',
  bank_account_id: FEED,
  bank_account_name: 'Business Mastercard',
  feed_mask: '3277',
  feed_account_code: '2150',
  date: '2026-09-20',
  direction: 'money_in',
  amount: '80.00',
  currency: 'CAD',
  counterparty_name: 'Refund Co',
  description: 'REFUND 0042',
  source: 'plaid',
  suggested_match: null,
  row_kind: 'unmatched',
  pending: false,
  excluded: false,
  excluded_reason: '',
  ticket_status: 'pending',
  routing_reason: null,
  duplicate_sibling: null,
  ...over,
});

// A row intake flagged as a possible copy of a settled row, still pending at
// the bank, with a suggested match whose line amounts arrive as numbers.
const FLAGGED = bankRow({
  id: FLAGGED_ID,
  date: '2026-09-14',
  direction: 'money_out',
  amount: '1234.50',
  counterparty_name: 'Staples',
  description: 'STAPLES STORE #114 TORONTO',
  pending: true,
  ticket_status: 'needs_review',
  routing_reason: 'possible_duplicate_bank_row',
  row_kind: 'suggested',
  suggested_match: {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    state: 'suggested',
    similarity: '0.91',
    date_delta_days: 2,
    rationale: 'same amount, two days apart',
    created_at: '2026-09-15T10:00:00Z',
    journal_line_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    entry_id: '99999999-9999-4999-8999-999999999999',
    entry_date: '2026-09-12',
    entry_description: 'Office supplies',
    line_debit: 987.65,
    line_credit: 432.1,
    account_code: '5100',
  },
  duplicate_sibling: {
    id: SIBLING_ID,
    relation: 'flagged_against',
    date: '2026-09-13',
    direction: 'money_out',
    amount: '1234.50',
    currency: 'CAD',
    counterparty_name: 'Staples Canada',
    description: 'STAPLES #114',
    pending: false,
    excluded: false,
  },
});

const PLAIN = bankRow();

interface Served {
  rows?: BankRow[];
  count?: number;
  orgs?: { id: string; name: string }[];
}

// What the server answers: the viewer's orgs, and a page of rows.
const serve = ({ rows = [FLAGGED, PLAIN], count, orgs = [ACME] }: Served = {}) => {
  get.mockImplementation((url) => {
    if (url === ORGS_URL) return Promise.resolve({ status: 200, data: orgs });
    if (url === ROWS_URL) {
      return Promise.resolve({
        status: 200,
        data: { count: count ?? rows.length, next: null, previous: null, results: rows },
      });
    }
    return Promise.resolve({ status: 404, data: {} });
  });
};

// Every query the row list was asked with, in order.
const rowRequests = (): (Params | undefined)[] =>
  get.mock.calls.filter(([url]) => url === ROWS_URL).map(([, config]) => config?.params);
const lastRowRequest = () => rowRequests().at(-1);

// Lets every answered request reach the screen.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const headers = () => screen.getAllByRole('columnheader').map((th) => th.textContent);

// The list row that carries this bank text, and its cells.
const rowOf = async (description: string) =>
  (await screen.findByText(description)).closest('tr') as HTMLElement;
const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

beforeEach(() => {
  get.mockReset();
});

describe('bank rows list', () => {
  it('lists each row with its date, feed, direction and amount, bank text, ticket status, flags and routing reason', async () => {
    serve();
    render(<InternalBankRows />);

    const row = await rowOf('STAPLES STORE #114 TORONTO');
    await settle();
    expect(headers()).toEqual([
      'Date',
      'Feed',
      'Amount',
      'Bank text',
      'Ticket',
      'Flags',
      'Routing reason',
    ]);

    const [date, feed, amount, bankText, ticket, flags, reason] = within(row).getAllByRole('cell');
    expect(date.textContent).toBe('2026-09-14');
    expect(feed.textContent).toBe('Business Mastercard ····3277');
    expect(amount).toHaveTextContent('Money out');
    // The amount is the server's string: not regrouped, re-signed or given a symbol.
    expect(within(amount).getByText('1234.50 CAD')).toBeInTheDocument();
    expect(row).not.toHaveTextContent('1,234.50');
    expect(row).not.toHaveTextContent('$');
    expect(within(bankText).getByText('Staples')).toBeInTheDocument();
    expect(within(bankText).getByText('STAPLES STORE #114 TORONTO')).toBeInTheDocument();
    expect(ticket.textContent).toBe('Needs Review');
    expect(within(flags).getByText('Pending at bank')).toBeInTheDocument();
    expect(within(flags).getByText('Possible duplicate')).toBeInTheDocument();
    expect(reason.textContent).toBe('Possible Duplicate Bank Row');

    // A row with nothing to flag and no routing reason says so with a dash.
    const plain = cellsOf(await rowOf('REFUND 0042'));
    expect(plain[2]).toContain('Money in');
    expect(plain[2]).toContain('80.00 CAD');
    expect(plain.slice(4)).toEqual(['Pending', '—', '—']);
  });

  it("shows the org column only when the viewer's org list has more than one org", async () => {
    serve({ orgs: [ACME] });
    const single = render(<InternalBankRows />);
    await rowOf('REFUND 0042');
    await settle();
    expect(headers()).not.toContain('Org');
    single.unmount();

    serve({ orgs: [ACME, BIRCH] });
    render(<InternalBankRows />);
    const row = await rowOf('REFUND 0042');
    await settle();
    expect(headers()).toEqual([
      'Date',
      'Org',
      'Feed',
      'Amount',
      'Bank text',
      'Ticket',
      'Flags',
      'Routing reason',
    ]);
    const org = within(row).getAllByRole('cell')[1];
    expect(org).toHaveTextContent('Acme Ltd');
    expect(within(org).getByText('11111111')).toBeInTheDocument();
  });

  it('shows a feed by its name and last four digits, and never more of a mask than four', async () => {
    serve({
      rows: [
        bankRow({ description: 'FOUR DIGITS' }),
        bankRow({ id: FLAGGED_ID, description: 'LONG MASK', feed_mask: '9912345678' }),
        bankRow({
          id: SIBLING_ID,
          description: 'NO MASK',
          bank_account_name: 'Operating Chequing',
          feed_mask: null,
        }),
      ],
    });
    render(<InternalBankRows />);

    expect(cellsOf(await rowOf('FOUR DIGITS'))[1]).toBe('Business Mastercard ····3277');

    const long = await rowOf('LONG MASK');
    expect(cellsOf(long)[1]).toBe('Business Mastercard ····5678');
    expect(long).not.toHaveTextContent('991234');

    expect(cellsOf(await rowOf('NO MASK'))[1]).toBe('Operating Chequing');
  });

  it('shows bank text as plain text, markup and all', async () => {
    const description = '<img src=x onerror=alert(1)> <b>PAYMENT</b>';
    const counterparty = '<script>alert(1)</script>Evil & Co';
    serve({ rows: [bankRow({ description, counterparty_name: counterparty })] });
    const { container } = render(<InternalBankRows />);

    expect(await screen.findByText(description)).toBeInTheDocument();
    expect(screen.getByText(counterparty)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('says so when no row matches', async () => {
    serve({ rows: [] });
    render(<InternalBankRows />);

    expect(await screen.findByText('No bank rows')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows why the list could not be read, and reads it again on Retry', async () => {
    const user = userEvent.setup();
    const detail = 'Request was throttled. Expected available in 30 seconds.';
    get.mockImplementation((url) =>
      Promise.resolve(
        url === ORGS_URL ? { status: 200, data: [ACME] } : { status: 429, data: { detail } },
      ),
    );
    render(<InternalBankRows />);

    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(screen.queryByText('No bank rows')).not.toBeInTheDocument();

    serve();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('REFUND 0042')).toBeInTheDocument();
    expect(screen.queryByText(detail)).not.toBeInTheDocument();
  });
});

describe('bank rows filters and paging', () => {
  it('sends each set filter under the name the server reads, and leaves out the ones that are not set', async () => {
    const user = userEvent.setup();
    serve();
    render(<InternalBankRows />);
    await rowOf('REFUND 0042');

    // Nothing set: the page and its size, and no filter at all.
    expect(lastRowRequest()).toEqual({ page: 1, page_size: 50 });

    const status = screen.getByRole('combobox', { name: 'Ticket status' });
    expect(within(status).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual([
      '',
      ...BANK_ROW_TICKET_STATUSES,
    ]);

    await user.selectOptions(status, 'needs_review');
    await user.click(screen.getByRole('checkbox', { name: 'Possible duplicates only' }));
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-09-30' } });
    await settle();
    expect(lastRowRequest()).toEqual({
      ticket_status: 'needs_review',
      possible_duplicate: '1',
      date_from: '2026-09-01',
      date_to: '2026-09-30',
      page: 1,
      page_size: 50,
    });

    // Cleared again, a filter is left out — never sent empty.
    await user.selectOptions(status, '');
    await user.click(screen.getByRole('checkbox', { name: 'Possible duplicates only' }));
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '' } });
    await settle();
    expect(lastRowRequest()).toEqual({ date_to: '2026-09-30', page: 1, page_size: 50 });
  });

  it('pages through the list fifty rows at a time', async () => {
    const user = userEvent.setup();
    serve({ count: 120 });
    render(<InternalBankRows />);
    await rowOf('REFUND 0042');

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(lastRowRequest()).toEqual({ page: 2, page_size: 50 });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument();
    expect(lastRowRequest()).toEqual({ page: 3, page_size: 50 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(lastRowRequest()).toEqual({ page: 2, page_size: 50 });
  });

  it('goes back to the first page when a filter changes', async () => {
    const user = userEvent.setup();
    serve({ count: 120 });
    render(<InternalBankRows />);
    await rowOf('REFUND 0042');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Ticket status' }), 'pending');
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(lastRowRequest()).toEqual({ ticket_status: 'pending', page: 1, page_size: 50 });
    // The second page of the new filter was never asked for on the way.
    expect(rowRequests()).not.toContainEqual({ ticket_status: 'pending', page: 2, page_size: 50 });
  });
});

describe('bank row side pane', () => {
  it('opens a row beside its duplicate sibling, with its org and without the match line amounts', async () => {
    const user = userEvent.setup();
    serve();
    render(<InternalBankRows />);

    await user.click(await rowOf('STAPLES STORE #114 TORONTO'));
    const pane = screen.getByRole('region', { name: 'Bank row detail' });
    const thisRow = within(pane).getByRole('region', { name: 'This row' });
    const sibling = within(pane).getByRole('region', { name: 'Sibling' });

    // Side by side: the two halves of one grid.
    expect(thisRow.parentElement).toBe(sibling.parentElement);

    expect(within(thisRow).getByText('aaaaaaaa')).toHaveAttribute('title', FLAGGED_ID);
    expect(thisRow).not.toHaveTextContent(FLAGGED_ID);
    expect(thisRow).toHaveTextContent('2026-09-14');
    expect(thisRow).toHaveTextContent('1234.50 CAD');
    expect(thisRow).toHaveTextContent('STAPLES STORE #114 TORONTO');

    expect(within(sibling).getByText('Flagged against')).toBeInTheDocument();
    expect(within(sibling).getByText('cccccccc')).toHaveAttribute('title', SIBLING_ID);
    expect(sibling).toHaveTextContent('2026-09-13');
    expect(sibling).toHaveTextContent('1234.50 CAD');
    expect(sibling).toHaveTextContent('Staples Canada');
    expect(sibling).toHaveTextContent('STAPLES #114');

    // The org is always in the pane, even for a viewer with one org.
    expect(headers()).not.toContain('Org');
    expect(pane).toHaveTextContent('Acme Ltd');

    // The suggested match by its entry — never its line debit or credit,
    // which the server sends as numbers (F-S87-7).
    expect(pane).toHaveTextContent('Office supplies');
    expect(pane).toHaveTextContent('2026-09-12');
    expect(pane).toHaveTextContent('5100');
    expect(pane).not.toHaveTextContent('987.65');
    expect(pane).not.toHaveTextContent('432.1');

    // A row that is nobody's copy stands alone, and says so.
    await user.click(await rowOf('REFUND 0042'));
    const plainPane = screen.getByRole('region', { name: 'Bank row detail' });
    expect(within(plainPane).getByRole('region', { name: 'This row' })).toHaveTextContent(
      'REFUND 0042',
    );
    expect(within(plainPane).queryByRole('region', { name: 'Sibling' })).not.toBeInTheDocument();
    expect(within(plainPane).getByText('No duplicate sibling.')).toBeInTheDocument();
  });

  it('narrows the list to one feed from a row, as a chip that can be removed', async () => {
    const user = userEvent.setup();
    serve();
    render(<InternalBankRows />);

    await user.click(await rowOf('STAPLES STORE #114 TORONTO'));
    await user.click(screen.getByRole('button', { name: 'Only this feed' }));
    await settle();
    expect(lastRowRequest()).toEqual({ bank_account_id: FEED, page: 1, page_size: 50 });
    expect(screen.getByText('Feed: Business Mastercard ····3277')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove feed filter' }));
    await settle();
    expect(lastRowRequest()).toEqual({ page: 1, page_size: 50 });
    expect(screen.queryByText('Feed: Business Mastercard ····3277')).not.toBeInTheDocument();
  });
});
