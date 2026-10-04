// RejectCorrectEditor with the shared AccountPicker (UI1-C3, site #2): the
// payload handed to the queue is unchanged, a draft line's inactive account
// still shows, and the options come grouped by type.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import type { ReviewEntry } from '@/hooks/useInternalReview';
import { RejectCorrectEditor } from './RejectCorrectEditor';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const ACCOUNTS_URL = `/api/accounting/staff/orgs/${ORG}/accounts/`;

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
  accountRow('5100', 'Office Supplies', 'expense'),
  accountRow('1000', 'Cash', 'asset'),
  accountRow('5000', 'Rent Expense', 'expense'),
  accountRow('2100', 'Accounts Payable', 'liability'),
];

const draftLine = (
  id: string,
  code: string,
  name: string,
  debit: string | null,
  credit: string | null,
  description: string,
  order: number,
) => ({
  id,
  account_id: `acc-${code}`,
  account_code: code,
  account_name: name,
  debit,
  credit,
  description,
  tax_code: '',
  line_order: order,
});

const draft = (lines: ReviewEntry['lines']): ReviewEntry => ({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  entry_number: 'JE-40',
  entry_date: '2026-09-30',
  description: 'September rent',
  status: 'draft',
  source: 'ai',
  org_id: ORG,
  org_name: 'Acme Ltd',
  confidence: '0.61',
  agent_rationale: null,
  needs_review: true,
  routing_reason: 'low_confidence',
  source_document_id: null,
  source_document_name: null,
  source_document_url: null,
  total_debits: '50.00',
  total_credits: '50.00',
  lines,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
});

const DRAFT = draft([
  draftLine('d1', '5000', 'Rent Expense', '50.00', null, 'Rent', 0),
  draftLine('d2', '1000', 'Cash', null, '50.00', '', 1),
]);

// What the editor has always handed to the queue for this edit.
const EXPECTED_PAYLOAD = {
  reason_code: 'wrong_account',
  note: '',
  lines: [
    {
      account_id: 'acc-5100',
      debit: '50.00',
      credit: null,
      description: 'Rent',
      tax_code: '',
      line_order: 0,
    },
    {
      account_id: 'acc-1000',
      debit: null,
      credit: '50.00',
      description: '',
      tax_code: '',
      line_order: 1,
    },
  ],
};

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

const renderEditor = (entry: ReviewEntry = DRAFT) => {
  const onSubmit = vi.fn();
  render(
    <RejectCorrectEditor
      entry={entry}
      submitting={false}
      errorDetail={null}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  return onSubmit;
};

const pickers = () => screen.getAllByRole('combobox', { name: 'Account' });
const ready = () =>
  waitFor(() => expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument());

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((url) =>
    Promise.resolve(url === ACCOUNTS_URL ? page(ACCOUNTS) : { status: 404, data: {} }),
  );
});

