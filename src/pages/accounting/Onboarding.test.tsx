// Onboarding opening balances with the shared AccountPicker (UI1-C5, site #6):
// the request still carries account_code, Enter in the picker never submits the
// surrounding form, 3500 is never offered, and only the owner can pick.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { Onboarding } from './Onboarding';

const ORG = '11111111-1111-4111-8111-111111111111';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
// The active org normally comes from the OrgProvider (Redux-backed).
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({ activeOrgId: '11111111-1111-4111-8111-111111111111' }),
}));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const L = (code: string, name: string) => `${code} — ${name}`;

const accountRow = (code: string, name: string, type: string) => ({
  id: `acc-${code}`,
  org_id: ORG,
  code,
  name,
  type,
  normal_balance: 'debit',
  is_active: true,
  parent_account_id: null,
  parent_account_code: null,
  full_name: L(code, name),
  has_posted_lines: false,
  children: [],
});

const ACCOUNTS = [
  accountRow('1000', 'Cash', 'asset'),
  accountRow('1200', 'Accounts Receivable', 'asset'),
  accountRow('2100', 'Accounts Payable', 'liability'),
  accountRow('3500', 'Opening Balance Equity', 'equity'), // server-owned, never selectable
];

// The body the opening-balance endpoint has always received for this entry.
const EXPECTED_BODY = {
  mode: 'opening_balances',
  books_start_date: '2026-01-01',
  lines: [{ account_code: '1000', debit: '500.00', credit: null }],
};

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

const serve = (role: 'owner' | 'accountant') => {
  get.mockImplementation((url) => {
    if (url === '/api/accounting/me/') {
      return Promise.resolve({
        status: 200,
        data: {
          org_id: ORG,
          org_name: 'Acme Ltd',
          role,
          base_currency: 'CAD',
          has_tax_profile: true,
          opening_balance_choice: null,
          books_start_date: null,
        },
      });
    }
    if (url === '/api/accounting/tax-profile/') {
      return Promise.resolve({
        status: 200,
        data: { country: 'CA', gst_hst_registered: true, province: 'ON', home_currency: 'CAD' },
      });
    }
    if (url === '/api/accounting/accounts/') return Promise.resolve(page(ACCOUNTS));
    return Promise.resolve({ status: 404, data: {} });
  });
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>,
  );

const picker = () => screen.getByRole('combobox', { name: 'Account' });

// To the opening-balances form with one empty line.
const openBalancesForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /Enter opening balances/ }));
  await waitFor(() => expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument());
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('Onboarding opening-balance account picker', () => {
  it('submits account_code, and Enter in the picker never submits the form', async () => {
    const user = userEvent.setup();
    serve('owner');
    post.mockResolvedValue({
      status: 201,
      data: {
        choice: 'opening_balances',
        books_start_date: '2026-01-01',
        locked_through_date: '2025-12-31',
        entry_id: 'entry-1',
      },
    });
    const { container } = renderPage();
    await openBalancesForm(user);

    // Everything the form needs to be submittable, except the account.
    fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2026-01-01' },
    });
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Record opening balance' })).toBeEnabled();
    expect(picker()).toHaveAttribute('placeholder', '— Select account —');

    // Enter with the list open commits the account — and does not submit.
    await user.click(picker());
    await user.keyboard('1000');
    expect(picker()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Enter}');
    expect(picker()).toHaveValue(L('1000', 'Cash'));
    expect(post).not.toHaveBeenCalled();

    // Enter with the list closed does not submit either.
    expect(picker()).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByText('Select an account.')).not.toBeInTheDocument();

    // Control: Enter in a plain input of the same form DOES submit, with the
    // account's CODE in the request.
    await user.type(screen.getByPlaceholderText('Debit'), '500.00{Enter}');
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/accounting/opening-balance/', EXPECTED_BODY);
  });

  it('sizes the picker like the fields in its row', async () => {
    const user = userEvent.setup();
    serve('owner');
    renderPage();
    await openBalancesForm(user);
    // The wizard's own inputs are px-3.5 py-2.5 (inputCls).
    expect(picker()).toHaveClass('px-3.5', 'py-2.5');
    expect(screen.getAllByPlaceholderText('Debit')[0]).toHaveClass('px-3.5', 'py-2.5');
  });

  it('never offers the server-owned 3500 account', async () => {
    const user = userEvent.setup();
    serve('owner');
    renderPage();
    await openBalancesForm(user);

    await user.click(picker());
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      L('1000', 'Cash'),
      L('1200', 'Accounts Receivable'),
      L('2100', 'Accounts Payable'),
    ]);

    await user.keyboard('3500');
    expect(screen.getByText('No matching accounts')).toBeInTheDocument();
  });

  it('loads every active account of the active org', async () => {
    const user = userEvent.setup();
    serve('owner');
    renderPage();
    await openBalancesForm(user);

    const calls = get.mock.calls.filter(([url]) => url === '/api/accounting/accounts/');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]?.params).toEqual({ page: 1, page_size: 200, active: true });
  });

  it('is disabled for anyone but the owner', async () => {
    serve('accountant');
    renderPage();
    // A non-owner cannot choose a mode, so the line editor never opens.
    expect(await screen.findByRole('button', { name: /Enter opening balances/ })).toBeDisabled();
    expect(screen.queryByRole('combobox', { name: 'Account' })).not.toBeInTheDocument();
  });
});
