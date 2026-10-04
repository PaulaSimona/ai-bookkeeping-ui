// EntryDrawer — the shared entry panel (accountant ledger and both
// account-ledger drill-downs).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type AccountantLedgerRow } from '@/views/accountant/hooks/useAccountantLedger';
import { EntryDrawer } from './EntryDrawer';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;

beforeEach(() => {
  get.mockReset();
  // The adjustment form (when open) loads the chart of accounts.
  get.mockResolvedValue({ status: 200, data: { count: 0, next: null, previous: null, results: [] } });
});
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({ activeOrgId: '11111111-1111-4111-8111-111111111111' }),
}));
// The drawer reads the current user from the store and toasts through it.
vi.mock('react-redux', () => ({ useSelector: () => 'user-1', useDispatch: () => vi.fn() }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const row = (over: Partial<AccountantLedgerRow> = {}): AccountantLedgerRow => ({
  id: 'e-68',
  entry_number: 68,
  entry_number_display: 'JE-0068',
  entry_date: '2026-09-30',
  description: 'September rent',
  source: 'accountant_adjustment',
  status: 'posted',
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

const renderDrawer = (
  r: AccountantLedgerRow,
  opts: { readOnly?: boolean; adjustOpen?: boolean; onOpenEntry?: (ref: { id: string; number: string | null }) => void } = {},
) =>
  render(
    <EntryDrawer
      row={r}
      adjustOpen={opts.adjustOpen ?? false}
      onToggleAdjust={vi.fn()}
      onPosted={vi.fn()}
      readOnly={opts.readOnly ?? false}
      onOpenEntry={opts.onOpenEntry}
    />,
  );

// JE-0068 was corrected by JE-0102, which is the chain's live entry.
const CORRECTED_CHAIN = [
  { id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'corrected' },
  { id: 'e-102', number: 'JE-0102', date: '2026-10-02', role: 'correction', display_status: 'posted' },
];
// JE-0070 was reversed by JE-0103: the chain has no live entry.
const REVERSED_CHAIN = [
  { id: 'e-70', number: 'JE-0070', date: '2026-09-01', role: 'original', display_status: 'reversed' },
  { id: 'e-103', number: 'JE-0103', date: '2026-09-02', role: 'reversal', display_status: 'reversal' },
];

// Every row below is a posted accountant adjustment written by the current
// user — the one entry Void is ever offered on — so only the entry KIND decides
// what shows.
const LIVE = row();
const NON_LIVE: Record<'corrected' | 'reversed' | 'reversal', AccountantLedgerRow> = {
  corrected: row({
    display_status: 'corrected',
    corrected_by: { id: 'e-102', number: 'JE-0102' },
    live_entry: { id: 'e-102', number: 'JE-0102' },
    chain: CORRECTED_CHAIN,
  }),
  reversed: row({
    id: 'e-70',
    entry_number_display: 'JE-0070',
    display_status: 'reversed',
    reversed_by_entry_id: 'e-103',
    reversed_by_entry_number_display: 'JE-0103',
    live_entry: null,
    chain_root: { id: 'e-70', number: 'JE-0070' },
    chain: REVERSED_CHAIN,
  }),
  reversal: row({
    id: 'e-103',
    entry_number_display: 'JE-0103',
    display_status: 'reversal',
    reverses_entry_id: 'e-70',
    reverses_entry_number_display: 'JE-0070',
    live_entry: null,
    chain_root: { id: 'e-70', number: 'JE-0070' },
    chain: REVERSED_CHAIN,
  }),
};

const NOTES = {
  corrected: 'Corrected by JE-0102. Changes are made on the live entry, JE-0102.',
  reversed: 'Reversed by JE-0103.',
  reversal: 'Reversal of JE-0070.',
};

describe('EntryDrawer — actions by entry kind (D-S85-13)', () => {
  it('offers Adjust this entry and Void on the live entry', () => {
    renderDrawer(LIVE);
    expect(screen.getByRole('button', { name: 'Adjust this entry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Void entry' })).toBeInTheDocument();
    // A live entry that was never corrected has no note and no chain panel.
    expect(screen.queryByRole('region', { name: 'Entry history' })).not.toBeInTheDocument();
  });

  it.each(['corrected', 'reversed', 'reversal'] as const)(
    'offers neither on a %s entry, and says how it is linked instead',
    (kind) => {
      renderDrawer(NON_LIVE[kind]);
      expect(screen.queryByRole('button', { name: 'Adjust this entry' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Void entry' })).not.toBeInTheDocument();
      expect(screen.getByText(NOTES[kind])).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Entry history' })).toBeInTheDocument();
    },
  );

  it('does not open the adjustment form on a non-live entry', () => {
    // Control: the same request on the live entry opens the form.
    const { unmount } = renderDrawer(LIVE, { adjustOpen: true });
    expect(screen.getByText('New adjusting entry')).toBeInTheDocument();
    unmount();

    renderDrawer(NON_LIVE.corrected, { adjustOpen: true });
    expect(screen.queryByText('New adjusting entry')).not.toBeInTheDocument();
  });

  it('offers no writes on a read-only surface, even on the live entry', () => {
    renderDrawer(LIVE, { readOnly: true });
    expect(screen.queryByRole('button', { name: 'Adjust this entry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void entry' })).not.toBeInTheDocument();
  });
});

describe('EntryDrawer — chain panel (O-S84-1)', () => {
  it('opens the live entry through the page\'s handler', async () => {
    const onOpenEntry = vi.fn();
    renderDrawer(NON_LIVE.corrected, { onOpenEntry });

    await userEvent.click(screen.getByRole('button', { name: 'Open JE-0102' }));
    expect(onOpenEntry).toHaveBeenCalledTimes(1);
    expect(onOpenEntry).toHaveBeenCalledWith({ id: 'e-102', number: 'JE-0102' });
  });

  it('has no link to open when the chain has no live entry', () => {
    renderDrawer(NON_LIVE.reversed, { onOpenEntry: vi.fn() });
    expect(screen.getByText('This chain has no live entry.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Open JE-/ })).not.toBeInTheDocument();
  });

  it('shows the chain on a read-only surface too', () => {
    renderDrawer(NON_LIVE.corrected, { readOnly: true, onOpenEntry: vi.fn() });
    expect(screen.getByRole('region', { name: 'Entry history' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open JE-0102' })).toBeInTheDocument();
  });
});

describe('EntryDrawer — status badge (UI2-U2)', () => {
  it('shows the registry status, labelled by the rule module', () => {
    const { unmount } = renderDrawer(row());
    expect(screen.getByText('Posted')).toBeInTheDocument();
    unmount();

    renderDrawer(
      row({
        display_status: 'corrected',
        corrected_by: { id: 'e-102', number: 'JE-0102' },
        live_entry: { id: 'e-102', number: 'JE-0102' },
      }),
    );
    expect(screen.getByText('Corrected')).toBeInTheDocument();
  });

  it('never shows "Needs review"', () => {
    // The flag is not part of the drawer's row type; a payload carrying it
    // must still not surface.
    renderDrawer({ ...row(), needs_review: true } as AccountantLedgerRow);
    expect(screen.getByText('Posted')).toBeInTheDocument();
    expect(screen.queryByText(/needs review/i)).not.toBeInTheDocument();
  });
});

describe('EntryDrawer — voided text (D-S85-16)', () => {
  it('does not point at a "Show voided" filter that no longer exists', () => {
    renderDrawer(
      row({ status: 'voided', display_status: 'voided', voided_at: '2026-10-01T15:00:00Z', void_reason: 'Duplicate' }),
    );
    // Control: the voided notice is on screen.
    expect(screen.getByText(/Removed from balances/)).toBeInTheDocument();
    expect(screen.getByText(/retained in the audit trail\./)).toBeInTheDocument();
    expect(screen.queryByText(/show voided/i)).not.toBeInTheDocument();
  });
});