describe('RejectCorrectEditor account picker', () => {
  it('hands the queue the unchanged payload for an account chosen through the picker', async () => {
    const user = userEvent.setup();
    const onSubmit = renderEditor();
    await ready();

    expect(pickers()).toHaveLength(2);
    expect(pickers()[0]).toHaveValue(L('5000', 'Rent Expense'));

    await user.selectOptions(screen.getByDisplayValue('Select a reason…'), 'wrong_account');
    await user.click(pickers()[0]);
    await user.keyboard('5100{Enter}');
    expect(pickers()[0]).toHaveValue(L('5100', 'Office Supplies'));

    await user.click(screen.getByRole('button', { name: 'Post correction' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(EXPECTED_PAYLOAD);
  });

  it('asks for a confirm before posting, and posts nothing until it is given (D-S85-12)', async () => {
    const user = userEvent.setup();
    const onSubmit = renderEditor();
    await ready();
    await user.selectOptions(screen.getByDisplayValue('Select a reason…'), 'wrong_account');

    await user.click(screen.getByRole('button', { name: 'Post correction' }));
    // The pop-up says what the action does; nothing has been submitted.
    expect(screen.getByText('Post correction?')).toBeInTheDocument();
    expect(
      screen.getByText('Posts this entry with your corrected lines. Audited; cannot be undone.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // Cancelling the pop-up submits nothing and leaves the editor as it was.
    const popup = screen.getByText('Post correction?').closest('div')!.parentElement!;
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Post correction?')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Post correction' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('loads the accounts of the org on the entry from the staff endpoint', async () => {
    renderEditor();
    await ready();
    expect(get.mock.calls.map(([url]) => url)).toEqual([ACCOUNTS_URL]);
  });

  it('groups the options by account type', async () => {
    const user = userEvent.setup();
    renderEditor();
    await ready();

    await user.click(pickers()[0]);
    const list = screen.getByRole('listbox');
    expect(
      within(list)
        .getAllByRole('presentation')
        .map((h) => h.textContent),
    ).toEqual(['Assets', 'Liabilities', 'Expenses']);
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual([
      L('1000', 'Cash'),
      L('2100', 'Accounts Payable'),
      L('5000', 'Rent Expense'),
      L('5100', 'Office Supplies'),
    ]);
  });

  it('shows a draft account that is not in the active chart, and keeps it selectable', async () => {
    const user = userEvent.setup();
    const onSubmit = renderEditor(
      draft([
        draftLine('d1', '1999', 'Old Clearing', '50.00', null, '', 0),
        draftLine('d2', '1000', 'Cash', null, '50.00', '', 1),
      ]),
    );
    await ready();
    expect(pickers()[0]).toHaveValue(L('1999', 'Old Clearing'));

    await user.click(pickers()[0]);
    await user.keyboard('5000{Enter}');
    await user.click(pickers()[0]);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: L('1999', 'Old Clearing') }),
    );
    expect(pickers()[0]).toHaveValue(L('1999', 'Old Clearing'));

    // Left on the draft's own account, that is what is submitted.
    await user.selectOptions(screen.getByDisplayValue('Select a reason…'), 'other');
    await user.click(screen.getByRole('button', { name: 'Post correction' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onSubmit.mock.calls[0][0].lines[0].account_id).toBe('acc-1999');
  });

  it('creates a new account without a parent field or parent_account_id, and selects it (D-S85-8)', async () => {
    const user = userEvent.setup();
    const created = accountRow('5999', 'Sundry', 'expense');
    post.mockResolvedValue({ status: 201, data: created });
    renderEditor();
    await ready();

    await user.click(screen.getAllByRole('button', { name: '+ New account' })[0]);
    // The form offers code, name, type and normal balance — no parent.
    expect(screen.queryByText('No parent (optional)')).not.toBeInTheDocument();

    // After the create, the account list is read again and holds the new one.
    get.mockImplementation((url) =>
      Promise.resolve(
        url === ACCOUNTS_URL ? page([...ACCOUNTS, created]) : { status: 404, data: {} },
      ),
    );
    await user.type(screen.getByPlaceholderText('Code'), '5999');
    await user.type(screen.getByPlaceholderText('Name'), 'Sundry');
    await user.click(screen.getByRole('button', { name: 'Create & select' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0];
    expect(url).toBe(ACCOUNTS_URL);
    expect(body).toEqual({
      code: '5999',
      name: 'Sundry',
      type: 'expense',
      normal_balance: 'debit',
    });
    expect(body).not.toHaveProperty('parent_account_id');

    // The new account lands in the line it was created for.
    await waitFor(() => expect(pickers()[0]).toHaveValue(L('5999', 'Sundry')));
  });

  it('does not submit while a line has no account', async () => {
    const user = userEvent.setup();
    const onSubmit = renderEditor();
    await ready();

    await user.selectOptions(screen.getByDisplayValue('Select a reason…'), 'wrong_account');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    expect(pickers()).toHaveLength(3);
    expect(pickers()[2]).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Post correction' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
