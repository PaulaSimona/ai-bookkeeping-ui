// InternalBankRows (S87 B2b U3, O-S87-8): the staff bank-rows screen — every
// bank row waiting on staff, across the orgs the viewer may see. The list is
// what the server sent: amounts as its strings, bank text as plain text, a feed
// by its name and last four digits. The O-S87-3 filters are sent only when set,
// and a row opens beside the row it may be a copy of.
//
// Actions (U4): a flagged row can be merged with its sibling — the sibling is
// the stale row, this row stays — or have its flag released. Each asks the
// server for its plan first, shows that plan in the confirm dialog, and only
// then carries it out; what the server refuses is shown in its own words.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  BANK_ROW_TICKET_STATUSES,
  type BankMergePlan,
  type BankNoDocumentPlan,
  type BankReleasePlan,
  type BankReopenPlan,
  type BankRow,
} from '@/hooks/useStaffBankRows';
import { InternalBankRows } from './InternalBankRows';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

type Params = Record<string, string | number | boolean>;
const get = api.get as unknown as Mock<
  (url: string, config?: { params?: Params }) => Promise<unknown>
>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ROWS_URL = '/api/accounting/review/bank/';
const ORGS_URL = '/api/accounting/orgs/';
const ME_URL = '/api/accounting/staff/me/';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const FEED = 'f1f1f1f1-0000-4000-8000-000000000001';
const FLAGGED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAIN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SIBLING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LONE_ID = '12121212-1212-4121-8121-121212121212';

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

