// InternalClientAccountPurposes (S98 P1d item 7): a client's accounts with
// what each is for. Every value on screen is the server's. The control offers
// only the purposes the server allows for the account — the allocation ones
// first, the others behind a deliberate choice — and nothing is written before
// the server's dry run has been shown and confirmed with its preview token.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  ALLOCATION_PURPOSES,
  type AccountPurposePlan,
  type AccountPurposeRow,
} from '@/hooks/useStaffAccountPurposes';
import {
  InternalClientAccountPurposes,
  PURPOSES_GONE,
  PURPOSE_ACCOUNT_GONE,
  PURPOSE_BLOCKED_CHOICE,
  PURPOSE_NOT_EXECUTED,
  PURPOSE_NO_CHANGE,
  PURPOSE_PREVIEW_AGAIN,
  PURPOSE_REFUSALS,
  groupPurposes,
} from './InternalClientAccountPurposes';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

// Invented fixtures only (the repo is public).
const ORG = '11111111-1111-4111-8111-111111111111';
const LIST_URL = `/api/accounting/staff/orgs/${ORG}/account-purposes/`;
const purposeUrl = (id: string) => `/api/accounting/staff/accounts/${id}/purpose/`;

const SUPPLIES: AccountPurposeRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  code: '5100',
  name: 'Office Supplies',
  type: 'expense',
  is_active: true,
  purpose: 'expense',
  allowed_for_allocation: true,
  // Deliberately not in ALLOCATION_PURPOSES order: the server's order is kept.
  allowed_purposes: ['payroll', 'cost_of_sales', 'expense', 'depreciation'],
};
const TAX: AccountPurposeRow = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  code: '1150',
  name: 'Sales Tax Receivable',
  type: 'asset',
  is_active: false,
  purpose: 'tax',
  allowed_for_allocation: false,
  allowed_purposes: ['tax', 'bank'],
};

const TOKEN = 'preview-token-invented-1';
const REASON = 'Supplies are resold, not consumed';

const planOf = (over: Partial<AccountPurposePlan> = {}): AccountPurposePlan => ({
  account_id: SUPPLIES.id,
  code: SUPPLIES.code,
  name: SUPPLIES.name,
  type: SUPPLIES.type,
  before: 'expense',
  after: 'cost_of_sales',
  allowed_for_allocation: true,
  changes: true,
  reason: REASON,
  ...over,
});

const dryRun = (plan: AccountPurposePlan = planOf(), token: string | undefined = TOKEN) => ({
  status: 200,
  data: { executed: false, plan, preview_token: token },
});
const done = (plan: AccountPurposePlan = planOf()) => ({
  status: 200,
  data: { executed: true, plan },
});
const refused = (status: number, data: Record<string, unknown>) => ({ status, data });

