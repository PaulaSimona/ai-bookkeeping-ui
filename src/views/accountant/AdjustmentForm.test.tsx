// AdjustmentForm with the shared AccountPicker (UI1-C4, site #9): the request
// body is unchanged, a child account is listed once, and a seeded account that
// is no longer active still shows in its row.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { AdjustmentForm } from './AdjustmentForm';

const ORG = '11111111-1111-4111-8111-111111111111';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// The active client org normally comes from the OrgProvider (Redux-backed).
vi.mock('@/context/OrgContext', () => ({
  useOrgContext: () => ({ activeOrgId: '11111111-1111-4111-8111-111111111111' }),
}));
// The toast dispatches to the Redux store; not under test here.
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ACCOUNTS_URL = '/api/accounting/accounts/';

const L = (code: string, name: string) => `${code} — ${name}`;

const accountRow = (
  code: string,
  name: string,
  type: string,
  extra: Record<string, unknown> = {},
) => ({
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
  ...extra,
});

// The server's flat list: 1010 is its own row AND nested under its parent 1000.
const CHILD = accountRow('1010', 'Chequing', 'asset', { parent_account_id: 'acc-1000' });
const ACCOUNTS = [
  accountRow('1000', 'Cash', 'asset', {
    children: [{ id: CHILD.id, code: '1010', name: 'Chequing', type: 'asset', is_active: true }],
  }),
  CHILD,
  accountRow('5000', 'Rent Expense', 'expense'),
  accountRow('5100', 'Office Supplies', 'expense'),
];

// The body the adjustments endpoint has always received for this entry.
const EXPECTED_BODY = {
  date: '2026-09-30',
  memo: 'Reclass supplies',
  lines: [
    { account_id: 'acc-5100', side: 'debit', amount: '25.00' },
    { account_id: 'acc-5000', side: 'credit', amount: '25.00' },
  ],
};

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

const pickers = () => screen.getAllByRole('combobox', { name: 'Account' });
const ready = () => screen.findAllByRole('combobox', { name: 'Account' });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((url) =>
    Promise.resolve(url === ACCOUNTS_URL ? page(ACCOUNTS) : { status: 404, data: {} }),
  );
});

describe('AdjustmentForm account picker', () => {
  it('posts the unchanged request body for accounts chosen through the picker', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 201, data: { id: 'new-entry' } });
    const onPosted = vi.fn();
    render(<AdjustmentForm initialDate="2026-09-30" onPosted={onPosted} onCancel={vi.fn()} />);
    await ready();

    expect(pickers()).toHaveLength(2);
    expect(pickers()[0]).toHaveAttribute('placeholder', 'Select account…');

    await user.type(screen.getByPlaceholderText('Reason for the adjustment'), 'Reclass supplies');
    await user.click(pickers()[0]);
    await user.keyboard('5100{Enter}');
    await user.type(screen.getAllByLabelText('Debit amount')[0], '25.00');
    await user.click(pickers()[1]);
    await user.keyboard('rent{Enter}');
    await user.type(screen.getAllByLabelText('Credit amount')[1], '25.00');

    await user.click(screen.getByRole('button', { name: 'Post adjustment' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/accounting/adjustments/', EXPECTED_BODY);
    await waitFor(() => expect(onPosted).toHaveBeenCalledTimes(1));
  });

  it('loads every active account of the active org from the accounts endpoint', async () => {
    render(<AdjustmentForm onPosted={vi.fn()} onCancel={vi.fn()} />);
    await ready();
    expect(get.mock.calls).toHaveLength(1);
    expect(get.mock.calls[0][0]).toBe(ACCOUNTS_URL);
    expect(get.mock.calls[0][1]?.params).toEqual({ page: 1, page_size: 200, active: true });
  });

  it('lists a child account once', async () => {
    const user = userEvent.setup();
    render(<AdjustmentForm onPosted={vi.fn()} onCancel={vi.fn()} />);
    await ready();

    await user.click(pickers()[0]);
    const labels = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toEqual([
      L('1000', 'Cash'),
      L('1010', 'Chequing'),
      L('5000', 'Rent Expense'),
      L('5100', 'Office Supplies'),
    ]);
    expect(labels.filter((label) => label === L('1010', 'Chequing'))).toHaveLength(1);
  });

  it('seeds its rows, and still shows a seeded account that is no longer active', async () => {
    render(
      <AdjustmentForm
        seedAccounts={[
          { id: 'acc-1999', code: '1999', name: 'Old Clearing' }, // not in the active list
          { id: 'acc-5000', code: '5000', name: 'Rent Expense' },
        ]}
        onPosted={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await ready();
    expect(pickers().map((p) => (p as HTMLInputElement).value)).toEqual([
      L('1999', 'Old Clearing'),
      L('5000', 'Rent Expense'),
    ]);
  });

  it('tags a seeded inactive account and keeps Post disabled until every line is active (D-S85-19)', async () => {
    const user = userEvent.setup();
    // The adjustments endpoint refuses an inactive account ("Invalid
    // account."), so the form does not offer to post one. 1999 is absent from
    // the active list.
    post.mockResolvedValue({ status: 201, data: { id: 'new-entry' } });
    render(
      <AdjustmentForm
        initialDate="2026-09-30"
        seedAccounts={[
          { id: 'acc-1999', code: '1999', name: 'Old Clearing' },
          { id: 'acc-5000', code: '5000', name: 'Rent Expense' },
        ]}
        onPosted={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await ready();

    // Everything else valid and balanced; only the inactive account blocks.
    await user.type(screen.getByPlaceholderText('Reason for the adjustment'), 'Reclass supplies');
    await user.type(screen.getAllByLabelText('Debit amount')[0], '25.00');
    await user.type(screen.getAllByLabelText('Credit amount')[1], '25.00');
    expect(screen.getAllByText('inactive')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Post adjustment' })).toBeDisabled();

    await user.click(pickers()[0]);
    await user.keyboard('5100{Enter}');
    expect(screen.queryByText('inactive')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post adjustment' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Post adjustment' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/api/accounting/adjustments/', EXPECTED_BODY);
  });

  it('keeps Post disabled until every line has an account', async () => {
    const user = userEvent.setup();
    render(<AdjustmentForm onPosted={vi.fn()} onCancel={vi.fn()} />);
    await ready();

    await user.type(screen.getByPlaceholderText('Reason for the adjustment'), 'Reclass');
    await user.type(screen.getAllByLabelText('Debit amount')[0], '25.00');
    await user.type(screen.getAllByLabelText('Credit amount')[1], '25.00');
    expect(screen.getByRole('button', { name: 'Post adjustment' })).toBeDisabled();
  });
});
