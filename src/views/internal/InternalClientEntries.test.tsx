// Staff client entries (UI2-U2, D-S84-4): the shared registry filter, and the
// status pill without a "Needs review" state.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { InternalClientEntries } from './InternalClientEntries';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const ENTRIES_URL = `/api/accounting/staff/orgs/${ORG}/entries/`;

// What each filter option sends to GET staff/orgs/<org>/entries/ (backend
// ledger_chain.registry_entries). "Posted" is the list's default and sends no
// status at all; 'draft' and 'replaced' would be a 400 there.
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
  posted_at: '2026-09-30T12:00:00Z',
  counterparty: { id: 'cp-1', name: 'Birch Inc' },
  total_debits: '100.00',
  total_credits: '100.00',
  is_balanced: true,
  lines: [],
  created_at: '2026-09-30T12:00:00Z',
  updated_at: '2026-09-30T12:00:00Z',
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
    <MemoryRouter initialEntries={[`/internal/clients/${ORG}/entries`]}>
      <Routes>
        <Route path="/internal/clients/:orgId/entries" element={<InternalClientEntries />} />
      </Routes>
    </MemoryRouter>,
  );

const statusFilter = () => screen.getByRole('combobox', { name: 'Filter by status' });
const rowOf = (number: string) => screen.getByText(number).closest('tr') as HTMLElement;

beforeEach(() => {
  get.mockReset();
});

describe('staff client entries — registry filter', () => {
  it('offers exactly the shared options; Draft and Replaced are gone', async () => {
    serve([entry()]);
    renderPage();
    await screen.findByText('JE-0068');

    const labels = within(statusFilter()).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(EXPECTED_PARAMS.map(([label]) => label));
    expect(labels).not.toContain('Draft');
    expect(labels).not.toContain('Replaced');
  });

  it('sends each option\'s params, and nothing for Posted', async () => {
    serve([entry()]);
    renderPage();
    await screen.findByText('JE-0068');

    // The default view is "Posted": no status goes out.
    expect(lastEntryParams()).toEqual(EXPECTED_PARAMS[0][1]);

    for (const [label, params] of EXPECTED_PARAMS.slice(1)) {
      await userEvent.selectOptions(statusFilter(), label);
      await waitFor(() => expect(lastEntryParams()).toEqual(params));
    }

    // Back to Posted: the status param is dropped again, not sent as 'posted'.
    await userEvent.selectOptions(statusFilter(), 'Posted');
    await waitFor(() => expect(lastEntryParams()).toEqual(EXPECTED_PARAMS[0][1]));
  });

  it('keeps the unassigned toggle alongside the status', async () => {
    serve([entry()]);
    renderPage();
    await screen.findByText('JE-0068');

    await userEvent.selectOptions(statusFilter(), 'Live');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Only unassigned' }));
    await waitFor(() =>
      expect(lastEntryParams()).toEqual({ status: 'live', unattributed: 'true', page: 1, page_size: 50 }),
    );
  });
});

describe('staff client entries — status pill', () => {
  it('never shows "Needs review", whatever the flag says', async () => {
    serve([
      entry({ needs_review: true }),
      entry({
        id: 'e-70',
        entry_number: 70,
        entry_number_display: 'JE-0070',
        needs_review: true,
        display_status: 'corrected',
        corrected_by: { id: 'e-102', number: 'JE-0102' },
        live_entry: { id: 'e-102', number: 'JE-0102' },
      }),
    ]);
    renderPage();
    await screen.findByText('JE-0068');

    // Control: both rows are on screen with their registry status.
    expect(within(rowOf('JE-0068')).getByText('Posted')).toBeInTheDocument();
    expect(within(rowOf('JE-0070')).getByText('Corrected')).toBeInTheDocument();
    expect(screen.queryByText(/needs review/i)).not.toBeInTheDocument();
  });

  it('labels a reversed entry and a reversal entry from display_status', async () => {
    serve([
      entry({ id: 'e-71', entry_number_display: 'JE-0071', display_status: 'reversed', live_entry: null }),
      entry({ id: 'e-72', entry_number_display: 'JE-0072', display_status: 'reversal', live_entry: null }),
    ]);
    renderPage();
    await screen.findByText('JE-0071');

    expect(within(rowOf('JE-0071')).getByText('Reversed')).toBeInTheDocument();
    expect(within(rowOf('JE-0072')).getByText('Reversal')).toBeInTheDocument();
  });
});

