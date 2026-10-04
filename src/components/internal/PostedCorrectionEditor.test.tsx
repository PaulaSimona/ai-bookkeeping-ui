// PostedCorrectionEditor: the shared AccountPicker (UI1-C3, site #1) and the
// correction rules of UI2-U4 — the live-entry gate, the carried line
// descriptions and tax codes, active accounts only, the confirm, and the
// refusal that links to the live entry.
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
const LIVE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACCOUNTS_URL = `/api/accounting/staff/orgs/${ORG}/accounts/`;
const ENTRY_URL = `/api/accounting/staff/entries/${ENTRY_ID}/`;
const CORRECT_URL = `/api/accounting/staff/entries/${ENTRY_ID}/correct/`;

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
  extra: { description?: string; tax_code?: string } = {},
) => ({
  id,
  account_id: `acc-${code}`,
  account_code: code,
  account_name: name,
  debit,
  credit,
  description: extra.description ?? '',
  tax_code: extra.tax_code ?? '',
  line_order: order,
});

// A posted entry that was never corrected or reversed: its chain's live entry.
const postedEntry = (lines: unknown[], over: Record<string, unknown> = {}) => ({
  id: ENTRY_ID,
  entry_number: 12,
  entry_number_display: 'JE-0012',
  entry_date: '2026-09-30',
  description: 'September rent',
  source: 'ai',
  status: 'posted',
  created_by: 'agent',
  total_debits: '100.00',
  total_credits: '100.00',
  corrects_entry_id: null,
  corrects_entry_number_display: null,
  lines,
  display_status: 'posted',
  corrected_by: null,
  live_entry: { id: ENTRY_ID, number: 'JE-0012' },
  chain_root: { id: ENTRY_ID, number: 'JE-0012' },
  chain: [{ id: ENTRY_ID, number: 'JE-0012', date: '2026-09-30', role: 'original', display_status: 'posted' }],
  chain_truncated: false,
  ...over,
});

const ENTRY = postedEntry([
  entryLine('line-1', '5000', 'Rent Expense', '100.00', null, 0, { description: 'Office rent', tax_code: 'HST' }),
  entryLine('line-2', '1000', 'Cash', null, '100.00', 1, { description: 'Paid by cheque' }),
]);

// The same entry once someone else has corrected it: JE-0013 is now live.
const CORRECTED_ENTRY = postedEntry(ENTRY.lines, {
  display_status: 'corrected',
  corrected_by: { id: LIVE_ID, number: 'JE-0013' },
  live_entry: { id: LIVE_ID, number: 'JE-0013' },
  chain: [
    { id: ENTRY_ID, number: 'JE-0012', date: '2026-09-30', role: 'original', display_status: 'corrected' },
    { id: LIVE_ID, number: 'JE-0013', date: '2026-10-02', role: 'correction', display_status: 'posted' },
  ],
});

// The body POST staff/entries/<id>/correct/ takes (backend
// staff_serializers.py StaffCorrectionSerializer): each line carries the
// description and tax code of the line it came from (D-S85-17).
const EXPECTED_BODY = {
  reason: 'Coded to the wrong expense account',
  lines: [
    { account_id: 'acc-5100', side: 'debit', amount: '100.00', description: 'Office rent', tax_code: 'HST' },
    { account_id: 'acc-1000', side: 'credit', amount: '100.00', description: 'Paid by cheque', tax_code: '' },
  ],
};

const CREATED = {
  status: 201,
  data: { id: 'new-entry', entry_number: 13, entry_number_display: 'JE-0013', corrects_entry_id: ENTRY_ID },
};

const page = (results: unknown[], count = results.length, next: string | null = null) => ({
  status: 200,
  data: { count, next, previous: null, results },
});

