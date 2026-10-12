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
  type BankReleasePlan,
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
