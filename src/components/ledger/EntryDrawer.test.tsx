// EntryDrawer — the shared entry panel (accountant ledger and both
// account-ledger drill-downs).
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type AccountantLedgerRow } from '@/views/accountant/hooks/useAccountantLedger';
import { EntryDrawer } from './EntryDrawer';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
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

const renderDrawer = (r: AccountantLedgerRow, readOnly = false) =>
  render(
    <EntryDrawer row={r} adjustOpen={false} onToggleAdjust={vi.fn()} onPosted={vi.fn()} readOnly={readOnly} />,
  );

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