const serve = (entry: unknown | (() => unknown), accounts: (config?: Config) => unknown) => {
  get.mockImplementation((url, config) => {
    if (url === ENTRY_URL) {
      const data = typeof entry === 'function' ? (entry as () => unknown)() : entry;
      return Promise.resolve({ status: 200, data });
    }
    if (url === ACCOUNTS_URL) return Promise.resolve(accounts(config));
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
};

const renderEditor = () => {
  const handlers = { onClose: vi.fn(), onChanged: vi.fn(), notify: vi.fn(), onOpenEntry: vi.fn() };
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
const postButton = () => screen.getByRole('button', { name: 'Post correction' });
const reasonInput = () => screen.getByPlaceholderText(/Why this entry is wrong/);

const ready = async () => {
  await screen.findByText('Corrected lines');
  await waitFor(() => expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument());
};

// Line 1 from 5000 to 5100, with a reason: a valid, changed, balanced set.
const editFirstLine = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(pickers()[0]);
  await user.keyboard('5100{Enter}');
  await user.type(reasonInput(), 'Coded to the wrong expense account');
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('PostedCorrectionEditor account picker', () => {
  it('posts the correction body for an account chosen through the picker', async () => {
    const user = userEvent.setup();
    serve(ENTRY, () => page(ACCOUNTS));
    post.mockResolvedValue(CREATED);
    const { onClose, onChanged, notify } = renderEditor();
    await ready();

    // Prefilled from the entry, labelled "code — name".
    expect(pickers()).toHaveLength(2);
    expect(pickers()[0]).toHaveValue(L('5000', 'Rent Expense'));
    expect(pickers()[1]).toHaveValue(L('1000', 'Cash'));

    await editFirstLine(user);
    expect(pickers()[0]).toHaveValue(L('5100', 'Office Supplies'));

    await user.click(postButton());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(CORRECT_URL, EXPECTED_BODY);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onChanged).toHaveBeenCalledTimes(1);
    // One correcting entry, not a replacement.
    expect(notify).toHaveBeenCalledWith('Correction posted — JE-0013 corrects JE-0012.', 'success');
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

describe('PostedCorrectionEditor — chart load error (UI2-U6)', () => {
  it('says it once, and disables the line pickers without repeating it', async () => {
    serve(ENTRY, () => ({ status: 500, data: { detail: 'Server error.' } }));
    renderEditor();
    await screen.findByText('Corrected lines');

    // One message on the screen — the banner — however many lines there are.
    await waitFor(() => expect(pickers()[0]).toBeDisabled());
    expect(pickers()).toHaveLength(2);
    expect(pickers()[1]).toBeDisabled();
    expect(screen.getAllByText('Server error.')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(postButton()).toBeDisabled();
  });
});

describe('PostedCorrectionEditor — line descriptions and tax codes (D-S85-17)', () => {
  it('shows each line\'s description and tax code', async () => {
    serve(ENTRY, () => page(ACCOUNTS));
    renderEditor();
    await ready();

    const rows = screen.getAllByRole('row').slice(1); // minus the header row
    expect(rows[0]).toHaveTextContent('Office rent');
    expect(rows[0]).toHaveTextContent('HST');
    expect(rows[1]).toHaveTextContent('Paid by cheque');
  });

  it('sends a kept line\'s description and tax code, and empty ones for a line added here', async () => {
    const user = userEvent.setup();
    serve(ENTRY, () => page(ACCOUNTS));
    post.mockResolvedValue(CREATED);
    renderEditor();
    await ready();

    // Split the expense: 60.00 stays on 5000, a new line takes 40.00 to 5100.
    const amounts = () => screen.getAllByPlaceholderText('0.00');
    await user.clear(amounts()[0]);
    await user.type(amounts()[0], '60');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await user.click(pickers()[2]);
    await user.keyboard('5100{Enter}');
    await user.type(amounts()[2], '40');
    await user.type(reasonInput(), 'Part of this was supplies');

    await user.click(postButton());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(CORRECT_URL, {
      reason: 'Part of this was supplies',
      lines: [
        { account_id: 'acc-5000', side: 'debit', amount: '60.00', description: 'Office rent', tax_code: 'HST' },
        { account_id: 'acc-1000', side: 'credit', amount: '100.00', description: 'Paid by cheque', tax_code: '' },
        { account_id: 'acc-5100', side: 'debit', amount: '40.00', description: '', tax_code: '' },
      ],
    });
  });
});

describe('PostedCorrectionEditor — confirm (D-S85-12)', () => {
  it('posts nothing until the pop-up is confirmed', async () => {
    const user = userEvent.setup();
    serve(ENTRY, () => page(ACCOUNTS));
    post.mockResolvedValue(CREATED);
    renderEditor();
    await ready();
    await editFirstLine(user);

    await user.click(postButton());
    // The pop-up says what the action does: one new entry, not a replacement.
    expect(
      screen.getByText('Posts one new entry that corrects JE-0012. Audited; cannot be undone.'),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  });
});

describe('PostedCorrectionEditor — active accounts only (D-S85-15)', () => {
  it('tags a line on an inactive account and keeps Post disabled until every line is active', async () => {
    const user = userEvent.setup();
    // Both lines are on accounts absent from the active chart.
    serve(
      postedEntry([
        entryLine('line-1', '1999', 'Old Clearing', '100.00', null, 0),
        entryLine('line-2', '1998', 'Old Bank', null, '100.00', 1),
      ]),
      () => page(ACCOUNTS),
    );
    renderEditor();
    await ready();
    await user.type(reasonInput(), 'Accounts were retired');

    expect(screen.getAllByText('inactive')).toHaveLength(2);
    expect(postButton()).toBeDisabled();

    // One line fixed: the set is valid, balanced and changed — still blocked.
    await user.click(pickers()[0]);
    await user.keyboard('5000{Enter}');
    expect(screen.getAllByText('inactive')).toHaveLength(1);
    expect(postButton()).toBeDisabled();

    // Every line on an active account: Post opens up.
    await user.click(pickers()[1]);
    await user.keyboard('1000{Enter}');
    expect(screen.queryByText('inactive')).not.toBeInTheDocument();
    expect(postButton()).toBeEnabled();
  });
});

describe('PostedCorrectionEditor — live entry only (D-S85-13)', () => {
  it('does not offer the editor on an entry that is no longer live, and links to the live one', async () => {
    const user = userEvent.setup();
    serve(CORRECTED_ENTRY, () => page(ACCOUNTS));
    const { onOpenEntry, onChanged } = renderEditor();

    expect(
      await screen.findByText('Corrected by JE-0013. Changes are made on the live entry, JE-0013.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Corrected lines')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post correction' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open JE-0013' }));
    expect(onOpenEntry).toHaveBeenCalledWith({ id: LIVE_ID, number: 'JE-0013' });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('on a 409 already_corrected, shows the server\'s detail and a link to the live entry', async () => {
    const user = userEvent.setup();
    // Live when the editor opens; corrected by someone else by the time it posts.
    let current: unknown = ENTRY;
    serve(() => current, () => page(ACCOUNTS));
    post.mockImplementation(async () => {
      current = CORRECTED_ENTRY;
      return {
        status: 409,
        data: {
          code: 'already_corrected',
          detail: 'This entry has already been corrected.',
          current_status: 'posted',
        },
      };
    });
    const { onClose, onOpenEntry, notify } = renderEditor();
    await ready();
    await editFirstLine(user);

    await user.click(postButton());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    // The server's own words, then — once the entry is re-read — the link.
    expect(await screen.findByText('This entry has already been corrected.')).toBeInTheDocument();
    const open = await screen.findByRole('button', { name: 'Open JE-0013' });
    expect(screen.queryByRole('button', { name: 'Post correction' })).not.toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(open);
    expect(onOpenEntry).toHaveBeenCalledWith({ id: LIVE_ID, number: 'JE-0013' });
  });

  it('shows any other refusal with the server\'s detail and keeps the editor open', async () => {
    const user = userEvent.setup();
    serve(ENTRY, () => page(ACCOUNTS));
    post.mockResolvedValue({
      status: 400,
      data: { code: 'period_locked', detail: 'The period for this date is locked.' },
    });
    const { onClose } = renderEditor();
    await ready();
    await editFirstLine(user);

    await user.click(postButton());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('The period for this date is locked.')).toBeInTheDocument();
    expect(screen.getByText('Corrected lines')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not prefill or offer to correct an entry that is itself a correction', async () => {
    // A correction's lines are the ones reversing the entry it corrects plus
    // its corrected lines; the read does not mark which is which.
    serve(
      postedEntry(
        [
          entryLine('line-1', '5000', 'Rent Expense', null, '100.00', 0),
          entryLine('line-2', '1000', 'Cash', '100.00', null, 1),
          entryLine('line-3', '5100', 'Office Supplies', '100.00', null, 2),
          entryLine('line-4', '1000', 'Cash', null, '100.00', 3),
        ],
        {
          source: 'staff_correction',
          corrects_entry_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          corrects_entry_number_display: 'JE-0009',
        },
      ),
      () => page(ACCOUNTS),
    );
    renderEditor();

    expect(await screen.findByText(/JE-0012 is itself a correction of JE-0009\./)).toBeInTheDocument();
    expect(screen.queryByText('Corrected lines')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post correction' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
