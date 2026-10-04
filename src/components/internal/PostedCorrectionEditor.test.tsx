// PostedCorrectionEditor with the shared AccountPicker (UI1-C3, site #1): the
// request body is unchanged, Escape in an open picker does not close the
// editor, a line's inactive account still shows, and accounts past the first
// page of 200 are reachable.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { PostedCorrectionEditor } from './PostedCorrectionEditor';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

type Config = { params?: { page?: number } };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const ENTRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOUNTS_URL = `/api/accounting/staff/orgs/${ORG}/accounts/`;
const ENTRY_URL = `/api/accounting/staff/entries/${ENTRY_ID}/`;

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
  accountRow('2100', 'Accounts Payable', 'liability'),
  accountRow('5000', 'Rent Expense', 'expense'),
  accountRow('5100', 'Office Supplies', 'expense'),
];

const entryLine = (
  id: string,
  code: string,
  name: string,
  debit: string | null,
  credit: string | null,
  order: number,
) => ({
  id,
  account_id: `acc-${code}`,
  account_code: code,
  account_name: name,
  debit,
  credit,
  description: '',
  line_order: order,
});

const postedEntry = (lines: unknown[]) => ({
  id: ENTRY_ID,
  entry_number: 12,
  entry_number_display: 'JE-12',
  entry_date: '2026-09-30',
  description: 'September rent',
  source: 'ai',
  status: 'posted',
  created_by: 'agent',
  total_debits: '100.00',
  total_credits: '100.00',
  lines,
});

const ENTRY = postedEntry([
  entryLine('line-1', '5000', 'Rent Expense', '100.00', null, 0),
  entryLine('line-2', '1000', 'Cash', null, '100.00', 1),
]);

// The body the correction endpoint has always received for this edit.
const EXPECTED_BODY = {
  reason: 'Coded to the wrong expense account',
  lines: [
    { account_id: 'acc-5100', side: 'debit', amount: '100.00' },
    { account_id: 'acc-1000', side: 'credit', amount: '100.00' },
  ],
};

const page = (results: unknown[], count = results.length, next: string | null = null) => ({
  status: 200,
  data: { count, next, previous: null, results },
});

const serve = (entry: unknown, accounts: (config?: Config) => unknown) => {
  get.mockImplementation((url, config) => {
    if (url === ENTRY_URL) return Promise.resolve({ status: 200, data: entry });
    if (url === ACCOUNTS_URL) return Promise.resolve(accounts(config));
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
};

const renderEditor = () => {
  const handlers = { onClose: vi.fn(), onChanged: vi.fn(), notify: vi.fn() };
  render(
    <PostedCorrectionEditor
      orgId={ORG}
      entry={{ id: ENTRY_ID, entry_number: 12 }}
      {...handlers}
    />,
  );
  return handlers;
};

const pickers = () => screen.getAllByRole('combobox', { name: 'Account' });

const ready = async () => {
  await screen.findByText('Corrected lines');
  await waitFor(() => expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument());
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('PostedCorrectionEditor account picker', () => {
  it('posts the unchanged request body for an account chosen through the picker', async () => {
    const user = userEvent.setup();
    serve(ENTRY, () => page(ACCOUNTS));
    post.mockResolvedValue({
      status: 201,
      data: { id: 'new-entry', entry_number: 13, entry_number_display: 'JE-13', corrects_entry_id: ENTRY_ID },
    });
    const { onClose, onChanged, notify } = renderEditor();
    await ready();

    // Prefilled from the entry, labelled "code — name".
    expect(pickers()).toHaveLength(2);
    expect(pickers()[0]).toHaveValue(L('5000', 'Rent Expense'));
    expect(pickers()[1]).toHaveValue(L('1000', 'Cash'));

    await user.click(pickers()[0]);
    await user.keyboard('5100{Enter}');
    expect(pickers()[0]).toHaveValue(L('5100', 'Office Supplies'));

    await user.type(
      screen.getByPlaceholderText(/Why this entry is wrong/),
      'Coded to the wrong expense account',
    );
    await user.click(screen.getByRole('button', { name: 'Post correction' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      `/api/accounting/staff/entries/${ENTRY_ID}/correct/`,
      EXPECTED_BODY,
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('JE-13'), 'success');
  });

  it('loads the accounts from the staff endpoint of the org it was given', async () => {
    serve(ENTRY, () => page(ACCOUNTS));
    renderEditor();
    await ready();

    const accountCalls = get.mock.calls.filter(([url]) => url === ACCOUNTS_URL);
    expect(accountCalls).toHaveLength(1);
    expect(accountCalls[0][1]?.params).toEqual({ page: 1, page_size: 200 });
  });

  it('Escape closes an open account list and does not close the editor', async () => {
    const user = userEvent.setup();
    serve(ENTRY, () => page(ACCOUNTS));
    const { onClose } = renderEditor();
    await ready();

    await user.click(pickers()[0]);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(pickers()[0]).toHaveValue(L('5000', 'Rent Expense'));

    // With the list closed, Escape is the editor's again.
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a line account that is not in the active chart, and keeps it selectable', async () => {
    const user = userEvent.setup();
    // 1999 is on the entry but absent from the (active-only) account list.
    serve(
      postedEntry([
        entryLine('line-1', '1999', 'Old Clearing', '100.00', null, 0),
        entryLine('line-2', '1000', 'Cash', null, '100.00', 1),
      ]),
      () => page(ACCOUNTS),
    );
    renderEditor();
    await ready();
    expect(pickers()[0]).toHaveValue(L('1999', 'Old Clearing'));

    await user.click(pickers()[0]);
    await user.keyboard('5000{Enter}');
    expect(pickers()[0]).toHaveValue(L('5000', 'Rent Expense'));

    // The line can be put back to its original account.
    await user.click(pickers()[0]);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: L('1999', 'Old Clearing') }),
    );
    expect(pickers()[0]).toHaveValue(L('1999', 'Old Clearing'));
  });

  it('reaches an account beyond the first page of 200', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 201 }, (_, i) =>
      accountRow(String(6000 + i), `Expense ${i}`, 'expense'),
    );
    serve(ENTRY, (config) =>
      config?.params?.page === 2
        ? page(many.slice(200), 201)
        : page(many.slice(0, 200), 201, 'https://api.example.test/next'),
    );
    renderEditor();
    await ready();

    await user.click(pickers()[0]);
    await user.keyboard('6200');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      L('6200', 'Expense 200'),
    ]);
  });
});
