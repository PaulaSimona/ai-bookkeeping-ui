// Settings → Chart of accounts (UI1-C6, site #8, D-S85-8): the account form
// no longer offers or sends a parent account, and an account that has a parent
// shows it read-only.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { ChartOfAccountsPanel } from './ChartOfAccountsPanel';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

type Config = { params?: Record<string, string> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const L = (code: string, name: string) => `${code} — ${name}`;

const accountRow = (
  code: string,
  name: string,
  type: string,
  parent: { id: string; code: string } | null = null,
) => ({
  id: `acc-${code}`,
  org_id: ORG,
  code,
  name,
  type,
  normal_balance: 'debit',
  is_active: true,
  parent_account_id: parent?.id ?? null,
  parent_account_code: parent?.code ?? null,
  full_name: L(code, name),
  has_posted_lines: false,
  children: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const CASH = accountRow('1000', 'Cash', 'asset');
const CHEQUING = accountRow('1010', 'Chequing', 'asset', { id: CASH.id, code: '1000' });
const RENT = accountRow('5000', 'Rent Expense', 'expense');

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

const serve = (accounts: unknown[]) => {
  get.mockImplementation((url) => {
    if (url === '/api/accounting/me/') {
      return Promise.resolve({
        status: 200,
        data: { org_id: ORG, org_name: 'Acme Ltd', role: 'owner', base_currency: 'CAD' },
      });
    }
    if (url === '/api/accounting/accounts/') return Promise.resolve(page(accounts));
    return Promise.resolve({ status: 404, data: {} });
  });
};

const dialog = () => screen.getByRole('heading', { level: 2 }).closest('div')!.parentElement!;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
});

describe('ChartOfAccountsPanel parent account', () => {
  it('offers no parent field when adding an account, and sends no parent_account_id', async () => {
    const user = userEvent.setup();
    serve([CASH, CHEQUING, RENT]);
    post.mockResolvedValue({ status: 201, data: accountRow('5999', 'Sundry', 'expense') });
    render(<ChartOfAccountsPanel />);

    await user.click(await screen.findByRole('button', { name: 'Add account' }));
    expect(screen.getByRole('heading', { name: 'Add account' })).toBeInTheDocument();
    expect(within(dialog()).queryByText('Parent account')).not.toBeInTheDocument();
    expect(within(dialog()).queryByText(/None \(top-level\)/)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. 5999'), '5999');
    await user.type(screen.getByPlaceholderText('Account name'), 'Sundry');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/api/accounting/accounts/create/');
    expect(body).toEqual({
      code: '5999',
      name: 'Sundry',
      type: 'expense',
      normal_balance: 'debit',
      is_active: true,
    });
    expect(body).not.toHaveProperty('parent_account_id');
  });

  it('shows an existing parent read-only as "code — name", and sends no parent_account_id on save', async () => {
    const user = userEvent.setup();
    serve([CASH, CHEQUING, RENT]);
    patch.mockResolvedValue({ status: 200, data: CHEQUING });
    render(<ChartOfAccountsPanel />);

    await user.click(await screen.findByRole('button', { name: 'Edit Chequing' }));
    expect(screen.getByRole('heading', { name: 'Edit account' })).toBeInTheDocument();

    const form = within(dialog());
    expect(form.getByText('Parent account')).toBeInTheDocument();
    expect(form.getByText(L('1000', 'Cash'))).toBeInTheDocument();
    // Read-only: the only dropdown left in the form is the account type.
    expect(form.getAllByRole('combobox')).toHaveLength(1);
    expect(form.queryByRole('option', { name: L('1000', 'Cash') })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [url, body] = patch.mock.calls[0];
    expect(url).toBe(`/api/accounting/accounts/${CHEQUING.id}/`);
    expect(body).toEqual({
      code: '1010',
      name: 'Chequing',
      type: 'asset',
      normal_balance: 'debit',
      is_active: true,
    });
    expect(body).not.toHaveProperty('parent_account_id');
  });

  it('shows no parent line for a top-level account', async () => {
    const user = userEvent.setup();
    serve([CASH, CHEQUING, RENT]);
    render(<ChartOfAccountsPanel />);

    await user.click(await screen.findByRole('button', { name: 'Edit Rent Expense' }));
    expect(within(dialog()).queryByText('Parent account')).not.toBeInTheDocument();
  });

  it('falls back to the parent code when the parent is not in the loaded list', async () => {
    const user = userEvent.setup();
    // The list as a search or type filter would leave it: the child without its parent.
    serve([CHEQUING, RENT]);
    render(<ChartOfAccountsPanel />);

    await user.click(await screen.findByRole('button', { name: 'Edit Chequing' }));
    const form = within(dialog());
    expect(form.getByText('Parent account')).toBeInTheDocument();
    expect(form.getByText('1000')).toBeInTheDocument();
  });
});
