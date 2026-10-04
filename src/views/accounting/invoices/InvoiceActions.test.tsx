// Credit-note dialog with the shared AccountPicker (UI1-C5, site #11): only
// revenue accounts are offered, and the request still carries the account id
// in lines[].account.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import type { SalesInvoice } from '@/types/salesInvoice';
import { InvoiceActionBar } from './InvoiceActions';

const ORG = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// The active org normally comes from the OrgProvider (Redux-backed).
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({ activeOrgId: '11111111-1111-4111-8111-111111111111' }),
}));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const L = (code: string, name: string) => `${code} — ${name}`;

const accountRow = (code: string, name: string, type: string) => ({
  id: `acc-${code}`,
  org_id: ORG,
  code,
  name,
  type,
  normal_balance: 'credit',
  is_active: true,
  parent_account_id: null,
  parent_account_code: null,
  full_name: L(code, name),
  has_posted_lines: false,
  children: [],
});

const ACCOUNTS = [
  accountRow('1000', 'Cash', 'asset'),
  accountRow('4000', 'Sales Revenue', 'revenue'),
  accountRow('4100', 'Consulting Revenue', 'revenue'),
  accountRow('5000', 'Rent Expense', 'expense'),
];

const ISSUED: SalesInvoice = {
  id: INVOICE_ID,
  kind: 'invoice',
  counterparty: 'cp-1',
  related_invoice: null,
  status: 'issued',
  invoice_number: 12,
  issue_date: '2026-09-30',
  due_date: '2026-10-30',
  payment_terms: 'net_30',
  currency: 'CAD',
  subtotal: '100.00',
  tax_total: '13.00',
  total: '113.00',
  payment_instructions: '',
  notes: '',
  journal_entry: 'entry-1',
  created_at: '2026-09-30T10:00:00Z',
  updated_at: '2026-09-30T10:00:00Z',
  lines: [],
  payments: [],
  is_overdue: false,
};

// The body the credit-notes endpoint has always received for this line.
const EXPECTED_BODY = {
  lines: [
    {
      description: 'Refund for September',
      quantity: '1',
      unit_price: '40.00',
      account: 'acc-4000',
      tax_treatment: 'taxable',
    },
  ],
};

const picker = () => screen.getByRole('combobox', { name: 'Revenue account' });

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  render(
    <MemoryRouter>
      <InvoiceActionBar invoice={ISSUED} canWrite onChanged={vi.fn()} />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: 'Credit note' }));
  await waitFor(() => expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument());
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((url) =>
    Promise.resolve(
      url === '/api/accounting/accounts/'
        ? { status: 200, data: { count: ACCOUNTS.length, next: null, previous: null, results: ACCOUNTS } }
        : { status: 404, data: {} },
    ),
  );
});

describe('Credit-note revenue-account picker', () => {
  it('offers revenue accounts only', async () => {
    const user = userEvent.setup();
    await openDialog(user);

    expect(picker()).toHaveAttribute('placeholder', 'Revenue account…');
    await user.click(picker());
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([L('4000', 'Sales Revenue'), L('4100', 'Consulting Revenue')]);
  });

  it('sends the chosen account id in lines[].account, and choosing it keeps the dialog open', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 201, data: { id: 'credit-note-1' } });
    await openDialog(user);

    await user.type(screen.getByPlaceholderText('Description'), 'Refund for September');
    // The option list is portalled outside the dialog; clicking an option
    // must not count as a click on the dialog's backdrop.
    await user.click(picker());
    await user.click(screen.getByRole('option', { name: L('4000', 'Sales Revenue') }));
    expect(screen.getByText('Create credit note', { selector: 'h3' })).toBeInTheDocument();
    expect(picker()).toHaveValue(L('4000', 'Sales Revenue'));
    await user.type(screen.getByPlaceholderText('Price'), '40.00');

    await user.click(screen.getByRole('button', { name: 'Create credit note' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      `/api/accounting/sales-invoices/${INVOICE_ID}/credit-notes/`,
      EXPECTED_BODY,
    );
  });
});