// JE-0068 was corrected by JE-0102, which is the chain's live entry.
const CORRECTED_CHAIN = [
  { id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'corrected' },
  { id: 'e-102', number: 'JE-0102', date: '2026-10-02', role: 'correction', display_status: 'posted' },
];
const CORRECTED = entry({
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
  corrects_entry_id: 'e-68',
  corrects_entry_number_display: 'JE-0068',
  live_entry: { id: 'e-102', number: 'JE-0102' },
  chain: CORRECTED_CHAIN,
});

const expand = async (number: string) => userEvent.click(await screen.findByText(number));

describe('staff client entries — writes on the live entry only (D-S85-13)', () => {
  it('offers the staff writes on a live entry', async () => {
    serve([entry()]);
    renderPage();
    await expand('JE-0068');

    expect(await screen.findByRole('button', { name: 'Correct' })).toBeInTheDocument();
    // An entry that was never corrected has no chain panel.
    expect(screen.queryByRole('region', { name: 'Entry history' })).not.toBeInTheDocument();
  });

  it.each([
    ['corrected', CORRECTED, 'Corrected by JE-0102. Changes are made on the live entry, JE-0102.'],
    [
      'reversed',
      entry({
        display_status: 'reversed',
        reversed_by_entry_id: 'e-103',
        reversed_by_entry_number_display: 'JE-0103',
        live_entry: null,
        chain: [
          { id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'reversed' },
          { id: 'e-103', number: 'JE-0103', date: '2026-10-02', role: 'reversal', display_status: 'reversal' },
        ],
      }),
      'Reversed by JE-0103.',
    ],
    [
      'reversal',
      entry({
        source: 'reversal',
        display_status: 'reversal',
        reverses_entry_id: 'e-67',
        reverses_entry_number_display: 'JE-0067',
        live_entry: null,
        chain: [
          { id: 'e-67', number: 'JE-0067', date: '2026-09-29', role: 'original', display_status: 'reversed' },
          { id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'reversal', display_status: 'reversal' },
        ],
      }),
      'Reversal of JE-0067.',
    ],
  ])('offers none on a %s entry; it shows its link and its chain', async (_kind, row, note) => {
    serve([row]);
    renderPage();
    await expand('JE-0068');

    // Control: the panel is open.
    expect(await screen.findByRole('region', { name: 'Entry history' })).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('opens the live entry from the chain panel, read by id from the staff detail endpoint', async () => {
    const DETAIL_URL = '/api/accounting/staff/entries/e-102/';
    get.mockImplementation(async (url) => {
      if (url === ENTRIES_URL) {
        return { status: 200, data: { count: 1, next: null, previous: null, results: [CORRECTED] } };
      }
      if (url === DETAIL_URL) return { status: 200, data: LIVE_CORRECTION };
      return { status: 200, data: { count: 0, next: null, previous: null, results: [] } };
    });
    renderPage();
    await expand('JE-0068');

    await userEvent.click(await screen.findByRole('button', { name: 'Open JE-0102' }));

    // The panel is re-targeted to JE-0102 — the live entry — and offers the writes.
    expect(await screen.findByRole('button', { name: 'Correct' })).toBeInTheDocument();
    expect(screen.getByText('This is the live entry.')).toBeInTheDocument();
    expect(get.mock.calls.map(([url]) => url)).toContain(DETAIL_URL);

    // Back to the row's own entry: its note returns and the writes go.
    await userEvent.click(screen.getByRole('button', { name: 'Back to JE-0068' }));
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Corrected by JE-0102. Changes are made on the live entry, JE-0102.'),
    ).toBeInTheDocument();
  });
});

describe('staff client entries — Merge into… pick mode (D-S85-14)', () => {
  const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

  // Two live entries for the same amount, and one that was corrected.
  const DUPLICATE = entry({ description: 'Rent (entered twice)' });
  const SURVIVOR = entry({
    id: 'e-90',
    entry_number: 90,
    entry_number_display: 'JE-0090',
    description: 'Rent',
    live_entry: { id: 'e-90', number: 'JE-0090' },
    chain_root: { id: 'e-90', number: 'JE-0090' },
    chain: [{ id: 'e-90', number: 'JE-0090', date: '2026-09-30', role: 'original', display_status: 'posted' }],
  });
  const NOT_LIVE = entry({
    id: 'e-70',
    entry_number: 70,
    entry_number_display: 'JE-0070',
    description: 'Old rent',
    display_status: 'corrected',
    corrected_by: { id: 'e-102', number: 'JE-0102' },
    live_entry: { id: 'e-102', number: 'JE-0102' },
  });

  // The body POST staff/entries/<duplicate>/merge-into/ takes.
  const MERGE_URL = '/api/accounting/staff/entries/e-68/merge-into/';
  const MERGE_BODY = { survivor_entry_id: 'e-90', reason: 'Entered twice' };

  const startMerge = async () => {
    serve([DUPLICATE, SURVIVOR, NOT_LIVE]);
    renderPage();
    await userEvent.click(await screen.findByText('JE-0068'));
    await userEvent.click(await screen.findByRole('button', { name: 'Merge into…' }));
  };

  beforeEach(() => {
    post.mockReset();
  });

  it('puts the list into pick mode; clicking a row picks the survivor instead of expanding it', async () => {
    await startMerge();

    expect(screen.getByText('Merge JE-0068 into…')).toBeInTheDocument();
    expect(screen.getByText('Click the entry that should survive in the list below.')).toBeInTheDocument();
    // The duplicate's panel is closed while picking.
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('JE-0090'));
    // The number is now in the merge panel too; the row is the one in the table.
    const pickedRow = within(screen.getByRole('table')).getByText('JE-0090').closest('tr');
    expect(pickedRow).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Surviving entry')).toBeInTheDocument();
    // Picking did not expand the row.
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();
  });

  it('does not let the duplicate itself or a non-live entry be picked', async () => {
    await startMerge();

    await userEvent.click(within(screen.getByRole('table')).getByText('JE-0068'));
    await userEvent.click(screen.getByText('JE-0070'));
    expect(screen.queryByText('Surviving entry')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
  });

  it('the confirm names both entries and both totals, then posts the merge and leaves pick mode', async () => {
    post.mockResolvedValue({
      status: 201,
      data: {
        action: 'merge',
        entry: { id: 'e-68', entry_number: 68 },
        survivor: { id: 'e-90', entry_number: 90 },
        entries_created: [{ id: 'r-1', entry_number: 121, kind: 'reversal' }],
        moved: { bank_state_ids: [], matches_carried: [], matches_unmatched: [], documents: [] },
      },
    });
    await startMerge();
    await userEvent.click(screen.getByText('JE-0090'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Reason' }), 'Entered twice');
    await userEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(screen.getByText('Merge JE-0068 into JE-0090?')).toBeInTheDocument();
    expect(
      screen.getByText(/JE-0068 \(total 100\.00\) is reversed as a duplicate, and its bank links and documents move to JE-0090 \(total 100\.00\)\./),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(MERGE_URL, MERGE_BODY);
    // The page's toast lists what moved, and pick mode is over.
    expect(await screen.findByText(/JE-0068 merged into JE-0090\. Created JE-0121 \(reversal\)\./)).toBeInTheDocument();
    expect(screen.queryByText('Merge JE-0068 into…')).not.toBeInTheDocument();
  });

  it('Cancel leaves pick mode without writing', async () => {
    await startMerge();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Merge JE-0068 into…')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
