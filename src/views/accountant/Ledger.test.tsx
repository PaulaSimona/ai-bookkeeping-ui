// Accountant ledger (UI2-U2, D-S84-4 / D-S85-16): the registry dropdown that
// replaced "Show voided", and the status badges without a "Needs review" state.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { AccountantLedger } from './Ledger';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// The active client org normally comes from the OrgProvider (Redux-backed).
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({
    activeOrgId: '11111111-1111-4111-8111-111111111111',
    activeOrg: { org_name: 'Birch Inc' },
    needsSelection: false,
  }),
}));
// The drawer reads the current user from the store and toasts through it;
// neither is under test here.
vi.mock('react-redux', () => ({ useSelector: () => null, useDispatch: () => vi.fn() }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;

const ENTRIES_URL = '/api/accounting/entries/';

// What each filter option sends to GET /api/accounting/entries/ (backend
// ledger_chain.registry_entries). "Posted" is the list's default and sends no
// status at all.
const EXPECTED_PARAMS: [label: string, params: Record<string, unknown>][] = [
  ['Posted', { page: 1, page_size: 50 }],
  ['Live', { status: 'live', page: 1, page_size: 50 }],
  ['Corrected', { status: 'corrected', page: 1, page_size: 50 }],
  ['Reversed', { status: 'reversed', page: 1, page_size: 50 }],
  ['Reversal entries', { status: 'reversals', page: 1, page_size: 50 }],
  ['All', { status: 'all', page: 1, page_size: 50 }],
];

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'e-68',
  entry_number: 68,
  entry_number_display: 'JE-0068',
  entry_date: '2026-09-30',
  description: 'September rent',
  source: 'ai',
  status: 'posted',
  needs_review: false,
  created_by: 'user-1',
  voided_at: null,
  voided_by: null,
  void_reason: '',
  source_document_id: null,
  total_debits: '100.00',
  total_credits: '100.00',
  lines: [
    {
      id: 'line-1',
      account_id: 'acc-5000',
      account_code: '5000',
      account_name: 'Rent Expense',
      debit: '100.00',
      credit: null,
      description: '',
      tax_code: '',
      line_order: 0,
    },
  ],
  display_status: 'posted',
  corrected_by: null,
  live_entry: { id: 'e-68', number: 'JE-0068' },
  chain_root: { id: 'e-68', number: 'JE-0068' },
  chain: [{ id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'posted' }],
  chain_truncated: false,
  ...over,
});

const ACCOUNTS_URL = '/api/accounting/accounts/';
// The chart decides which rows get the "Adjust" shortcut (revenue / expense).
const CHART = [
  { id: 'acc-5000', code: '5000', name: 'Rent Expense', type: 'expense', is_active: true, full_name: '5000 — Rent Expense', children: [] },
];

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

// `details` are the entries the detail endpoint answers for, by id.
const serve = (rows: unknown[], details: Record<string, unknown> = {}) => {
  get.mockImplementation(async (url) => {
    if (url === ENTRIES_URL) return page(rows);
    if (url === ACCOUNTS_URL) return page(CHART);
    for (const [id, payload] of Object.entries(details)) {
      if (url === `${ENTRIES_URL}${id}/`) return { status: 200, data: payload };
    }
    return page([]);
  });
};

const entryParams = () =>
  get.mock.calls.filter(([url]) => url === ENTRIES_URL).map(([, config]) => config?.params);
const lastEntryParams = () => {
  const all = entryParams();
  return all[all.length - 1];
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <AccountantLedger />
    </MemoryRouter>,
  );

const statusFilter = () => screen.getByRole('combobox', { name: 'Filter by status' });

beforeEach(() => {
  get.mockReset();
});

