// Owner account-ledger drill-down (UI2-U3, O-S84-1): the drawer gets the
// registry fields, shows the entry's chain, and "Open JE-xxxx" re-targets it
// through the owner detail endpoint. Read-only: no writes on any entry.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { AccountLedgerPage } from './AccountLedgerPage';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({ activeOrgId: '11111111-1111-4111-8111-111111111111' }),
}));
// The drawer reads the current user from the store and toasts through it.
vi.mock('react-redux', () => ({ useSelector: () => 'user-1', useDispatch: () => vi.fn() }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;

const LEDGER_URL = '/api/accounting/reports/account/5000/ledger/';
const DETAIL_URL = (id: string) => `/api/accounting/entries/${id}/`;

const LEDGER = {
  account: { code: '5000', name: 'Rent Expense', type: 'expense', normal_balance: 'debit' },
  period: { kind: 'ytd', label: 'Year to date', start: '2026-01-01', end: '2026-10-04' },
  opening_balance: '0.00',
  total_debits: '100.00',
  total_credits: '0.00',
  net_change: '100.00',
  closing_balance: '100.00',
  lines: {
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        entry_id: 'e-68',
        entry_number: 68,
        entry_date: '2026-09-30',
        description: 'September rent',
        counterparty: { id: 'cp-1', name: 'Birch Inc' },
        source: 'accountant_adjustment',
        source_document_id: null,
        debit: '100.00',
        credit: null,
        running_balance: '100.00',
      },
    ],
  },
};

// JE-0068 was corrected by JE-0102, which is the chain's live entry.
const CHAIN = [
  { id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'corrected' },
  { id: 'e-102', number: 'JE-0102', date: '2026-10-02', role: 'correction', display_status: 'posted' },
];

const detail = (over: Record<string, unknown>) => ({
  id: 'e-68',
  entry_number: 68,
  entry_number_display: 'JE-0068',
  entry_date: '2026-09-30',
  description: 'Entry memo',
  source: 'accountant_adjustment',
  status: 'posted',
  created_by: 'user-1',
  voided_at: null,
  voided_by: null,
  void_reason: '',
  source_document_id: null,
  counterparty: { id: 'cp-1', name: 'Birch Inc' },
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
  chain_root: { id: 'e-68', number: 'JE-0068' },
  chain: CHAIN,
  chain_truncated: false,
  ...over,
});

const DETAILS: Record<string, unknown> = {
  'e-68': detail({
    display_status: 'corrected',
    corrected_by: { id: 'e-102', number: 'JE-0102' },
    live_entry: { id: 'e-102', number: 'JE-0102' },
  }),
  'e-102': detail({
    id: 'e-102',
    entry_number: 102,
    entry_number_display: 'JE-0102',
    entry_date: '2026-10-02',
    display_status: 'posted',
    corrected_by: null,
    live_entry: { id: 'e-102', number: 'JE-0102' },
    corrects_entry_id: 'e-68',
    corrects_entry_number_display: 'JE-0068',
  }),
};

const urls = () => get.mock.calls.map(([url]) => url);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/accounting/reports/account/5000']}>
      <Routes>
        <Route path="/accounting/reports/account/:code" element={<AccountLedgerPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url) => {
    if (url === LEDGER_URL) return { status: 200, data: LEDGER };
    for (const [id, payload] of Object.entries(DETAILS)) {
      if (url === DETAIL_URL(id)) return { status: 200, data: payload };
    }
    return { status: 404, data: { detail: 'Not found.' } };
  });
});

describe('owner account ledger — the drawer', () => {
  it('shows the entry\'s registry status and its chain', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('September rent'));

    // The detail read keeps the registry fields: the entry reads "Corrected",
    // not "Posted", and its chain is on screen.
    expect(await screen.findByRole('region', { name: 'Entry history' })).toBeInTheDocument();
    expect(
      screen.getByText('Corrected by JE-0102. Changes are made on the live entry, JE-0102.'),
    ).toBeInTheDocument();
    expect(urls()).toContain(DETAIL_URL('e-68'));
  });

  it('opens the live entry, read by id from the owner detail endpoint', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('September rent'));
    await userEvent.click(await screen.findByRole('button', { name: 'Open JE-0102' }));

    expect(await screen.findByText('This is the live entry.')).toBeInTheDocument();
    expect(urls()).toContain(DETAIL_URL('e-102'));
  });

  it('is read-only: no Adjust or Void, even on the live entry', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('September rent'));
    await userEvent.click(await screen.findByRole('button', { name: 'Open JE-0102' }));
    // Control: the live entry — a posted adjustment by the current user, the
    // one entry the accountant drawer would offer both writes on — is shown.
    expect(await screen.findByText('This is the live entry.')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Adjust this entry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void entry' })).not.toBeInTheDocument();
  });
});
