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

const serve = (rows: unknown[]) => {
  get.mockImplementation(async (url) =>
    url === ENTRIES_URL
      ? { status: 200, data: { count: rows.length, next: null, previous: null, results: rows } }
      : { status: 200, data: { count: 0, next: null, previous: null, results: [] } },
  );
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