describe('accountant ledger — registry filter', () => {
  it('has the shared dropdown in place of the "Show voided" chip', async () => {
    serve([entry()]);
    renderPage();
    await screen.findByText('JE-0068');

    const labels = within(statusFilter()).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(EXPECTED_PARAMS.map(([label]) => label));
    expect(screen.queryByText(/show voided/i)).not.toBeInTheDocument();
  });

  it('sends each option\'s params, and nothing for Posted', async () => {
    serve([entry()]);
    renderPage();
    await screen.findByText('JE-0068');

    // The default view is "Posted": no status goes out — not even 'posted'.
    expect(lastEntryParams()).toEqual(EXPECTED_PARAMS[0][1]);

    for (const [label, params] of EXPECTED_PARAMS.slice(1)) {
      await userEvent.selectOptions(statusFilter(), label);
      await waitFor(() => expect(lastEntryParams()).toEqual(params));
    }

    await userEvent.selectOptions(statusFilter(), 'Posted');
    await waitFor(() => expect(lastEntryParams()).toEqual(EXPECTED_PARAMS[0][1]));
  });

  it('never sends show_voided, under any option', async () => {
    serve([entry()]);
    renderPage();
    await screen.findByText('JE-0068');

    for (const [label, params] of EXPECTED_PARAMS.slice(1)) {
      await userEvent.selectOptions(statusFilter(), label);
      await waitFor(() => expect(lastEntryParams()).toEqual(params));
    }

    // Control: one list request per option was made, so "never" is not vacuous.
    const all = entryParams();
    expect(all).toHaveLength(EXPECTED_PARAMS.length);
    for (const params of all) {
      expect(params).not.toHaveProperty('show_voided');
    }
  });

  it('says so when a filter matches nothing', async () => {
    serve([]);
    renderPage();
    expect(await screen.findByText('No posted entries yet.')).toBeInTheDocument();

    await userEvent.selectOptions(statusFilter(), 'Reversed');
    expect(await screen.findByText('No entries match this filter.')).toBeInTheDocument();
  });
});

describe('accountant ledger — status badges', () => {
  it('never shows "Needs review" in the row or the drawer', async () => {
    serve([entry({ needs_review: true })]);
    renderPage();

    await userEvent.click(await screen.findByText('September rent'));
    // Control: the drawer is open (its totals row is on screen) and its badge
    // reads the registry status — the only "Posted" outside the filter options.
    expect(await screen.findByText('Total')).toBeInTheDocument();
    const badges = screen.getAllByText('Posted').filter((el) => el.tagName !== 'OPTION');
    expect(badges).toHaveLength(1);
    expect(screen.queryByText(/needs review/i)).not.toBeInTheDocument();
  });

  it('flags a corrected, a reversed and a reversal row with its registry status', async () => {
    serve([
      entry({
        id: 'e-70',
        entry_number_display: 'JE-0070',
        description: 'Corrected one',
        display_status: 'corrected',
        corrected_by: { id: 'e-102', number: 'JE-0102' },
        live_entry: { id: 'e-102', number: 'JE-0102' },
      }),
      entry({
        id: 'e-71',
        entry_number_display: 'JE-0071',
        description: 'Reversed one',
        display_status: 'reversed',
        live_entry: null,
      }),
      entry({
        id: 'e-72',
        entry_number_display: 'JE-0072',
        description: 'Reversal one',
        source: 'reversal',
        display_status: 'reversal',
        live_entry: null,
      }),
      entry({ id: 'e-73', entry_number_display: 'JE-0073', description: 'Plain one' }),
    ]);
    renderPage();
    await screen.findByText('JE-0070');

    const rowOf = (description: string) => screen.getByText(description).parentElement as HTMLElement;
    expect(within(rowOf('Corrected one')).getByText('Corrected')).toBeInTheDocument();
    expect(within(rowOf('Reversed one')).getByText('Reversed')).toBeInTheDocument();
    // A reversal's source badge reads "Reversal" as well.
    expect(within(rowOf('Reversal one')).getAllByText('Reversal').length).toBeGreaterThan(0);
    // A plain posted row carries no extra status badge.
    expect(within(rowOf('Plain one')).queryByText('Posted')).not.toBeInTheDocument();
  });
});