const serve = (rows: AccountPurposeRow[] = [SUPPLIES, TAX]) => {
  get.mockImplementation((url) =>
    Promise.resolve(
      url === LIST_URL
        ? { status: 200, data: { count: rows.length, accounts: rows } }
        : { status: 404, data: { detail: 'Not found.' } },
    ),
  );
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/internal/clients/${ORG}/account-purposes`]}>
      <Routes>
        <Route
          path="/internal/clients/:orgId/account-purposes"
          element={<InternalClientAccountPurposes />}
        />
        <Route path="/internal/clients" element={<p>clients list</p>} />
      </Routes>
    </MemoryRouter>,
  );

const rowOf = async (code: string) => (await screen.findByText(code)).closest('tr') as HTMLElement;
const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

const openEditor = async (account: AccountPurposeRow = SUPPLIES) => {
  const user = userEvent.setup();
  renderPage();
  await user.click(
    await screen.findByRole('button', {
      name: `Change the purpose of ${account.code} ${account.name}`,
    }),
  );
  return user;
};

const select = () => screen.getByLabelText('New purpose') as HTMLSelectElement;
const optionValues = () => Array.from(select().options).map((option) => option.value);
const blockedChoice = () => screen.getByRole('checkbox', { name: new RegExp(PURPOSE_BLOCKED_CHOICE) });
const reasonBox = () => screen.getByLabelText('Reason');
const previewButton = () => screen.getByRole('button', { name: 'Preview' });
const confirmButton = () => screen.queryByRole('button', { name: 'Confirm change' });
const planRegion = () => screen.queryByRole('region', { name: 'Server plan' });

// Fill the form for SUPPLIES → cost_of_sales and take the dry run.
const previewed = async (answer: unknown = dryRun()) => {
  const user = await openEditor();
  await user.selectOptions(select(), 'cost_of_sales');
  await user.type(reasonBox(), REASON);
  post.mockResolvedValueOnce(answer);
  await user.click(previewButton());
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  return user;
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  serve();
});

describe('InternalClientAccountPurposes — the list', () => {
  it('reads the org of the route and nothing else', async () => {
    renderPage();
    await rowOf('5100');
    expect(get.mock.calls.map(([url]) => url)).toEqual([LIST_URL]);
    expect(post).not.toHaveBeenCalled();
  });

  it('shows code, name, type, active, purpose and allocation as the server sent them', async () => {
    renderPage();
    expect(cellsOf(await rowOf('5100')).slice(0, 6)).toEqual([
      '5100',
      'Office Supplies',
      'Expense',
      'Yes',
      'Expense',
      'Allowed',
    ]);
    expect(cellsOf(await rowOf('1150')).slice(0, 6)).toEqual([
      '1150',
      'Sales Tax Receivable',
      'Asset',
      'No',
      'Tax',
      'Not allowed',
    ]);
    expect(screen.getAllByRole('columnheader').map((heading) => heading.textContent)).toEqual([
      'Code',
      'Name',
      'Type',
      'Active',
      'Purpose',
      'Purchase allocation',
      'Change',
    ]);
  });

  it('takes allocation from the server flag, never from the purpose', async () => {
    // An allocation purpose the server says is NOT allowed stays "Not allowed".
    serve([{ ...SUPPLIES, allowed_for_allocation: false }]);
    renderPage();
    expect(cellsOf(await rowOf('5100'))[5]).toBe('Not allowed');
  });

  it('shows a loading state, then an empty one', async () => {
    serve([]);
    renderPage();
    expect(screen.getByText('Loading the account purposes…')).toBeInTheDocument();
    expect(await screen.findByText('This client has no accounts.')).toBeInTheDocument();
  });

  it('a 404 reads "gone" with a link back and no table', async () => {
    get.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(PURPOSES_GONE);
    expect(within(alert).getByRole('link', { name: 'Back to clients' })).toHaveAttribute(
      'href',
      '/internal/clients',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('an error can be retried', async () => {
    get.mockResolvedValueOnce({ status: 500, data: {} });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Could not load the account purposes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await rowOf('5100')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('InternalClientAccountPurposes — the purposes offered', () => {
  it('groupPurposes sorts the server list and adds nothing', () => {
    expect(groupPurposes(SUPPLIES.allowed_purposes)).toEqual({
      allocation: ['cost_of_sales', 'expense'],
      blocked: ['payroll', 'depreciation'],
    });
    expect(groupPurposes([])).toEqual({ allocation: [], blocked: [] });
    // Every allocation purpose, and only what was sent.
    expect(groupPurposes([...ALLOCATION_PURPOSES, 'tax'])).toEqual({
      allocation: [...ALLOCATION_PURPOSES],
      blocked: ['tax'],
    });
  });

  it('offers the allocation purposes of the server list first, and no other', async () => {
    await openEditor();
    expect(optionValues()).toEqual(['', 'cost_of_sales', 'expense']);
    expect(blockedChoice()).not.toBeChecked();
  });

  it('offers the blocked purposes only after the deliberate choice', async () => {
    const user = await openEditor();
    await user.selectOptions(select(), 'expense');
    await user.click(blockedChoice());
    expect(optionValues()).toEqual(['', 'payroll', 'depreciation']);
    // The earlier pick does not survive the switch.
    expect(select().value).toBe('');
    await user.click(blockedChoice());
    expect(optionValues()).toEqual(['', 'cost_of_sales', 'expense']);
    expect(select().value).toBe('');
  });

  it('an account with no allocation purpose says so and offers none', async () => {
    await openEditor(TAX);
    expect(optionValues()).toEqual(['']);
    expect(screen.getByText('No allocation purpose fits this account’s type.')).toBeInTheDocument();
  });

  it('an account with only allocation purposes has no blocked choice', async () => {
    serve([{ ...SUPPLIES, allowed_purposes: ['expense', 'inventory'] }]);
    await openEditor();
    expect(optionValues()).toEqual(['', 'expense', 'inventory']);
    expect(
      screen.queryByRole('checkbox', { name: new RegExp(PURPOSE_BLOCKED_CHOICE) }),
    ).not.toBeInTheDocument();
  });
});

describe('InternalClientAccountPurposes — dry run, then confirm', () => {
  it('opening the editor sends nothing', async () => {
    await openEditor();
    expect(post).not.toHaveBeenCalled();
    expect(confirmButton()).not.toBeInTheDocument();
  });

  it('a missing purpose or reason is refused locally, with no request', async () => {
    const user = await openEditor();
    await user.click(previewButton());
    expect(screen.getByText('Choose a purpose.')).toBeInTheDocument();
    expect(screen.getByText('A reason is required.')).toBeInTheDocument();
    await user.selectOptions(select(), 'expense');
    await user.type(reasonBox(), '   ');
    await user.click(previewButton());
    expect(screen.getByText('A reason is required.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('the reason stops at 200 characters and counts down', async () => {
    const user = await openEditor();
    expect(reasonBox()).toHaveAttribute('maxLength', '200');
    expect(screen.getByLabelText('Characters left')).toHaveTextContent('200 of 200 left');
    await user.type(reasonBox(), 'abcde');
    expect(screen.getByLabelText('Characters left')).toHaveTextContent('195 of 200 left');
  });

  it('Preview is a dry run: purpose and trimmed reason, no confirm, no token', async () => {
    const user = await openEditor();
    await user.selectOptions(select(), 'cost_of_sales');
    await user.type(reasonBox(), `  ${REASON}  `);
    post.mockResolvedValueOnce(dryRun());
    await user.click(previewButton());
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]).toEqual([
      purposeUrl(SUPPLIES.id),
      { purpose: 'cost_of_sales', reason: REASON },
    ]);
  });

  it('shows the server plan before confirm: before → after and the allocation answer', async () => {
    await previewed(dryRun(planOf({ after: 'payroll', allowed_for_allocation: false })));
    const plan = await screen.findByRole('region', { name: 'Server plan' });
    // The plan's words, not the form's: the form asked for cost_of_sales.
    expect(plan).toHaveTextContent('5100 Office Supplies: Expense → Payroll');
    expect(plan).toHaveTextContent('After: Not allowed for purchase allocation.');
    expect(confirmButton()).toBeInTheDocument();
  });

  it('Confirm sends the same purpose and reason with the dry run token', async () => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    post.mockResolvedValueOnce(done());
    await user.click(confirmButton() as HTMLElement);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]).toEqual([
      purposeUrl(SUPPLIES.id),
      { purpose: 'cost_of_sales', reason: REASON, confirm: true, preview_token: TOKEN },
    ]);
  });

  it('after the change: a notice in the plan’s words, the editor closed, the list read again', async () => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    post.mockResolvedValueOnce(done());
    serve([{ ...SUPPLIES, purpose: 'cost_of_sales' }, TAX]);
    await user.click(confirmButton() as HTMLElement);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '5100 Office Supplies is now Cost Of Sales. Allowed for purchase allocation.',
    );
    await waitFor(() => expect(screen.queryByLabelText('New purpose')).not.toBeInTheDocument());
    await waitFor(async () => expect(cellsOf(await rowOf('5100'))[4]).toBe('Cost Of Sales'));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('changes:false reads "No change" and cannot be confirmed', async () => {
    await previewed(dryRun(planOf({ after: 'expense', changes: false })));
    const plan = await screen.findByRole('region', { name: 'Server plan' });
    expect(plan).toHaveTextContent(PURPOSE_NO_CHANGE);
    expect(confirmButton()).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('a dry run without a token cannot be confirmed', async () => {
    await previewed({ status: 200, data: { executed: false, plan: planOf() } });
    await screen.findByRole('region', { name: 'Server plan' });
    expect(confirmButton()).not.toBeInTheDocument();
  });

  it('a "dry run" answered as executed is not a preview', async () => {
    await previewed({ status: 200, data: { executed: true, plan: planOf() } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview again');
    expect(planRegion()).not.toBeInTheDocument();
    expect(confirmButton()).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['the purpose', async (user: ReturnType<typeof userEvent.setup>) => user.selectOptions(select(), 'expense')],
    ['the reason', async (user: ReturnType<typeof userEvent.setup>) => user.type(reasonBox(), '!')],
    ['the blocked choice', async (user: ReturnType<typeof userEvent.setup>) => user.click(blockedChoice())],
  ])('an edit of %s after the preview drops the plan and the token', async (_what, edit) => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    await edit(user);
    expect(planRegion()).not.toBeInTheDocument();
    expect(confirmButton()).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('a double click sends one confirm', async () => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    let release: (value: unknown) => void = () => undefined;
    post.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const button = confirmButton() as HTMLElement;
    await user.dblClick(button);
    expect(post).toHaveBeenCalledTimes(2);
    release(done());
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('a confirm answered executed:false with changes:false reads "No change", never a success', async () => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    post.mockResolvedValueOnce({
      status: 200,
      data: { executed: false, plan: planOf({ changes: false }) },
    });
    await user.click(confirmButton() as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(PURPOSE_NO_CHANGE);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(confirmButton()).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a confirm answered executed:false otherwise is not a success either', async () => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    post.mockResolvedValueOnce({ status: 200, data: { executed: false, plan: planOf() } });
    await user.click(confirmButton() as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(PURPOSE_NOT_EXECUTED);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('InternalClientAccountPurposes — refusals', () => {
  it('pins the refusal map', () => {
    expect([...PURPOSE_REFUSALS.keys()]).toEqual([
      'purpose_type_mismatch',
      'preview_invalid',
      'preview_expired',
      'preview_stale',
    ]);
    for (const code of ['preview_invalid', 'preview_expired', 'preview_stale'])
      expect(PURPOSE_REFUSALS.get(code)).toBe(PURPOSE_PREVIEW_AGAIN);
  });

  it('409 purpose_type_mismatch on the dry run: the staff sentence, the code, the server’s words', async () => {
    await previewed(
      refused(409, {
        code: 'purpose_type_mismatch',
        detail: 'Purpose cost_of_sales is not valid for an asset account.',
      }),
    );
    expect(
      await screen.findByText(PURPOSE_REFUSALS.get('purpose_type_mismatch') as string),
    ).toBeInTheDocument();
    expect(screen.getByText('purpose_type_mismatch')).toBeInTheDocument();
    expect(
      screen.getByText('Server: Purpose cost_of_sales is not valid for an asset account.'),
    ).toBeInTheDocument();
    expect(planRegion()).not.toBeInTheDocument();
    expect(confirmButton()).not.toBeInTheDocument();
  });

  it.each(['preview_invalid', 'preview_expired', 'preview_stale'])(
    '409 %s on confirm: "Preview again, then confirm.", and the preview is dropped',
    async (code) => {
      const user = await previewed();
      await screen.findByRole('region', { name: 'Server plan' });
      post.mockResolvedValueOnce(refused(409, { code, detail: 'The preview cannot be used.' }));
      await user.click(confirmButton() as HTMLElement);
      expect(await screen.findByText(PURPOSE_PREVIEW_AGAIN)).toBeInTheDocument();
      expect(screen.getByText(code)).toBeInTheDocument();
      expect(planRegion()).not.toBeInTheDocument();
      expect(confirmButton()).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // A new dry run, then a confirm with the NEW token.
      post.mockResolvedValueOnce(dryRun(planOf(), 'preview-token-invented-2'));
      await user.click(previewButton());
      await screen.findByRole('region', { name: 'Server plan' });
      post.mockResolvedValueOnce(done());
      await user.click(confirmButton() as HTMLElement);
      await waitFor(() => expect(post).toHaveBeenCalledTimes(4));
      expect(post.mock.calls[3][1]).toEqual({
        purpose: 'cost_of_sales',
        reason: REASON,
        confirm: true,
        preview_token: 'preview-token-invented-2',
      });
    },
  );

  it('an unknown 409 code is shown in the server’s words', async () => {
    await previewed(refused(409, { code: 'something_new', detail: 'The server said no.' }));
    expect(await screen.findByText('The server said no.')).toBeInTheDocument();
    expect(screen.getByText('something_new')).toBeInTheDocument();
    expect(screen.queryByText(/^Server:/)).not.toBeInTheDocument();
  });

  it('400 field errors sit next to their fields', async () => {
    await previewed(
      refused(400, { purpose: 'Unknown purpose.', reason: 'The reason is too long.' }),
    );
    expect(await screen.findByText('Unknown purpose.')).toBeInTheDocument();
    expect(select()).toHaveAccessibleDescription('Unknown purpose.');
    expect(reasonBox()).toHaveAccessibleDescription('The reason is too long.');
  });

  it('a 400 on another field is named', async () => {
    await previewed(refused(400, { preview_token: 'This field is required.' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('preview_token: This field is required.');
  });

  it('429 shows the server’s detail and keeps the preview for the same confirm', async () => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    post.mockResolvedValueOnce(
      refused(429, { detail: 'Request was throttled. Expected available in 40 seconds.' }),
    );
    await user.click(confirmButton() as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Request was throttled. Expected available in 40 seconds.',
    );
    expect(planRegion()).toBeInTheDocument();
    post.mockResolvedValueOnce(done());
    await user.click(confirmButton() as HTMLElement);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    expect(post.mock.calls[2]).toEqual(post.mock.calls[1]);
  });

  it('a confirm that got no answer may be sent again, the same', async () => {
    const user = await previewed();
    await screen.findByRole('region', { name: 'Server plan' });
    post.mockRejectedValueOnce(new Error('network'));
    await user.click(confirmButton() as HTMLElement);
    expect(await screen.findByText('Could not change the purpose.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    post.mockResolvedValueOnce(done());
    await user.click(confirmButton() as HTMLElement);
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(post.mock.calls[2]).toEqual(post.mock.calls[1]);
  });

  it('a 404 says the account is gone; Refresh closes the editor and reads the list again', async () => {
    const user = await previewed(refused(404, { detail: 'Not found.' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(PURPOSE_ACCOUNT_GONE);
    await user.click(within(alert).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('New purpose')).not.toBeInTheDocument();
  });
});
