// InvoiceForm with the shared AccountPicker (UI1-C5, site #10): only revenue
// accounts are offered, the request still carries the account id in
// lines[].account, and a draft line's account that is no longer in the active
// list still shows when the draft is edited.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { InvoiceForm } from './InvoiceForm';

const ORG = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
// The active org normally comes from the OrgProvider (Redux-backed).
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({ activeOrgId: '11111111-1111-4111-8111-111111111111' }),
}));
// The bill-from banner has its own data load; not under test here.
vi.mock('@/components/accounting/BillFromBanner', () => ({ BillFromBanner: () => null }));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

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

// One request for ALL active accounts; the picker narrows them to revenue.
const ACCOUNTS = [
  accountRow('1000', 'Cash', 'asset'),
  accountRow('2100', 'Accounts Payable', 'liability'),
  accountRow('3000', 'Owner Equity', 'equity'),
  accountRow('4000', 'Sales Revenue', 'revenue'),
  accountRow('4100', 'Consulting Revenue', 'revenue'),
  accountRow('5000', 'Rent Expense', 'expense'),
];

const DRAFT = {
  id: INVOICE_ID,
  kind: 'invoice',
  counterparty: 'cp-1',
  related_invoice: null,
  status: 'draft',
  invoice_number: null,
  issue_date: null,
  due_date: null,
  payment_terms: '',
  currency: 'CAD',
  subtotal: null,
  tax_total: null,
  total: null,
  payment_instructions: '',
  notes: '',
  journal_entry: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  lines: [
    {
      id: 'line-1',
      position: 0,
      description: 'Legacy retainer',
      quantity: '1',
      unit_price: '250.00',
      // No longer in the active chart.
      account: 'acc-4900',
      account_code: '4900',
      account_name: 'Old Retainer Revenue',
      tax_treatment: 'taxable',
      tax_rate: null,
      tax_amount: null,
    },
  ],
  payments: [],
  is_overdue: false,
};

// The body the create endpoint has always received for this draft.
const EXPECTED_BODY = {
  counterparty: 'cp-1',
  payment_terms: '',
  issue_date: null,
  notes: '',
  payment_instructions: '',
  lines: [
    {
      description: 'Consulting',
      quantity: '1',
      unit_price: '100.00',
      account: 'acc-4100',
      tax_treatment: 'taxable',
    },
  ],
};

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/accounting/invoices/new" element={<InvoiceForm />} />
        <Route path="/accounting/invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="/accounting/invoices/:id" element={<p>invoice detail</p>} />
      </Routes>
    </MemoryRouter>,
  );

const picker = () => screen.getByRole('combobox', { name: 'Revenue account' });
const accountsLoaded = () =>
  waitFor(() => expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument());

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  get.mockImplementation((url) => {
    if (url === '/api/accounting/me/') {
      return Promise.resolve({
        status: 200,
        data: { org_id: ORG, org_name: 'Acme Ltd', role: 'owner', base_currency: 'CAD' },
      });
    }
    if (url === '/api/accounting/counterparties/') {
      return Promise.resolve(
        page([{ id: 'cp-1', name: 'Birch Inc', email: 'ap@birch.test', payment_terms: '' }]),
      );
    }
    if (url === '/api/accounting/accounts/') return Promise.resolve(page(ACCOUNTS));
    if (url === `/api/accounting/sales-invoices/${INVOICE_ID}/`) {
      return Promise.resolve({ status: 200, data: DRAFT });
    }
    return Promise.resolve({ status: 404, data: {} });
  });
});

describe('InvoiceForm revenue-account picker', () => {
  it('offers revenue accounts only', async () => {
    const user = userEvent.setup();
    renderAt('/accounting/invoices/new');
    await screen.findByRole('combobox', { name: 'Revenue account' });
    await accountsLoaded();

    expect(picker()).toHaveAttribute('placeholder', 'Revenue account…');
    await user.click(picker());
    const list = within(screen.getByRole('listbox'));
    expect(list.getAllByRole('presentation').map((h) => h.textContent)).toEqual(['Revenue']);
    expect(list.getAllByRole('option').map((o) => o.textContent)).toEqual([
      L('4000', 'Sales Revenue'),
      L('4100', 'Consulting Revenue'),
    ]);

    // A non-revenue account cannot be reached by its code either.
    await user.keyboard('5000');
    expect(screen.getByText('No matching accounts')).toBeInTheDocument();
  });

  it('asks for all active accounts once, with no type filter', async () => {
    renderAt('/accounting/invoices/new');
    await screen.findByRole('combobox', { name: 'Revenue account' });
    await accountsLoaded();

    const calls = get.mock.calls.filter(([url]) => url === '/api/accounting/accounts/');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]?.params).toEqual({ page: 1, page_size: 200, active: true });
  });

  it('saves the chosen account id in lines[].account', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 201, data: { id: INVOICE_ID } });
    renderAt('/accounting/invoices/new');
    await screen.findByRole('combobox', { name: 'Revenue account' });
    await accountsLoaded();

    await user.selectOptions(await screen.findByDisplayValue('Select a customer…'), 'cp-1');
    await user.type(screen.getByPlaceholderText('Description'), 'Consulting');
    await user.click(picker());
    await user.keyboard('4100{Enter}');
    expect(picker()).toHaveValue(L('4100', 'Consulting Revenue'));
    await user.type(screen.getByPlaceholderText('Unit price'), '100.00');

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/accounting/sales-invoices/', EXPECTED_BODY);
    expect(await screen.findByText('invoice detail')).toBeInTheDocument();
  });

  it('shows a draft line account that is no longer in the active list', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ status: 200, data: { id: INVOICE_ID } });
    renderAt(`/accounting/invoices/${INVOICE_ID}/edit`);
    await screen.findByRole('combobox', { name: 'Revenue account' });
    await accountsLoaded();

    expect(picker()).toHaveValue(L('4900', 'Old Retainer Revenue'));

    // Saved untouched, the draft keeps that account.
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [url, body] = patch.mock.calls[0];
    expect(url).toBe(`/api/accounting/sales-invoices/${INVOICE_ID}/`);
    expect((body as { lines: { account: string }[] }).lines[0].account).toBe('acc-4900');
  });
});