// A row intake flagged as a possible copy of a settled row, still pending at
// the bank, with a suggested match whose line amounts are the server's
// strings: the one side the line carries, and null for the other.
const FLAGGED = bankRow({
  id: FLAGGED_ID,
  date: '2026-09-14',
  direction: 'money_out',
  amount: '1234.50',
  counterparty_name: 'Staples',
  description: 'STAPLES STORE #114 TORONTO',
  pending: true,
  ticket_status: 'needs_review',
  ticket_status_label: 'Needs Review',
  routing_reason: 'possible_duplicate_bank_row',
  routing_reason_label: 'Possible duplicate',
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
    line_debit: '1234.50',
    line_credit: null,
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
  // Who GET staff/me/ says the viewer is (Release C2). Left out, it answers
  // 404 like any other address here: the viewer is not known to be staff.
  // 'unanswered' never answers at all.
  me?: 'super' | 'reviewer' | 'unanswered';
}

// What the server answers: the viewer's orgs, a page of rows, and — when the
// test says who is looking — the viewer's own staff role.
const serve = ({ rows = [FLAGGED, PLAIN], count, orgs = [ACME], me }: Served = {}) => {
  get.mockImplementation((url) => {
    if (url === ME_URL && me === 'unanswered') return new Promise(() => {});
    if (url === ME_URL && me) {
      return Promise.resolve({
        status: 200,
        data: {
          is_staff_member: true,
          is_super_user: me === 'super',
          role_type: me === 'super' ? 'super_user' : 'reviewer',
        },
      });
    }
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
  post.mockReset();
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
    // The routing reason in the server's own words (N-S88-3).
    expect(reason.textContent).toBe('Possible duplicate');

    // A row with nothing to flag and no routing reason says so with a dash.
    const plain = cellsOf(await rowOf('REFUND 0042'));
    expect(plain[2]).toContain('Money in');
    expect(plain[2]).toContain('80.00 CAD');
    expect(plain.slice(4)).toEqual(['Pending', '—', '—']);
  });

  it("shows each ticket status and routing reason by the server's label, never a title-cased code", async () => {
    serve({
      rows: [
        bankRow({
          description: 'WAITING ROW',
          ticket_status: 'waiting_document',
          ticket_status_label: 'Waiting for Document',
          routing_reason: 'low_confidence',
          routing_reason_label: 'Low confidence in the drafted account',
        }),
      ],
    });
    render(<InternalBankRows />);

    const row = await rowOf('WAITING ROW');
    const cells = cellsOf(row);
    expect(cells[4]).toBe('Waiting for Document');
    expect(cells[6]).toBe('Low confidence in the drafted account');
    // Not the code, and not the code reworded on the client.
    expect(row).not.toHaveTextContent('waiting_document');
    expect(row).not.toHaveTextContent('Waiting Document');
    expect(row).not.toHaveTextContent('low_confidence');
    expect(row).not.toHaveTextContent('Low Confidence');
  });

  it('shows the code as sent when the server gives no label, and a dash when there is neither', async () => {
    serve({
      rows: [
        bankRow({
          description: 'NO LABELS',
          ticket_status: 'needs_review',
          ticket_status_label: null,
          routing_reason: 'period_locked',
          routing_reason_label: null,
        }),
        bankRow({
          id: LONE_ID,
          description: 'NO TICKET',
          ticket_status: null,
          ticket_status_label: null,
          routing_reason: null,
          routing_reason_label: null,
        }),
      ],
    });
    render(<InternalBankRows />);

    const unlabelled = cellsOf(await rowOf('NO LABELS'));
    expect(unlabelled[4]).toBe('needs_review');
    expect(unlabelled[6]).toBe('period_locked');

    const bare = cellsOf(await rowOf('NO TICKET'));
    expect(bare[4]).toBe('—');
    expect(bare[6]).toBe('—');
  });

  it("heads the page and the list with the server's count, not the number of rows on the page", async () => {
    serve({ count: 120 });
    const many = render(<InternalBankRows />);
    await rowOf('REFUND 0042');
    expect(screen.getByText('120 bank rows (oldest first).')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bank rows (120)' })).toBeInTheDocument();
    many.unmount();

    serve({ rows: [PLAIN], count: 1 });
    render(<InternalBankRows />);
    await rowOf('REFUND 0042');
    expect(screen.getByText('1 bank row (oldest first).')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bank rows (1)' })).toBeInTheDocument();
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

  it('offers every ticket status in the filter by its label, No document needed among them, and sends its code', async () => {
    const user = userEvent.setup();
    serve();
    render(<InternalBankRows />);
    await rowOf('REFUND 0042');

    const status = screen.getByRole('combobox', { name: 'Ticket status' });
    expect(within(status).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Any ticket status',
      'Pending',
      'Processing',
      'Needs Review',
      'Failed',
      'Waiting for Document',
      'Documented',
      'Closed',
      'No document needed',
    ]);

    await user.selectOptions(status, 'No document needed');
    await settle();
    expect(lastRowRequest()).toEqual({
      ticket_status: 'no_document_needed',
      page: 1,
      page_size: 50,
    });
  });

  // ── The feed filter (Release C2, N-S88-2) ──────────────────────────────────
  // Its options are the feeds of the rows the list has shown: no endpoint
  // lists the feeds a staff viewer may see.

  const FEED_B = 'f2f2f2f2-0000-4000-8000-000000000002';
  const FEED_C = 'f3f3f3f3-0000-4000-8000-000000000003';
  const feedPicker = () => screen.getByRole('combobox', { name: 'Feed' });
  const feedOptions = () =>
    within(feedPicker())
      .getAllByRole('option')
      .map((o) => o.textContent);

  // One row on each of two feeds.
  const ON_A = bankRow({ description: 'ROW ON A' });
  const ON_B = bankRow({
    id: LONE_ID,
    description: 'ROW ON B',
    bank_account_id: FEED_B,
    bank_account_name: 'Operating Chequing',
    feed_mask: null,
  });

  it('offers the feeds of the rows it has loaded, each by its name and last four digits, and never more of a mask', async () => {
    serve({
      rows: [
        ON_A,
        ON_B,
        // A second row on the first feed: the feed is offered once.
        bankRow({ id: FLAGGED_ID, description: 'ALSO ON A' }),
        bankRow({
          id: SIBLING_ID,
          description: 'ROW ON C',
          bank_account_id: FEED_C,
          bank_account_name: 'Savings',
          feed_mask: '9912345678',
        }),
      ],
    });
    render(<InternalBankRows />);
    await rowOf('ROW ON C');

    expect(feedOptions()).toEqual([
      'Any feed',
      'Business Mastercard ····3277',
      'Operating Chequing',
      'Savings ····5678',
    ]);
    expect(feedPicker()).not.toHaveTextContent('991234');
    expect(feedPicker()).toHaveValue('');
  });

  it('sends bank_account_id for the chosen feed and goes back to the first page', async () => {
    const user = userEvent.setup();
    serve({ rows: [ON_A, ON_B], count: 120 });
    render(<InternalBankRows />);
    await rowOf('ROW ON B');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();

    await user.selectOptions(feedPicker(), 'Operating Chequing');
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(lastRowRequest()).toEqual({ bank_account_id: FEED_B, page: 1, page_size: 50 });
    expect(rowRequests()).not.toContainEqual({ bank_account_id: FEED_B, page: 2, page_size: 50 });
    expect(feedPicker()).toHaveValue(FEED_B);
  });

  it('keeps every feed on offer while the list is narrowed to one', async () => {
    const user = userEvent.setup();
    serve({ rows: [ON_A, ON_B] });
    render(<InternalBankRows />);
    await rowOf('ROW ON B');

    // Narrowed to B, the server sends B's rows only.
    serve({ rows: [ON_B] });
    await user.selectOptions(feedPicker(), 'Operating Chequing');
    await settle();
    expect(screen.queryByText('ROW ON A')).not.toBeInTheDocument();
    expect(feedOptions()).toEqual(['Any feed', 'Business Mastercard ····3277', 'Operating Chequing']);

    // So the other feed can still be chosen, straight from here.
    serve({ rows: [ON_A] });
    await user.selectOptions(feedPicker(), 'Business Mastercard ····3277');
    await settle();
    expect(lastRowRequest()).toEqual({ bank_account_id: FEED, page: 1, page_size: 50 });
    expect(await screen.findByText('ROW ON A')).toBeInTheDocument();
  });

  it('names the org beside a feed when the viewer has more than one org', async () => {
    serve({
      orgs: [ACME, BIRCH],
      rows: [
        bankRow({ description: 'ACME ROW', bank_account_name: 'Chequing', feed_mask: '1111' }),
        bankRow({
          id: LONE_ID,
          description: 'BIRCH ROW',
          org_id: ORG_B,
          org_name: 'Birch Inc',
          bank_account_id: FEED_B,
          bank_account_name: 'Chequing',
          feed_mask: '2222',
        }),
      ],
    });
    render(<InternalBankRows />);
    await rowOf('BIRCH ROW');
    await settle();

    expect(feedOptions()).toEqual([
      'Any feed',
      'Chequing ····1111 · Acme Ltd',
      'Chequing ····2222 · Birch Inc',
    ]);
  });

  it('follows a feed set from a row with Only this feed, and Any feed clears it', async () => {
    const user = userEvent.setup();
    serve({ rows: [ON_A, ON_B] });
    render(<InternalBankRows />);

    await user.click(await rowOf('ROW ON B'));
    await user.click(screen.getByRole('button', { name: 'Only this feed' }));
    await settle();
    expect(lastRowRequest()).toEqual({ bank_account_id: FEED_B, page: 1, page_size: 50 });
    // The picker and the chip say the same thing.
    expect(feedPicker()).toHaveValue(FEED_B);
    expect(screen.getByText('Feed: Operating Chequing')).toBeInTheDocument();

    await user.selectOptions(feedPicker(), 'Any feed');
    await settle();
    expect(lastRowRequest()).toEqual({ page: 1, page_size: 50 });
    expect(feedPicker()).toHaveValue('');
    expect(screen.queryByText('Feed: Operating Chequing')).not.toBeInTheDocument();
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
  it('opens a row beside its duplicate sibling, with its org and its suggested match', async () => {
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

    // The suggested match by its entry, with its line amounts as the server's
    // strings (F-S87-7): the side the line does not carry is a dash.
    const match = within(pane).getByRole('region', { name: 'Suggested match' });
    expect(match).toHaveTextContent('Office supplies');
    expect(match).toHaveTextContent('2026-09-12');
    expect(match).toHaveTextContent('5100');
    expect(within(match).getByText('Debit').parentElement!.textContent).toBe('Debit1234.50');
    expect(within(match).getByText('Credit').parentElement!.textContent).toBe('Credit—');

    // A row that is nobody's copy stands alone, and says so.
    await user.click(await rowOf('REFUND 0042'));
    const plainPane = screen.getByRole('region', { name: 'Bank row detail' });
    expect(within(plainPane).getByRole('region', { name: 'This row' })).toHaveTextContent(
      'REFUND 0042',
    );
    expect(within(plainPane).queryByRole('region', { name: 'Sibling' })).not.toBeInTheDocument();
    expect(within(plainPane).getByText('No duplicate sibling.')).toBeInTheDocument();
  });

  it("shows a waiting row's settled match under its own heading, with its state, entry, account and line amounts", async () => {
    const user = userEvent.setup();
    // F-S88-6: a waiting row arrives from the server although it is settled,
    // and carries the match that settled it.
    serve({
      rows: [
        bankRow({
          id: LONE_ID,
          description: 'WAITING MATCHED',
          ticket_status: 'waiting_document',
          ticket_status_label: 'Waiting for Document',
          row_kind: 'matched',
          settled_match: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            state: 'auto_matched',
            similarity: null,
            date_delta_days: 1,
            rationale: '',
            created_at: '2026-09-21T10:00:00Z',
            journal_line_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            entry_id: '99999999-9999-4999-8999-999999999999',
            entry_date: '2026-09-21',
            entry_description: 'Monthly bank charges',
            line_debit: null,
            line_credit: '80.00',
            account_code: '1010',
          },
        }),
      ],
    });
    render(<InternalBankRows />);

    await user.click(await rowOf('WAITING MATCHED'));
    const pane = screen.getByRole('region', { name: 'Bank row detail' });
    const settled = within(pane).getByRole('region', { name: 'Settled match' });
    const detail = (label: string) => within(settled).getByText(label).parentElement!.textContent;
    expect(detail('State')).toBe('StateAuto Matched');
    expect(detail('Entry date')).toBe('Entry date2026-09-21');
    expect(detail('Entry')).toBe('EntryMonthly bank charges');
    expect(detail('Account')).toBe('Account1010');
    expect(detail('Debit')).toBe('Debit—');
    expect(detail('Credit')).toBe('Credit80.00');
    // It is the row's settled match, not a suggestion waiting for a decision.
    expect(within(pane).queryByRole('region', { name: 'Suggested match' })).not.toBeInTheDocument();
  });

  it('shows a line amount exactly as the server sent it: not regrouped, re-signed, rounded or summed', async () => {
    const user = userEvent.setup();
    serve({
      rows: [
        {
          ...FLAGGED,
          suggested_match: {
            ...FLAGGED.suggested_match!,
            line_debit: '1234567.80',
            line_credit: '0.10',
          },
        },
      ],
    });
    render(<InternalBankRows />);

    await user.click(await rowOf('STAPLES STORE #114 TORONTO'));
    const match = within(screen.getByRole('region', { name: 'Bank row detail' })).getByRole('region', {
      name: 'Suggested match',
    });
    // Each side is the string that arrived — the trailing zero and all.
    expect(within(match).getByText('Debit').parentElement!.textContent).toBe('Debit1234567.80');
    expect(within(match).getByText('Credit').parentElement!.textContent).toBe('Credit0.10');
    expect(match).not.toHaveTextContent('1,234,567');
    expect(match).not.toHaveTextContent('$');
    // Nothing is worked out from the two: no total, no difference.
    expect(match).not.toHaveTextContent('1234567.90');
    expect(match).not.toHaveTextContent('1234567.70');
  });

  it("shows the server's labels in the side pane, and a closed ticket's note", async () => {
    const user = userEvent.setup();
    serve({
      rows: [
        bankRow({
          id: LONE_ID,
          description: 'CLOSED ROW',
          ticket_status: 'no_document_needed',
          ticket_status_label: 'No document needed',
          routing_reason: 'other',
          routing_reason_label: 'Other',
          resolution_note: 'Paid in cash, no receipt',
        }),
        PLAIN,
      ],
    });
    render(<InternalBankRows />);

    await user.click(await rowOf('CLOSED ROW'));
    const closed = screen.getByRole('region', { name: 'Bank row detail' });
    const detail = (label: string) => within(closed).getByText(label).parentElement as HTMLElement;
    expect(detail('Ticket')).toHaveTextContent('No document needed');
    expect(detail('Routing reason')).toHaveTextContent('Other');
    expect(detail('Note')).toHaveTextContent('Paid in cash, no receipt');
    expect(closed).not.toHaveTextContent('No Document Needed');
    expect(closed).not.toHaveTextContent('no_document_needed');

    // A ticket with no note has no Note line at all.
    await user.click(await rowOf('REFUND 0042'));
    const plain = screen.getByRole('region', { name: 'Bank row detail' });
    expect(within(plain).getByText('Ticket').parentElement).toHaveTextContent('Pending');
    expect(within(plain).queryByText('Note')).not.toBeInTheDocument();
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

// ─── Actions (U4) ──────────────────────────────────────────────────────────────

// A flagged row whose sibling was not recorded: nothing to merge it with.
const LONE = bankRow({
  id: LONE_ID,
  description: 'LONE FLAGGED ROW',
  ticket_status: 'needs_review',
  routing_reason: 'possible_duplicate_bank_row',
});

// The merge is asked of the SIBLING (the stale row); the open row stays.
const MERGE_URL = `/api/accounting/staff/bank-rows/${SIBLING_ID}/merge/`;
const RELEASE_URL = `/api/accounting/staff/bank-rows/${FLAGGED_ID}/release-flag/`;
const LONE_RELEASE_URL = `/api/accounting/staff/bank-rows/${LONE_ID}/release-flag/`;

// The plans as the server sends them (bank_duplicate_service.py
// MergePlan._image / ReleasePlan._image).
const MERGE_PLAN: BankMergePlan = {
  stale_row_id: SIBLING_ID,
  surviving_row_id: FLAGGED_ID,
  moves_match: {
    match_id: '31313131-0000-4000-8000-000000000001',
    state: 'auto_matched',
    journal_line_id: '41414141-0000-4000-8000-000000000002',
    entry_id: '51515151-0000-4000-8000-000000000003',
    entry_number: 68,
  },
  moves_entry: null,
  stale_ticket: {
    before: { status: 'documented', routing_reason: null },
    after: { status: 'closed', routing_reason: 'duplicate_merged' },
  },
  surviving_ticket: {
    before: { status: 'needs_review', routing_reason: 'possible_duplicate_bank_row' },
    after: { status: 'documented', routing_reason: 'bank_duplicate_merged' },
  },
  excluded_reason: 'duplicate',
};

const RELEASE_PLAN: BankReleasePlan = {
  row_id: FLAGGED_ID,
  sibling_id: SIBLING_ID,
  ticket: {
    before: { status: 'needs_review', routing_reason: 'possible_duplicate_bank_row' },
    after: { status: 'pending', routing_reason: null },
  },
  matched: null,
};

const planned = (executed: boolean, plan: unknown) => ({ status: 200, data: { executed, plan } });

const MERGE = 'Merge: keep this row';
const RELEASE = 'Not a duplicate: release flag';
const LIMIT = 'The hourly limit for this action has been reached. Try again later.';

const button = (name: string) => screen.getByRole('button', { name });
const pane = () => screen.queryByRole('region', { name: 'Bank row detail' });

// Opens the row that carries this bank text in the side pane.
const openRow = async (user: ReturnType<typeof userEvent.setup>, description: string) => {
  await user.click(await rowOf(description));
  return screen.getByRole('region', { name: 'Bank row detail' });
};

describe('bank row actions', () => {
  it('offers Merge only on a flagged row with a sibling, and Release on any flagged row', async () => {
    const user = userEvent.setup();
    serve({ rows: [FLAGGED, LONE, PLAIN] });
    render(<InternalBankRows />);

    // Flagged, with a sibling: both.
    await openRow(user, 'STAPLES STORE #114 TORONTO');
    expect(button(MERGE)).toBeEnabled();
    expect(button(RELEASE)).toBeEnabled();

    // Flagged, no sibling: nothing to merge with, but the flag can be released.
    await openRow(user, 'LONE FLAGGED ROW');
    expect(screen.queryByRole('button', { name: MERGE })).not.toBeInTheDocument();
    expect(button(RELEASE)).toBeEnabled();

    // Not flagged: neither.
    await openRow(user, 'REFUND 0042');
    expect(screen.queryByRole('button', { name: MERGE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RELEASE })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('asks for the merge plan first: the sibling in the path, this row as the one that stays', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue(planned(false, MERGE_PLAN));
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');

    await user.click(button(MERGE));
    expect(await screen.findByRole('heading', { name: 'Merge: keep this row?' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(MERGE_URL, { surviving_row_id: FLAGGED_ID, confirm: false });

    // The confirm shows the server's plan: the sibling is marked duplicate,
    // its match moves to this row, and no journal entry is changed.
    const plan = screen.getByRole('region', { name: 'Merge plan' });
    expect(
      within(plan).getByText('The sibling will be marked duplicate, and its match moves to this row.'),
    ).toBeInTheDocument();
    expect(within(plan).getByText('No journal entry is changed.')).toBeInTheDocument();
    expect(plan).not.toHaveTextContent(/leaves? the books/i);
    const marked = within(plan).getByText('Marked duplicate (the sibling)').parentElement!;
    expect(within(marked).getByText('cccccccc')).toHaveAttribute('title', SIBLING_ID);
    const stays = within(plan).getByText('Stays (this row)').parentElement!;
    expect(within(stays).getByText('aaaaaaaa')).toHaveAttribute('title', FLAGGED_ID);

    // Nothing is carried out by looking: Cancel sends nothing more.
    await user.click(button('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Merge: keep this row?' })).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(rowRequests()).toHaveLength(1);
    expect(pane()).toBeInTheDocument();
  });

  it('confirms the merge with the same request and confirm true, then reads the list again and closes the pane', async () => {
    const user = userEvent.setup();
    serve();
    post
      .mockResolvedValueOnce(planned(false, MERGE_PLAN))
      .mockResolvedValueOnce(planned(true, MERGE_PLAN));
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');
    await user.click(button(MERGE));
    await screen.findByRole('heading', { name: 'Merge: keep this row?' });

    // What the server lists once the merge is done: the row has its match.
    serve({ rows: [PLAIN] });
    await user.click(button('Confirm'));

    expect(await screen.findByText('Merged. The sibling is marked duplicate.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(MERGE_URL, { surviving_row_id: FLAGGED_ID, confirm: true });
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    expect(await screen.findByText('REFUND 0042')).toBeInTheDocument();
    expect(screen.queryByText('STAPLES STORE #114 TORONTO')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Merge: keep this row?' })).not.toBeInTheDocument();
    expect(pane()).not.toBeInTheDocument();
  });

  it('asks for the release plan first, on the row itself, sibling or not', async () => {
    const user = userEvent.setup();
    serve({ rows: [LONE] });
    post.mockResolvedValue(
      planned(false, { ...RELEASE_PLAN, row_id: LONE_ID, sibling_id: null }),
    );
    render(<InternalBankRows />);
    await openRow(user, 'LONE FLAGGED ROW');

    await user.click(button(RELEASE));
    expect(
      await screen.findByRole('heading', { name: 'Release the possible-duplicate flag?' }),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(LONE_RELEASE_URL, { confirm: false });

    const plan = screen.getByRole('region', { name: 'Release plan' });
    expect(
      within(plan).getByText('The possible-duplicate flag on this row will be released.'),
    ).toBeInTheDocument();
    expect(within(plan).getByText('12121212')).toHaveAttribute('title', LONE_ID);
    expect(within(plan).getByText('not recorded')).toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);
  });

  it('confirms the release with confirm true, then reads the list again and closes the pane', async () => {
    const user = userEvent.setup();
    serve();
    post
      .mockResolvedValueOnce(planned(false, RELEASE_PLAN))
      .mockResolvedValueOnce(planned(true, RELEASE_PLAN));
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');
    await user.click(button(RELEASE));
    await screen.findByRole('heading', { name: 'Release the possible-duplicate flag?' });

    await user.click(button('Confirm'));

    expect(
      await screen.findByText('Flag released. This row is not a duplicate.'),
    ).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(1, RELEASE_URL, { confirm: false });
    expect(post).toHaveBeenNthCalledWith(2, RELEASE_URL, { confirm: true });
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    await rowOf('REFUND 0042');
    expect(
      screen.queryByRole('heading', { name: 'Release the possible-duplicate flag?' }),
    ).not.toBeInTheDocument();
    expect(pane()).not.toBeInTheDocument();
  });

  it("shows a refusal by the server's code and in its own words, before the plan or at the confirm", async () => {
    const user = userEvent.setup();
    serve();
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');

    // Refused at the dry run: no plan, no confirm dialog.
    const pending =
      'The surviving row is still pending at the bank; work cannot move onto it until it settles.';
    post.mockResolvedValueOnce({ status: 409, data: { code: 'surviving_pending', detail: pending } });
    await user.click(button(MERGE));
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent(pending);
    expect(within(first).getByText('surviving_pending')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Merge: keep this row?' })).not.toBeInTheDocument();

    // Refused at the confirm: the dialog closes and the refusal takes its place.
    const notFlagged = 'This row is not flagged as a possible duplicate.';
    post
      .mockResolvedValueOnce(planned(false, RELEASE_PLAN))
      .mockResolvedValueOnce({ status: 409, data: { code: 'not_flagged', detail: notFlagged } });
    await user.click(button(RELEASE));
    await screen.findByRole('heading', { name: 'Release the possible-duplicate flag?' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(button('Confirm'));
    const second = await screen.findByRole('alert');
    expect(second).toHaveTextContent(notFlagged);
    expect(within(second).getByText('not_flagged')).toBeInTheDocument();
    expect(second).not.toHaveTextContent(pending);
    expect(
      screen.queryByRole('heading', { name: 'Release the possible-duplicate flag?' }),
    ).not.toBeInTheDocument();

    // Nothing was carried out: the pane stays and the list is not read again.
    expect(pane()).toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);
  });

  it('says the row is no longer available on a 404, with a refresh', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');

    await user.click(button(MERGE));
    expect(await screen.findByText('This row is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Merge: keep this row?' })).not.toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);

    // Refresh reads the list again; a row that is gone takes its pane with it.
    serve({ rows: [PLAIN] });
    await user.click(button('Refresh'));
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    await rowOf('REFUND 0042');
    expect(screen.queryByText('This row is no longer available.')).not.toBeInTheDocument();
    expect(pane()).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows the hourly limit on a 429 and does not try again by itself', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue({ status: 429, data: { detail: 'Request was throttled.' } });
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');

    await user.click(button(RELEASE));
    expect(await screen.findByText(LIMIT)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Release the possible-duplicate flag?' }),
    ).not.toBeInTheDocument();

    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(rowRequests()).toHaveLength(1);
    // Asking again is the reviewer's own choice.
    expect(button(RELEASE)).toBeEnabled();
  });

  it('sends one request at a time: no second dry run or confirm while one is in flight', async () => {
    const user = userEvent.setup();
    serve();
    const answers: ((value: unknown) => void)[] = [];
    post.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');

    // The dry run is out: neither action can be started again.
    await user.click(button(MERGE));
    expect(button(MERGE)).toBeDisabled();
    expect(button(RELEASE)).toBeDisabled();
    await user.click(button(MERGE));
    await user.click(button(RELEASE));
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => answers[0](planned(false, MERGE_PLAN)));
    await screen.findByRole('heading', { name: 'Merge: keep this row?' });

    // The confirm is out: it cannot be sent twice, nor cancelled half way.
    await user.click(button('Confirm'));
    expect(button('Confirm')).toBeDisabled();
    expect(button('Cancel')).toBeDisabled();
    await user.click(button('Confirm'));
    expect(post).toHaveBeenCalledTimes(2);

    await act(async () => answers[1](planned(true, MERGE_PLAN)));
    expect(await screen.findByText('Merged. The sibling is marked duplicate.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('counts a confirm as carried out only when the server says so: otherwise names the plan rows, claims nothing and reads the list again', async () => {
    const user = userEvent.setup();
    serve();
    // The confirm comes back 200, but as a plan that was NOT executed.
    post
      .mockResolvedValueOnce(planned(false, MERGE_PLAN))
      .mockResolvedValueOnce(planned(false, MERGE_PLAN));
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');
    await user.click(button(MERGE));
    await screen.findByRole('heading', { name: 'Merge: keep this row?' });

    await user.click(button('Confirm'));

    const notice = (await screen.findByText('The server did not carry this out.')).closest(
      '[role="alert"]',
    ) as HTMLElement;
    expect(within(notice).getByText('cccccccc')).toHaveAttribute('title', SIBLING_ID);
    expect(within(notice).getByText('aaaaaaaa')).toHaveAttribute('title', FLAGGED_ID);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(MERGE_URL, { surviving_row_id: FLAGGED_ID, confirm: true });
    expect(screen.queryByText('Merged. The sibling is marked duplicate.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Merge: keep this row?' })).not.toBeInTheDocument();

    // The list is read again, and the notice is still there once it is back.
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    expect(await screen.findByText('REFUND 0042')).toBeInTheDocument();
    expect(screen.getByText('The server did not carry this out.')).toBeInTheDocument();
    expect(screen.queryByText('Merged. The sibling is marked duplicate.')).not.toBeInTheDocument();
  });

  it('keeps the confirm open when the connection is lost: the failure with no code, Confirm ready again, nothing said to be done', async () => {
    const user = userEvent.setup();
    serve();
    post
      .mockResolvedValueOnce(planned(false, MERGE_PLAN))
      .mockRejectedValueOnce(new Error('network down'));
    render(<InternalBankRows />);
    await openRow(user, 'STAPLES STORE #114 TORONTO');
    await user.click(button(MERGE));
    await screen.findByRole('heading', { name: 'Merge: keep this row?' });

    await user.click(button('Confirm'));

    // The refusal view, in the hook's words and with no code beneath.
    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe('Merge failed.');
    expect(screen.getByRole('heading', { name: 'Merge: keep this row?' })).toBeInTheDocument();
    expect(button('Confirm')).toBeEnabled();
    expect(button('Cancel')).toBeEnabled();
    expect(screen.queryByText('Merged. The sibling is marked duplicate.')).not.toBeInTheDocument();
    expect(screen.queryByText('The server did not carry this out.')).not.toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);

    // Confirm again is the same request again.
    post.mockResolvedValueOnce(planned(true, MERGE_PLAN));
    await user.click(button('Confirm'));
    expect(await screen.findByText('Merged. The sibling is marked duplicate.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenLastCalledWith(MERGE_URL, { surviving_row_id: FLAGGED_ID, confirm: true });
  });
});

// ─── No document needed (Release C2, O-S88-3) ──────────────────────────────────
//
// A posted row waiting for its document can be closed for good: staff give one
// of seven reasons (a note is required for "Other"), look at the server's plan,
// and confirm it. The server decides whether the ticket may be closed.

const WAITING_ID = '34343434-3434-4343-8343-343434343434';

// A row waiting for its document: settled at the bank, in the books, and
// matched to its entry (F-S88-6).
const WAITING = bankRow({
  id: WAITING_ID,
  direction: 'money_out',
  counterparty_name: 'First Bank',
  description: 'MONTHLY FEE',
  ticket_status: 'waiting_document',
  ticket_status_label: 'Waiting for Document',
  row_kind: 'matched',
  settled_match: {
    id: '31313131-0000-4000-8000-000000000001',
    state: 'auto_matched',
    similarity: null,
    date_delta_days: 1,
    rationale: '',
    created_at: '2026-09-21T10:00:00Z',
    journal_line_id: '41414141-0000-4000-8000-000000000002',
    entry_id: '51515151-0000-4000-8000-000000000003',
    entry_date: '2026-09-21',
    entry_description: 'Monthly bank charges',
    line_debit: null,
    line_credit: '80.00',
    account_code: '1010',
  },
});

const NO_DOC_URL = `/api/accounting/staff/bank-rows/${WAITING_ID}/no-document/`;

// The plan as the server sends it (bank_ticket_service.py NoDocumentPlan._image).
const NO_DOC_PLAN: BankNoDocumentPlan = {
  row_id: WAITING_ID,
  row: { date: '2026-09-20', direction: 'money_out', amount: '80.00', currency: 'CAD' },
  ticket: {
    before: { status: 'waiting_document', routing_reason: null },
    after: { status: 'no_document_needed', routing_reason: 'bank_fee' },
  },
  reason: 'bank_fee',
  reason_label: 'Bank fee',
  note: null,
  entry: {
    entry_id: '51515151-0000-4000-8000-000000000003',
    entry_number: 68,
    entry_date: '2026-09-21',
  },
  matched: { match_id: '31313131-0000-4000-8000-000000000001', state: 'auto_matched' },
};

const NO_DOC = 'No document needed';
const NO_DOC_TITLE = 'Close this ticket: no document needed?';
const NO_DOC_DONE = 'Closed: no document needed.';

const reasonPicker = () => screen.getByRole('combobox', { name: 'Reason' });
const noteField = () => screen.getByRole('textbox', { name: 'Note' });

// Opens the waiting row, asks for the form, gives a reason (and a note) and
// asks the server for its plan.
const previewNoDocument = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = 'Bank fee',
  note = '',
) => {
  await openRow(user, 'MONTHLY FEE');
  await user.click(button(NO_DOC));
  await user.selectOptions(reasonPicker(), reason);
  if (note) await user.type(noteField(), note);
  await user.click(button('Preview'));
};

describe('bank row: no document needed', () => {
  it('offers No document needed only on a waiting ticket that is matched, settled at the bank and in the books', async () => {
    const user = userEvent.setup();
    serve({
      rows: [
        WAITING,
        {
          ...WAITING,
          id: '61616161-0000-4000-8000-000000000001',
          description: 'WAITING UNMATCHED',
          row_kind: 'unmatched',
          settled_match: null,
        },
        { ...WAITING, id: '61616161-0000-4000-8000-000000000002', description: 'WAITING PENDING', pending: true },
        {
          ...WAITING,
          id: '61616161-0000-4000-8000-000000000003',
          description: 'WAITING EXCLUDED',
          excluded: true,
          excluded_reason: 'duplicate',
        },
        {
          ...WAITING,
          id: '61616161-0000-4000-8000-000000000004',
          description: 'DOCUMENTED ROW',
          ticket_status: 'documented',
          ticket_status_label: 'Documented',
        },
        FLAGGED,
        PLAIN,
      ],
    });
    render(<InternalBankRows />);

    await openRow(user, 'MONTHLY FEE');
    expect(button(NO_DOC)).toBeEnabled();
    // It is not a duplicate: neither of the duplicate actions is offered.
    expect(screen.queryByRole('button', { name: MERGE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RELEASE })).not.toBeInTheDocument();

    for (const description of [
      'WAITING UNMATCHED',
      'WAITING PENDING',
      'WAITING EXCLUDED',
      'DOCUMENTED ROW',
      'STAPLES STORE #114 TORONTO',
      'REFUND 0042',
    ]) {
      await openRow(user, description);
      expect(screen.queryByRole('button', { name: NO_DOC })).not.toBeInTheDocument();
    }
    expect(post).not.toHaveBeenCalled();
  });

  it('asks for a reason first: the seven reasons by their labels, and Preview waits for one', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    render(<InternalBankRows />);
    await openRow(user, 'MONTHLY FEE');

    // The form is not there until it is asked for.
    expect(screen.queryByRole('combobox', { name: 'Reason' })).not.toBeInTheDocument();
    await user.click(button(NO_DOC));
    expect(within(reasonPicker()).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose a reason',
      'Bank fee',
      'Interest',
      'Transfer between own accounts',
      'Card payment',
      'Loan',
      'Tax remittance',
      'Other',
    ]);
    expect(button('Preview')).toBeDisabled();

    await user.selectOptions(reasonPicker(), 'Bank fee');
    expect(button('Preview')).toBeEnabled();

    // Choosing sends nothing, and Cancel puts the form away.
    await user.click(button('Cancel'));
    expect(screen.queryByRole('combobox', { name: 'Reason' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('needs a note for the reason Other, and holds a note to 200 characters', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    render(<InternalBankRows />);
    await openRow(user, 'MONTHLY FEE');
    await user.click(button(NO_DOC));

    await user.selectOptions(reasonPicker(), 'Other');
    expect(button('Preview')).toBeDisabled();
    expect(screen.getByText('A note is required for the reason "Other".')).toBeInTheDocument();

    // Spaces are not a note.
    await user.type(noteField(), '   ');
    expect(button('Preview')).toBeDisabled();
    await user.type(noteField(), 'Paid in cash');
    expect(button('Preview')).toBeEnabled();
    expect(noteField()).toHaveAttribute('maxlength', '200');

    // With any other reason the note is optional.
    await user.clear(noteField());
    expect(button('Preview')).toBeDisabled();
    await user.selectOptions(reasonPicker(), 'Interest');
    expect(button('Preview')).toBeEnabled();
    expect(screen.queryByText('A note is required for the reason "Other".')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("asks for the plan first with the reason and the note, and shows the server's plan and its reason label", async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    // The label in the plan is the server's own — worded apart from the
    // picker's here, to show which of the two the dialog prints.
    post.mockResolvedValue(
      planned(false, {
        ...NO_DOC_PLAN,
        reason: 'other',
        reason_label: 'Other (as the server names it)',
        note: 'Paid in cash',
      }),
    );
    render(<InternalBankRows />);

    await previewNoDocument(user, 'Other', ' Paid in cash ');
    expect(await screen.findByRole('heading', { name: NO_DOC_TITLE })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(NO_DOC_URL, {
      reason: 'other',
      note: 'Paid in cash',
      confirm: false,
    });

    const plan = screen.getByRole('region', { name: 'No document needed plan' });
    expect(within(plan).getByText('Other (as the server names it)')).toBeInTheDocument();
    expect(within(plan).getByText('Paid in cash')).toBeInTheDocument();
    expect(within(plan).getByText('34343434')).toHaveAttribute('title', WAITING_ID);
    expect(within(plan).getByText('No journal entry is changed.')).toBeInTheDocument();

    // Nothing is carried out by looking: Cancel sends nothing more, and the
    // form is back as it was left.
    await user.click(button('Cancel'));
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(rowRequests()).toHaveLength(1);
    expect(pane()).toBeInTheDocument();
    expect(reasonPicker()).toHaveValue('other');
    expect(noteField()).toHaveValue(' Paid in cash ');
  });

  it('confirms with the same request and confirm true, then reads the list again and closes the pane', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING, PLAIN] });
    post
      .mockResolvedValueOnce(planned(false, NO_DOC_PLAN))
      .mockResolvedValueOnce(planned(true, NO_DOC_PLAN));
    render(<InternalBankRows />);
    await previewNoDocument(user);
    await screen.findByRole('heading', { name: NO_DOC_TITLE });

    // What the server lists once the ticket is closed: the row has left.
    serve({ rows: [PLAIN] });
    await user.click(button('Confirm'));

    expect(await screen.findByText(NO_DOC_DONE)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(1, NO_DOC_URL, { reason: 'bank_fee', confirm: false });
    expect(post).toHaveBeenNthCalledWith(2, NO_DOC_URL, { reason: 'bank_fee', confirm: true });
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    expect(await screen.findByText('REFUND 0042')).toBeInTheDocument();
    expect(screen.queryByText('MONTHLY FEE')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();
    expect(pane()).not.toBeInTheDocument();
  });

  it('counts the close as carried out only when the server says so: otherwise names the row, claims nothing and reads the list again', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING, PLAIN] });
    // The confirm comes back 200, but as a plan that was NOT executed.
    post
      .mockResolvedValueOnce(planned(false, NO_DOC_PLAN))
      .mockResolvedValueOnce(planned(false, NO_DOC_PLAN));
    render(<InternalBankRows />);
    await previewNoDocument(user);
    await screen.findByRole('heading', { name: NO_DOC_TITLE });

    await user.click(button('Confirm'));

    const notice = (await screen.findByText('The server did not carry this out.')).closest(
      '[role="alert"]',
    ) as HTMLElement;
    expect(within(notice).getByText('34343434')).toHaveAttribute('title', WAITING_ID);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(NO_DOC_URL, { reason: 'bank_fee', confirm: true });
    expect(screen.queryByText(NO_DOC_DONE)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();

    // The list is read again, and the notice is still there once it is back.
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    expect(await screen.findByText('REFUND 0042')).toBeInTheDocument();
    expect(screen.getByText('The server did not carry this out.')).toBeInTheDocument();
    expect(screen.queryByText(NO_DOC_DONE)).not.toBeInTheDocument();
  });

  it("shows a refusal by the server's code and in its own words, before the plan or at the confirm", async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    render(<InternalBankRows />);

    // Refused at the dry run: no plan, no confirm dialog.
    const notLive =
      "This row's entry is no longer live (reversed or corrected), so its ticket cannot be changed here.";
    post.mockResolvedValueOnce({ status: 409, data: { code: 'entry_not_live', detail: notLive } });
    await previewNoDocument(user);
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent(notLive);
    expect(within(first).getByText('entry_not_live')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();

    // Refused at the confirm: the dialog closes and the refusal takes its place.
    const notWaiting = 'This row is not waiting for a document.';
    post
      .mockResolvedValueOnce(planned(false, NO_DOC_PLAN))
      .mockResolvedValueOnce({
        status: 409,
        data: { code: 'not_waiting_document', detail: notWaiting },
      });
    await user.click(button('Preview'));
    await screen.findByRole('heading', { name: NO_DOC_TITLE });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(button('Confirm'));
    const second = await screen.findByRole('alert');
    expect(second).toHaveTextContent(notWaiting);
    expect(within(second).getByText('not_waiting_document')).toBeInTheDocument();
    expect(second).not.toHaveTextContent(notLive);
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();

    // Nothing was carried out: the pane stays and the list is not read again.
    expect(pane()).toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);
    expect(screen.queryByText(NO_DOC_DONE)).not.toBeInTheDocument();
  });

  it('says the row is no longer available on a 404, with a refresh', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING, PLAIN] });
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    render(<InternalBankRows />);

    await previewNoDocument(user);
    expect(await screen.findByText('This row is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);

    // Refresh reads the list again; a row that is gone takes its pane with it.
    serve({ rows: [PLAIN] });
    await user.click(button('Refresh'));
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    await rowOf('REFUND 0042');
    expect(screen.queryByText('This row is no longer available.')).not.toBeInTheDocument();
    expect(pane()).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows the hourly limit on a 429 and does not try again by itself', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    post.mockResolvedValue({ status: 429, data: { detail: 'Request was throttled.' } });
    render(<InternalBankRows />);

    await previewNoDocument(user);
    expect(await screen.findByText(LIMIT)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();

    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(rowRequests()).toHaveLength(1);
    // Asking again is the reviewer's own choice.
    expect(button('Preview')).toBeEnabled();
  });

  it('keeps the confirm open when the connection is lost: the failure with no code, Confirm ready again, nothing said to be done', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    post
      .mockResolvedValueOnce(planned(false, NO_DOC_PLAN))
      .mockRejectedValueOnce(new Error('network down'));
    render(<InternalBankRows />);
    await previewNoDocument(user);
    await screen.findByRole('heading', { name: NO_DOC_TITLE });

    await user.click(button('Confirm'));

    // The refusal view, in the hook's words and with no code beneath.
    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe('Could not close the ticket.');
    expect(screen.getByRole('heading', { name: NO_DOC_TITLE })).toBeInTheDocument();
    expect(button('Confirm')).toBeEnabled();
    expect(button('Cancel')).toBeEnabled();
    expect(screen.queryByText(NO_DOC_DONE)).not.toBeInTheDocument();
    expect(screen.queryByText('The server did not carry this out.')).not.toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);

    // Confirm again is the same request again.
    post.mockResolvedValueOnce(planned(true, NO_DOC_PLAN));
    await user.click(button('Confirm'));
    expect(await screen.findByText(NO_DOC_DONE)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenLastCalledWith(NO_DOC_URL, { reason: 'bank_fee', confirm: true });
  });

  it('sends one request at a time: no second dry run or confirm while one is in flight', async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    const answers: ((value: unknown) => void)[] = [];
    post.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    render(<InternalBankRows />);

    // The dry run is out: it cannot be asked for again, nor its reason changed.
    await previewNoDocument(user);
    expect(button('Preview')).toBeDisabled();
    expect(button(NO_DOC)).toBeDisabled();
    expect(reasonPicker()).toBeDisabled();
    expect(noteField()).toBeDisabled();
    await user.click(button('Preview'));
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => answers[0](planned(false, NO_DOC_PLAN)));
    await screen.findByRole('heading', { name: NO_DOC_TITLE });

    // The confirm is out: it cannot be sent twice, nor cancelled half way.
    await user.click(button('Confirm'));
    expect(button('Confirm')).toBeDisabled();
    expect(button('Cancel')).toBeDisabled();
    await user.click(button('Confirm'));
    expect(post).toHaveBeenCalledTimes(2);

    await act(async () => answers[1](planned(true, NO_DOC_PLAN)));
    expect(await screen.findByText(NO_DOC_DONE)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("shows the server's own words when it turns the reason or the note down", async () => {
    const user = userEvent.setup();
    serve({ rows: [WAITING] });
    // A 400 names the field and carries no code.
    const tooLong = 'The note may not exceed 200 characters.';
    post.mockResolvedValue({ status: 400, data: { note: tooLong } });
    render(<InternalBankRows />);

    await previewNoDocument(user, 'Other', 'Paid in cash');
    const refusal = await screen.findByRole('alert');
    expect(refusal.textContent).toBe(tooLong);
    expect(screen.queryByRole('heading', { name: NO_DOC_TITLE })).not.toBeInTheDocument();
    // The form stays, to be put right and asked again.
    expect(reasonPicker()).toHaveValue('other');
    expect(button('Preview')).toBeEnabled();
    expect(rowRequests()).toHaveLength(1);
  });
});

// ─── Reopen (Release C2, O-S88-3; listed by O-S88-11) ──────────────────────────
//
// A ticket closed as "no document needed" can be sent back to wait for its
// document — by a super user only. The button is not shown to anyone else, and
// the server answers anyone else with the same 404 as a row that is not there.

const CLOSED_ID = '78787878-7878-4787-8787-787878787878';

// A ticket closed as "no document needed": listed when that status is asked
// for, with the match that settled its row.
const CLOSED = bankRow({
  id: CLOSED_ID,
  direction: 'money_out',
  counterparty_name: 'First Bank',
  description: 'CLOSED FEE',
  ticket_status: 'no_document_needed',
  ticket_status_label: 'No document needed',
  routing_reason: 'bank_fee',
  routing_reason_label: 'Bank fee',
  row_kind: 'matched',
  settled_match: WAITING.settled_match,
});

const REOPEN_URL = `/api/accounting/staff/bank-rows/${CLOSED_ID}/reopen/`;

// The plan as the server sends it (bank_ticket_service.py ReopenPlan._image).
const REOPEN_PLAN: BankReopenPlan = {
  row_id: CLOSED_ID,
  row: { date: '2026-09-20', direction: 'money_out', amount: '80.00', currency: 'CAD' },
  ticket: {
    before: { status: 'no_document_needed', routing_reason: 'bank_fee' },
    after: { status: 'waiting_document', routing_reason: null },
  },
  reason: 'Receipt turned up',
  entry: {
    entry_id: '51515151-0000-4000-8000-000000000003',
    entry_number: 68,
    entry_date: '2026-09-21',
  },
};

const REOPEN = 'Reopen';
const REOPEN_TITLE = 'Reopen this ticket?';
const REOPEN_DONE = 'Reopened: waiting for a document again.';

const reopenReason = () => screen.getByRole('textbox', { name: 'Reason for reopening' });

// Opens the closed row, asks for the reopen form, gives the reason and asks
// the server for its plan. The button is there once the viewer's role is known.
const previewReopen = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = 'Receipt turned up',
) => {
  await openRow(user, 'CLOSED FEE');
  await user.click(await screen.findByRole('button', { name: REOPEN }));
  await user.type(reopenReason(), reason);
  await user.click(button('Preview'));
};

describe('bank row: reopen', () => {
  it('offers Reopen to a super user on a ticket closed as no document needed', async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED], me: 'super' });
    render(<InternalBankRows />);

    await openRow(user, 'CLOSED FEE');
    expect(await screen.findByRole('button', { name: REOPEN })).toBeEnabled();
    // The ticket is closed, not waiting, and the row is nobody's copy.
    expect(screen.queryByRole('button', { name: NO_DOC })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: MERGE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RELEASE })).not.toBeInTheDocument();
    // Nothing is asked of the server until the form is filled and previewed.
    expect(screen.queryByRole('textbox', { name: 'Reason for reopening' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("never offers Reopen to a reviewer, to a viewer who is not staff, or while the viewer's role is not known", async () => {
    const user = userEvent.setup();
    for (const me of ['reviewer', undefined, 'unanswered'] as const) {
      serve({ rows: [CLOSED], me });
      const view = render(<InternalBankRows />);
      await openRow(user, 'CLOSED FEE');
      await settle();
      expect(screen.queryByRole('button', { name: REOPEN })).not.toBeInTheDocument();
      view.unmount();
    }

    // Control: the same row, opened by a super user, has the button.
    serve({ rows: [CLOSED], me: 'super' });
    render(<InternalBankRows />);
    await openRow(user, 'CLOSED FEE');
    expect(await screen.findByRole('button', { name: REOPEN })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('offers Reopen on no other ticket status, and not on a row that has left the books', async () => {
    const user = userEvent.setup();
    serve({
      rows: [
        CLOSED,
        WAITING,
        FLAGGED,
        PLAIN,
        {
          ...CLOSED,
          id: '79797979-0000-4000-8000-000000000001',
          description: 'CLOSED EXCLUDED',
          excluded: true,
          excluded_reason: 'duplicate',
        },
      ],
      me: 'super',
    });
    render(<InternalBankRows />);

    // Control first: once the role is known, the closed row has the button.
    await openRow(user, 'CLOSED FEE');
    expect(await screen.findByRole('button', { name: REOPEN })).toBeInTheDocument();

    for (const description of [
      'MONTHLY FEE',
      'STAPLES STORE #114 TORONTO',
      'REFUND 0042',
      'CLOSED EXCLUDED',
    ]) {
      await openRow(user, description);
      expect(screen.queryByRole('button', { name: REOPEN })).not.toBeInTheDocument();
    }
    expect(post).not.toHaveBeenCalled();
  });

  it('needs a reason for reopening, and holds it to 200 characters', async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED], me: 'super' });
    render(<InternalBankRows />);
    await openRow(user, 'CLOSED FEE');
    await user.click(await screen.findByRole('button', { name: REOPEN }));

    expect(screen.getByText('A reason is required.')).toBeInTheDocument();
    expect(button('Preview')).toBeDisabled();
    // Spaces are not a reason.
    await user.type(reopenReason(), '   ');
    expect(button('Preview')).toBeDisabled();
    await user.type(reopenReason(), 'Receipt turned up');
    expect(button('Preview')).toBeEnabled();
    expect(reopenReason()).toHaveAttribute('maxlength', '200');

    // Cancel puts the form away; nothing was sent.
    await user.click(button('Cancel'));
    expect(screen.queryByRole('textbox', { name: 'Reason for reopening' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('asks for the reopen plan first and shows it; Confirm sends the same request with confirm true, then reads the list again and closes the pane', async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED, PLAIN], me: 'super' });
    post
      .mockResolvedValueOnce(planned(false, REOPEN_PLAN))
      .mockResolvedValueOnce(planned(true, REOPEN_PLAN));
    render(<InternalBankRows />);

    await previewReopen(user, '  Receipt turned up ');
    expect(await screen.findByRole('heading', { name: REOPEN_TITLE })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    // The reason travels trimmed, as the server would record it.
    expect(post).toHaveBeenCalledWith(REOPEN_URL, { reason: 'Receipt turned up', confirm: false });

    const plan = screen.getByRole('region', { name: 'Reopen plan' });
    expect(within(plan).getByText('This ticket will wait for its document again.')).toBeInTheDocument();
    expect(within(plan).getByText('Receipt turned up')).toBeInTheDocument();
    expect(within(plan).getByText('78787878')).toHaveAttribute('title', CLOSED_ID);
    expect(rowRequests()).toHaveLength(1);

    // What the server lists once the ticket is reopened.
    serve({ rows: [PLAIN], me: 'super' });
    await user.click(button('Confirm'));

    expect(await screen.findByText(REOPEN_DONE)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(REOPEN_URL, { reason: 'Receipt turned up', confirm: true });
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    expect(await screen.findByText('REFUND 0042')).toBeInTheDocument();
    expect(screen.queryByText('CLOSED FEE')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: REOPEN_TITLE })).not.toBeInTheDocument();
    expect(pane()).not.toBeInTheDocument();
  });

  it('counts the reopen as carried out only when the server says so: otherwise names the row, claims nothing and reads the list again', async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED, PLAIN], me: 'super' });
    // The confirm comes back 200, but as a plan that was NOT executed.
    post
      .mockResolvedValueOnce(planned(false, REOPEN_PLAN))
      .mockResolvedValueOnce(planned(false, REOPEN_PLAN));
    render(<InternalBankRows />);
    await previewReopen(user);
    await screen.findByRole('heading', { name: REOPEN_TITLE });

    await user.click(button('Confirm'));

    const notice = (await screen.findByText('The server did not carry this out.')).closest(
      '[role="alert"]',
    ) as HTMLElement;
    expect(within(notice).getByText('78787878')).toHaveAttribute('title', CLOSED_ID);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(REOPEN_URL, { reason: 'Receipt turned up', confirm: true });
    expect(screen.queryByText(REOPEN_DONE)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: REOPEN_TITLE })).not.toBeInTheDocument();

    // The list is read again, and the notice is still there once it is back.
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    expect(await screen.findByText('REFUND 0042')).toBeInTheDocument();
    expect(screen.getByText('The server did not carry this out.')).toBeInTheDocument();
    expect(screen.queryByText(REOPEN_DONE)).not.toBeInTheDocument();
  });

  it("shows a refusal by the server's code and in its own words, before the plan or at the confirm", async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED], me: 'super' });
    render(<InternalBankRows />);

    // Refused at the dry run: no plan, no confirm dialog.
    const notLive =
      "This row's entry is no longer live (reversed or corrected), so its ticket cannot be changed here.";
    post.mockResolvedValueOnce({ status: 409, data: { code: 'entry_not_live', detail: notLive } });
    await previewReopen(user);
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent(notLive);
    expect(within(first).getByText('entry_not_live')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: REOPEN_TITLE })).not.toBeInTheDocument();

    // Refused at the confirm: the dialog closes and the refusal takes its place.
    const notClosed = 'This row is not closed as "no document needed".';
    post
      .mockResolvedValueOnce(planned(false, REOPEN_PLAN))
      .mockResolvedValueOnce({
        status: 409,
        data: { code: 'not_no_document_needed', detail: notClosed },
      });
    await user.click(button('Preview'));
    await screen.findByRole('heading', { name: REOPEN_TITLE });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(button('Confirm'));
    const second = await screen.findByRole('alert');
    expect(second).toHaveTextContent(notClosed);
    expect(within(second).getByText('not_no_document_needed')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: REOPEN_TITLE })).not.toBeInTheDocument();

    // Nothing was carried out: the pane stays and the list is not read again.
    expect(pane()).toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);
    expect(screen.queryByText(REOPEN_DONE)).not.toBeInTheDocument();
  });

  it('says the row is no longer available on a 404, with a refresh', async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED, PLAIN], me: 'super' });
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    render(<InternalBankRows />);

    await previewReopen(user);
    expect(await screen.findByText('This row is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: REOPEN_TITLE })).not.toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);

    // Refresh reads the list again; a row that is gone takes its pane with it.
    serve({ rows: [PLAIN], me: 'super' });
    await user.click(button('Refresh'));
    await waitFor(() => expect(rowRequests()).toHaveLength(2));
    await rowOf('REFUND 0042');
    expect(screen.queryByText('This row is no longer available.')).not.toBeInTheDocument();
    expect(pane()).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows the hourly limit on a 429 and does not try again by itself', async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED], me: 'super' });
    post.mockResolvedValue({ status: 429, data: { detail: 'Request was throttled.' } });
    render(<InternalBankRows />);

    await previewReopen(user);
    expect(await screen.findByText(LIMIT)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: REOPEN_TITLE })).not.toBeInTheDocument();

    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(rowRequests()).toHaveLength(1);
    // Asking again is the super user's own choice.
    expect(button('Preview')).toBeEnabled();
  });

  it('keeps the confirm open when the connection is lost: the failure with no code, Confirm ready again, nothing said to be done', async () => {
    const user = userEvent.setup();
    serve({ rows: [CLOSED], me: 'super' });
    post
      .mockResolvedValueOnce(planned(false, REOPEN_PLAN))
      .mockRejectedValueOnce(new Error('network down'));
    render(<InternalBankRows />);
    await previewReopen(user);
    await screen.findByRole('heading', { name: REOPEN_TITLE });

    await user.click(button('Confirm'));

    // The refusal view, in the hook's words and with no code beneath.
    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe('Could not reopen the ticket.');
    expect(screen.getByRole('heading', { name: REOPEN_TITLE })).toBeInTheDocument();
    expect(button('Confirm')).toBeEnabled();
    expect(button('Cancel')).toBeEnabled();
    expect(screen.queryByText(REOPEN_DONE)).not.toBeInTheDocument();
    expect(screen.queryByText('The server did not carry this out.')).not.toBeInTheDocument();
    expect(rowRequests()).toHaveLength(1);

    // Confirm again is the same request again.
    post.mockResolvedValueOnce(planned(true, REOPEN_PLAN));
    await user.click(button('Confirm'));
    expect(await screen.findByText(REOPEN_DONE)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenLastCalledWith(REOPEN_URL, { reason: 'Receipt turned up', confirm: true });
  });
});
