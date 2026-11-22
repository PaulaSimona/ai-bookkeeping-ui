// LedgerTable and its drawer (S98 P1d item 8, P-7): with no lane they name a
// staff source the way a customer reads it; a staff page passes lane="staff".
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type LedgerLine } from '@/hooks/useReports';
import { type AccountantLedgerRow } from '@/views/accountant/hooks/useAccountantLedger';
import { LedgerTable, type EntryState } from './LedgerTable';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({ activeOrgId: '11111111-1111-4111-8111-111111111111' }),
}));
vi.mock('react-redux', () => ({ useSelector: () => 'user-1', useDispatch: () => vi.fn() }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const line = (over: Partial<LedgerLine>): LedgerLine =>
  ({
    entry_id: 'e-1',
    entry_number: 501,
    entry_date: '2026-03-02',
    description: 'Invented line one',
    counterparty: null,
    source: 'staff_correction',
    source_document_id: null,
    debit: '10.00',
    credit: null,
    running_balance: '10.00',
    ...over,
  }) as LedgerLine;

const LINES = [
  line({}),
  line({ entry_id: 'e-2', entry_number: 502, description: 'Invented line two', source: 'staff_reclassification' }),
  line({ entry_id: 'e-3', entry_number: 503, description: 'Invented line three', source: 'accountant_adjustment' }),
];

const ROW = {
  id: 'e-2',
  entry_number: 502,
  entry_number_display: 'JE-0502',
  entry_date: '2026-03-02',
  description: 'Invented entry memo',
  source: 'staff_reclassification',
  status: 'posted',
  created_by: 'someone-else',
  voided_at: null,
  voided_by: null,
  void_reason: '',
  source_document_id: null,
  total_debits: '10.00',
  total_credits: '10.00',
  lines: [],
  display_status: 'posted',
  corrected_by: null,
  live_entry: { id: 'e-2', number: 'JE-0502' },
  chain_root: { id: 'e-2', number: 'JE-0502' },
  chain: [{ id: 'e-2', number: 'JE-0502', date: '2026-03-02', role: 'original', display_status: 'posted' }],
  chain_truncated: false,
} as unknown as AccountantLedgerRow;

const READY: EntryState = { kind: 'ready', row: ROW };

const renderTable = (lane?: 'customer' | 'staff') =>
  render(
    <LedgerTable
      lines={LINES}
      expandedId="e-2"
      onRowToggle={vi.fn()}
      entry={READY}
      readOnly
      count={3}
      first={1}
      last={3}
      hasPrevious={false}
      hasNext={false}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      documentUrl={() => null}
      lane={lane}
    />,
  );

// The Source cell of the line with this description (the fifth column).
const sourceCell = (description: string): HTMLElement => {
  const row = screen.getByText(description).closest('tr') as HTMLElement;
  return within(row).getAllByRole('cell')[4];
};

// The drawer's header: the entry number, its date and its two badges.
const drawerHeader = (): HTMLElement =>
  screen.getAllByText('JE-0502')[0].parentElement as HTMLElement;

describe('LedgerTable — the source of a staff entry', () => {
  it('with no lane, both staff sources read "Correction" in the column and in the drawer', () => {
    renderTable();

    expect(sourceCell('Invented line one')).toHaveTextContent(/^Correction$/);
    expect(sourceCell('Invented line one')).toHaveAttribute('title', 'Correction');
    expect(sourceCell('Invented line two')).toHaveTextContent(/^Correction$/);
    expect(sourceCell('Invented line three')).toHaveTextContent(/^Accountant adjustment$/);
    expect(within(drawerHeader()).getByText('Correction')).toBeInTheDocument();
    expect(screen.queryByText(/staff/i)).not.toBeInTheDocument();
  });

  it('with lane="staff", the two read apart, in the column and in the drawer', () => {
    renderTable('staff');

    expect(sourceCell('Invented line one')).toHaveTextContent(/^Staff correction$/);
    expect(sourceCell('Invented line two')).toHaveTextContent(/^Staff reclassification$/);
    expect(sourceCell('Invented line three')).toHaveTextContent(/^Accountant adjustment$/);
    expect(within(drawerHeader()).getByText('Staff reclassification')).toBeInTheDocument();
  });
});