describe('accountant ledger — effective totals (D-S85-18)', () => {
  const line = (id: string, debit: string | null, credit: string | null, reverses: string | null) => ({
    id,
    account_id: 'acc-5000',
    account_code: '5000',
    account_name: 'Rent Expense',
    debit,
    credit,
    description: '',
    tax_code: '',
    line_order: 0,
    reverses_line_id: reverses,
  });

  it('lists a correction on the total of its corrected lines; an ordinary entry keeps its total', async () => {
    serve([
      // Two lines reversing the corrected entry, then the two corrected lines:
      // served 200.00, stands for 100.00.
      entry({
        description: 'Correction one',
        source: 'staff_correction',
        total_debits: '200.00',
        total_credits: '200.00',
        lines: [
          line('c1', null, '100.00', 'old-1'),
          line('c2', '100.00', null, 'old-2'),
          line('c3', '100.00', null, null),
          line('c4', null, '100.00', null),
        ],
      }),
      entry({
        id: 'e-90',
        entry_number_display: 'JE-0090',
        description: 'Ordinary one',
        total_debits: '120.00',
        total_credits: '120.00',
        lines: [line('o1', '120.00', null, null), line('o2', null, '120.00', null)],
      }),
    ]);
    renderPage();
    await screen.findByText('Correction one');

    const rowOf = (description: string) => screen.getByText(description).parentElement as HTMLElement;
    expect(rowOf('Correction one')).toHaveTextContent('$100.00');
    expect(rowOf('Correction one')).not.toHaveTextContent('$200.00');
    expect(rowOf('Ordinary one')).toHaveTextContent('$120.00');
  });
});

// JE-0068 was corrected by JE-0102, which is the chain's live entry.
const CORRECTED_CHAIN = [
  { id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'corrected' },
  { id: 'e-102', number: 'JE-0102', date: '2026-10-02', role: 'correction', display_status: 'posted' },
];
const CORRECTED = entry({
  description: 'Corrected one',
  display_status: 'corrected',
  corrected_by: { id: 'e-102', number: 'JE-0102' },
  live_entry: { id: 'e-102', number: 'JE-0102' },
  chain: CORRECTED_CHAIN,
});
const LIVE_CORRECTION = entry({
  id: 'e-102',
  entry_number: 102,
  entry_number_display: 'JE-0102',
  entry_date: '2026-10-02',
  description: 'Live one',
  corrects_entry_id: 'e-68',
  corrects_entry_number_display: 'JE-0068',
  live_entry: { id: 'e-102', number: 'JE-0102' },
  chain: CORRECTED_CHAIN,
});

describe('accountant ledger — actions on the live entry only (D-S85-13)', () => {
  const rowOf = (description: string) => screen.getByText(description).parentElement as HTMLElement;

  it('offers the row Adjust shortcut on a live entry, not on a corrected, reversed or reversal one', async () => {
    serve([
      LIVE_CORRECTION,
      CORRECTED,
      entry({ id: 'e-71', entry_number_display: 'JE-0071', description: 'Reversed one', display_status: 'reversed', live_entry: null }),
      entry({ id: 'e-72', entry_number_display: 'JE-0072', description: 'Reversal one', display_status: 'reversal', live_entry: null }),
    ]);
    renderPage();
    await screen.findByText('Live one');

    // Every row has an expense line, so only the entry kind decides.
    await waitFor(() =>
      expect(within(rowOf('Live one')).getByRole('button', { name: 'Adjust' })).toBeInTheDocument(),
    );
    for (const description of ['Corrected one', 'Reversed one', 'Reversal one']) {
      expect(within(rowOf(description)).queryByRole('button', { name: 'Adjust' })).not.toBeInTheDocument();
    }
  });

  it('opens the live entry from the chain panel, read by id from the detail endpoint', async () => {
    serve([CORRECTED], { 'e-102': LIVE_CORRECTION });
    renderPage();

    await userEvent.click(await screen.findByText('Corrected one'));
    // The corrected entry: its chain, and no writes.
    expect(await screen.findByRole('region', { name: 'Entry history' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adjust this entry' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open JE-0102' }));

    // The drawer is re-targeted to JE-0102 — the live entry — and offers its writes.
    expect(await screen.findByRole('button', { name: 'Adjust this entry' })).toBeInTheDocument();
    expect(screen.getByText('This is the live entry.')).toBeInTheDocument();
    expect(get.mock.calls.map(([url]) => url)).toContain(`${ENTRIES_URL}e-102/`);
  });

  it('says so when the live entry cannot be read', async () => {
    get.mockImplementation(async (url) => {
      if (url === ENTRIES_URL) return page([CORRECTED]);
      if (url === `${ENTRIES_URL}e-102/`) return { status: 404, data: { detail: 'Not found.' } };
      return page([]);
    });
    renderPage();

    await userEvent.click(await screen.findByText('Corrected one'));
    await userEvent.click(await screen.findByRole('button', { name: 'Open JE-0102' }));
    expect(await screen.findByText('Not found.')).toBeInTheDocument();
  });
});
