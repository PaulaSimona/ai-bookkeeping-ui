// TaxDecisionForm (S98 P1d item 6): decision A or B on one bank row. The
// server's dry run is the only source of the result; the preview token, the
// exact body and the idempotency key travel together. All fixtures are
// invented.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type TaxDecisionPlan, type TaxReviewFile } from '@/hooks/useStaffTaxReview';
import {
  FX_BANK_ACCOUNT,
  FX_EXPENSE,
  FX_FILE_URL,
  FX_ITC,
  FX_ITC_INACTIVE,
  FX_ORG,
  FX_PROJECTS_URL,
  FX_PURPOSES_URL,
  FX_ROW,
  FX_SUPPLIES,
  FX_TAX_COLLECTED,
  taxFile,
} from '@/views/internal/taxReviewFixtures';
import {
  ALLOCATION_GROUP,
  ITC_GROUP,
  ITC_INACTIVE_NOTE,
  LEDGER_HEADING,
  PREVIEW_AGAIN,
  TAX_DECISION_GONE,
  TAX_DECISION_NOT_EXECUTED,
  TAX_DECISION_REFUSALS,
  TaxDecisionForm,
} from './TaxDecisionForm';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const FX_INACTIVE_EXPENSE = 'e0000000-0000-4000-8000-000000000003';
const FX_PROJECT = 'f0000000-0000-4000-8000-000000000001';
const KINDS = ['tax_unverified', 'tax_unexplained_amount'];
const REASON = 'Invented reason for the decision';

const purposeRow = (
  id: string,
  code: string,
  name: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  code,
  name,
  type: 'expense',
  is_active: true,
  purpose: 'expense',
  allowed_for_allocation: true,
  allowed_purposes: ['expense', 'cost_of_sales'],
  ...over,
});

// The client's accounts as the account-purposes read lists them: two that
// may take an allocation, and four that may not be offered.
const PURPOSES = [
  purposeRow(FX_EXPENSE, '9500', 'Invented repairs'),
  purposeRow(FX_SUPPLIES, '9510', 'Invented supplies'),
  purposeRow(FX_INACTIVE_EXPENSE, '9520', 'Invented closed expense', { is_active: false }),
  purposeRow(FX_BANK_ACCOUNT, '9010', 'Invented chequing', {
    type: 'asset',
    purpose: 'bank',
    allowed_for_allocation: false,
  }),
  // Tax-purpose accounts: never allowed for allocation.
  purposeRow(FX_ITC, '9310', 'Invented input tax credits', {
    type: 'asset',
    purpose: 'tax',
    allowed_for_allocation: false,
  }),
  purposeRow(FX_TAX_COLLECTED, '9320', 'Invented tax collected', {
    type: 'liability',
    purpose: 'tax',
    allowed_for_allocation: false,
  }),
];

const PROJECTS = [
  {
    id: FX_PROJECT,
    number: 1,
    reference: 'P-001',
    name: 'Invented deck',
    customer_name: null,
    status: 'active',
  },
];

const PERIOD = { label: '2026-Q4', start: '2026-10-01', end: '2026-12-31', frequency: 'quarterly' };

const plan = (over: Partial<TaxDecisionPlan> = {}): TaxDecisionPlan => ({
  decision: 'A',
  outcome: 'reclassification_posted',
  kinds: KINDS,
  current_lines: [
    { account_id: FX_EXPENSE, account_code: '9500', account_name: 'Invented repairs', amount: '113.00' },
  ],
  target_lines: [
    { account_id: FX_EXPENSE, account_code: '9500', account_name: 'Invented repairs', amount: '100.00' },
    {
      account_id: FX_ITC,
      account_code: '9310',
      account_name: 'Invented input tax credits',
      amount: '13.00',
    },
  ],
  entry_lines: [
    {
      account_id: FX_ITC,
      account_code: '9310',
      account_name: 'Invented input tax credits',
      debit: '13.00',
      credit: null,
    },
    {
      account_id: FX_EXPENSE,
      account_code: '9500',
      account_name: 'Invented repairs',
      debit: null,
      credit: '13.00',
    },
  ],
  entry_description: 'Invented correction: tax moved to input tax credits',
  itc_debit: '13.00',
  tax_breakdown: [{ kind: 'hst', amount: '13.00', recoverable: true }],
  reverses_adjustment_entry_id: null,
  transaction_date: '2026-11-02',
  transaction_date_source: 'extraction',
  original_tax_period: PERIOD,
  adjustment_date: '2026-11-22',
  adjustment_tax_period: PERIOD,
  locked_through_date: '2026-09-30',
  ...over,
});

const planB = (): TaxDecisionPlan =>
  plan({
    decision: 'B',
    outcome: 'no_entry',
    target_lines: null,
    entry_lines: [],
    entry_description: null,
    itc_debit: '0.00',
    tax_breakdown: null,
  });

const previewed = (p: TaxDecisionPlan, token: string) => ({
  status: 200,
  data: { executed: false, plan: p, preview_token: token },
});
const executed = (p: TaxDecisionPlan) => ({
  status: 200,
  data: { executed: true, plan: { ...p, entry_id: 'd0000000-0000-4000-8000-000000000009' } },
});
const refused = (code: string, detail = `server words for ${code}`) => ({
  status: 409,
  data: { code, detail },
});

const serveReads = (purposes: unknown[] = PURPOSES, projects: unknown[] = PROJECTS) => {
  get.mockImplementation((url) => {
    if (url.endsWith('/account-purposes/'))
      return Promise.resolve({ status: 200, data: { count: purposes.length, accounts: purposes } });
    if (url.endsWith('/projects/'))
      return Promise.resolve({
        status: 200,
        data: { count: projects.length, next: null, previous: null, results: projects },
      });
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
};

const renderForm = (file: TaxReviewFile = taxFile()) => {
  const onDecided = vi.fn();
  const onReload = vi.fn();
  render(<TaxDecisionForm rowId={FX_ROW} file={file} onDecided={onDecided} onReload={onReload} />);
  return { onDecided, onReload };
};

const set = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const reason = () => screen.getByLabelText('Reason');
const chooseB = () => fireEvent.click(screen.getByRole('radio', { name: /^B —/ }));
// A, and the accounts of the picker loaded.
const chooseA = async () => {
  fireEvent.click(screen.getByRole('radio', { name: /^A —/ }));
  await waitFor(() => expect(screen.getByLabelText('Account of line 1')).toBeEnabled());
};
const previewButton = () => screen.getByRole('button', { name: 'Preview' });
const confirmButton = () => screen.getByRole('button', { name: 'Confirm decision' });
const queryConfirm = () => screen.queryByRole('button', { name: 'Confirm decision' });
const serverPlan = () => screen.findByRole('region', { name: 'Server plan' });
const queryPlan = () => screen.queryByRole('region', { name: 'Server plan' });
const bodies = () => post.mock.calls.map(([, body]) => body as Record<string, unknown>);

// The tax-folded 113.00 line split into expense 100.00 + ITC 13.00, with the
// HST part. Amounts are typed short on purpose: they must leave as "n.nn".
const fillSplit = async () => {
  await chooseA();
  set(screen.getByLabelText('Amount of line 1'), '100');
  fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));
  set(screen.getByLabelText('Account of line 2'), FX_ITC);
  set(screen.getByLabelText('Amount of line 2'), '13.0');
  fireEvent.click(screen.getByRole('button', { name: 'Add a tax part' }));
  set(screen.getByLabelText('Kind of tax part 1'), 'hst');
  set(screen.getByLabelText('Amount of tax part 1'), '13');
  fireEvent.click(screen.getByLabelText('Tax part 1 is recoverable'));
  set(reason(), REASON);
};

const SPLIT_BODY = {
  decision: 'A',
  kinds: KINDS,
  reason: REASON,
  lines: [
    { account_id: FX_EXPENSE, amount: '100.00' },
    { account_id: FX_ITC, amount: '13.00' },
  ],
  tax_breakdown: [{ kind: 'hst', amount: '13.00', recoverable: true }],
};

// Every amount anywhere in a body is a string, never a number.
const expectStringAmounts = (value: unknown): void => {
  if (Array.isArray(value)) {
    value.forEach(expectStringAmounts);
  } else if (value != null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'amount') expect(typeof inner).toBe('string');
      else expectStringAmounts(inner);
    }
  } else {
    expect(typeof value).not.toBe('number');
  }
};

let uuids = 0;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  uuids = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
    uuids += 1;
    return `00000000-0000-4000-8000-00000000000${uuids}`;
  });
  serveReads();
});

describe('TaxDecisionForm — what it reads', () => {
  it('takes the org from the file: its accounts and its projects, and no list', async () => {
    const other = '22222222-2222-4222-8222-222222222222';
    renderForm(taxFile({ org_id: other }));
    await chooseA();
    const urls = get.mock.calls.map(([url]) => url);
    expect(urls).toContain(`/api/accounting/staff/orgs/${other}/account-purposes/`);
    expect(urls).toContain(`/api/accounting/staff/orgs/${other}/projects/`);
    expect(urls).not.toContain(FX_PURPOSES_URL);
    expect(urls).not.toContain(FX_PROJECTS_URL);
    expect(urls).not.toContain('/api/accounting/orgs/');
    expect(urls).not.toContain('/api/accounting/review/bank/');
    expect(urls.some((url) => url.includes(FX_ORG))).toBe(false);
  });

  it('opening the form sends nothing: a preview is sent only on the click', async () => {
    renderForm();
    await chooseA();
    set(reason(), REASON);
    expect(post).not.toHaveBeenCalled();
  });

  it('shows every open kind once, read-only', () => {
    const file = taxFile();
    renderForm({ ...file, open_conditions: [...file.open_conditions, file.open_conditions[0]] });
    const kinds = screen.getByLabelText('Kinds decided');
    expect(kinds).toHaveTextContent('Tax unverifiedUnexplained amount');
    expect(within(kinds).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(kinds).queryByRole('button')).not.toBeInTheDocument();
  });

  it('counts the reason down from 200 and stops there', () => {
    renderForm();
    expect(screen.getByLabelText('Characters left')).toHaveTextContent('200 of 200 left');
    set(reason(), 'x'.repeat(15));
    expect(screen.getByLabelText('Characters left')).toHaveTextContent('185 of 200 left');
    expect(reason()).toHaveAttribute('maxlength', '200');
  });
});

describe('TaxDecisionForm — the account picker', () => {
  const groups = (select: HTMLElement) =>
    [...select.querySelectorAll('optgroup')].map((group) => [
      group.label,
      [...group.querySelectorAll('option')].map((option) => option.textContent),
    ]);

  it('offers the allocation accounts and, apart, the active ITC accounts — nothing else', async () => {
    const file = taxFile();
    renderForm({
      ...file,
      itc_accounts: [
        ...file.itc_accounts,
        { id: FX_ITC_INACTIVE, code: '9311', name: 'Invented old tax credits', is_active: false },
      ],
    });
    await chooseA();
    const select = screen.getByLabelText('Account of line 1');
    expect(groups(select)).toEqual([
      [ALLOCATION_GROUP, ['9500 Invented repairs', '9510 Invented supplies']],
      [ITC_GROUP, ['9310 Invented input tax credits']],
    ]);
    expect(ITC_GROUP).toBe('Tax credit (ITC)');
    // An inactive account, a bank account, an inactive ITC account and a
    // tax-purpose account that is not in itc_accounts: none is offered.
    expect(select).not.toHaveTextContent('Invented closed expense');
    expect(select).not.toHaveTextContent('Invented chequing');
    expect(select).not.toHaveTextContent('Invented old tax credits');
    expect(select).not.toHaveTextContent('Invented tax collected');
    // One active ITC account: no note about an inactive one.
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('an ITC account sits in its own group even when the purposes read allows it', async () => {
    serveReads([
      PURPOSES[0],
      purposeRow(FX_ITC, '9310', 'Invented input tax credits', { type: 'asset', purpose: 'tax' }),
    ]);
    renderForm();
    await chooseA();
    expect(groups(screen.getByLabelText('Account of line 1'))).toEqual([
      [ALLOCATION_GROUP, ['9500 Invented repairs']],
      [ITC_GROUP, ['9310 Invented input tax credits']],
    ]);
  });

  it('says so when the only ITC account is inactive, and offers no ITC group', async () => {
    renderForm(
      taxFile({
        itc_accounts: [
          { id: FX_ITC_INACTIVE, code: '9311', name: 'Invented old tax credits', is_active: false },
        ],
      }),
    );
    await chooseA();
    expect(screen.getByRole('note')).toHaveTextContent(ITC_INACTIVE_NOTE);
    expect(ITC_INACTIVE_NOTE).toContain('no_active_itc_account');
    expect(groups(screen.getByLabelText('Account of line 1'))).toEqual([
      [ALLOCATION_GROUP, ['9500 Invented repairs', '9510 Invented supplies']],
    ]);
  });

  it('a client with no ITC account gets no ITC group and no note', async () => {
    renderForm(taxFile({ itc_accounts: [] }));
    await chooseA();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(groups(screen.getByLabelText('Account of line 1'))).toHaveLength(1);
  });

  it('pre-fills the lines from the current treatment', async () => {
    renderForm();
    await chooseA();
    expect(screen.getByLabelText('Account of line 1')).toHaveValue(FX_EXPENSE);
    expect(screen.getByLabelText('Amount of line 1')).toHaveValue('113.00');
    expect(screen.getByLabelText('Entered against the current treatment')).toHaveTextContent(
      'Entered 113.00 of 113.00',
    );
  });

  it('a current account that is not offered is named, and must be replaced before a preview', async () => {
    const file = taxFile();
    renderForm({
      ...file,
      current_treatment: [
        { ...file.current_treatment[0], account_id: FX_BANK_ACCOUNT, account_code: '9010', account_name: 'Invented chequing' },
      ],
    });
    await chooseA();
    expect(screen.getByLabelText('Account of line 1')).toHaveValue('');
    expect(screen.getByLabelText('Target line 1')).toHaveTextContent(
      '9010 Invented chequing is not offered',
    );
    set(reason(), REASON);
    fireEvent.click(previewButton());
    expect(await screen.findByText('Choose an account on every line.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('a failed accounts read is an error with a retry, and blocks the preview', async () => {
    get.mockImplementation((url) =>
      Promise.resolve(
        url.endsWith('/account-purposes/')
          ? { status: 500, data: {} }
          : { status: 200, data: { count: 0, results: [] } },
      ),
    );
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /^A —/ }));
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    expect(await screen.findByText('The accounts are not loaded yet.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps the lines between 1 and 20', async () => {
    const file = taxFile();
    renderForm({
      ...file,
      current_treatment: Array.from({ length: 20 }, () => file.current_treatment[0]),
    });
    await chooseA();
    expect(screen.getByRole('button', { name: 'Add a line' })).toBeDisabled();
    for (let n = 20; n > 1; n -= 1) {
      fireEvent.click(screen.getByRole('button', { name: `Remove line ${n}` }));
    }
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add a line' })).toBeEnabled();
  });
});

describe('TaxDecisionForm — decision B', () => {
  it('preview, then confirm with the identical body, its token and its key', async () => {
    post.mockResolvedValueOnce(previewed(planB(), 'tok-b')).mockResolvedValueOnce(executed(planB()));
    const { onDecided } = renderForm();
    chooseB();
    set(reason(), `  ${REASON}  `);
    expect(queryConfirm()).not.toBeInTheDocument();
    fireEvent.click(previewButton());
    const shown = await serverPlan();
    const sent = { decision: 'B', kinds: KINDS, reason: REASON };
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]).toEqual([FX_FILE_URL, sent]);
    expect(shown).toHaveTextContent('No entry will be posted.');
    expect(shown).toHaveTextContent('no_entry');
    expect(shown).toHaveTextContent('Unchanged: the treatment is confirmed as it is.');
    expect(shown).toHaveTextContent('No entry lines.');
    expect(within(shown).getByRole('heading', { name: LEDGER_HEADING })).toBeInTheDocument();
    expect(shown).toHaveTextContent('Nothing new: no entry is posted.');
    expect(onDecided).not.toHaveBeenCalled();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]).toEqual([
      FX_FILE_URL,
      {
        ...sent,
        confirm: true,
        preview_token: 'tok-b',
        idempotency_key: '00000000-0000-4000-8000-000000000001',
      },
    ]);
    expect(onDecided.mock.calls[0][0]).toMatchObject({ decision: 'B', outcome: 'no_entry' });
  });

  it('B never carries lines or a tax breakdown, even after A was filled in', async () => {
    post.mockResolvedValueOnce(previewed(planB(), 'tok-b'));
    renderForm();
    await fillSplit();
    chooseB();
    fireEvent.click(previewButton());
    await serverPlan();
    expect(bodies()[0]).toEqual({ decision: 'B', kinds: KINDS, reason: REASON });
  });
});

describe('TaxDecisionForm — decision A', () => {
  it('a tax-folded line split into expense + ITC goes as two string-amount lines', async () => {
    post.mockResolvedValueOnce(previewed(plan(), 'tok-a')).mockResolvedValueOnce(executed(plan()));
    const { onDecided } = renderForm();
    await fillSplit();
    expect(screen.getByLabelText('Entered against the current treatment')).toHaveTextContent(
      'Entered 113.00 of 113.00',
    );
    fireEvent.click(previewButton());
    await serverPlan();
    expect(post.mock.calls[0]).toEqual([FX_FILE_URL, SPLIT_BODY]);

    fireEvent.click(confirmButton());
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[1]).toEqual([
      FX_FILE_URL,
      {
        ...SPLIT_BODY,
        confirm: true,
        preview_token: 'tok-a',
        idempotency_key: '00000000-0000-4000-8000-000000000001',
      },
    ]);
    // Every amount in every request body is a string; no number anywhere.
    bodies().forEach(expectStringAmounts);
    expect(JSON.stringify(bodies())).not.toMatch(/"amount":\s*\d/);
  });

  it('renders the server plan exactly as sent', async () => {
    post.mockResolvedValueOnce(previewed(plan(), 'tok-a'));
    renderForm();
    await fillSplit();
    fireEvent.click(previewButton());
    const shown = await serverPlan();
    expect(shown).toHaveTextContent('One reclassification entry will be posted.');
    expect(shown).toHaveTextContent('reclassification_posted');
    const cells = (name: string) =>
      within(within(shown).getByRole('table', { name }))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));
    expect(cells('Plan current lines')).toEqual([['9500 Invented repairs', '113.00', '—']]);
    expect(cells('Plan target lines')).toEqual([
      ['9500 Invented repairs', '100.00', '—'],
      ['9310 Invented input tax credits', '13.00', '—'],
    ]);
    // Entry lines: Account, Dr, Cr.
    const entry = within(shown).getByRole('table', { name: 'Plan entry lines' });
    expect(
      within(entry)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Account', 'Dr', 'Cr', 'Job cost']);
    expect(cells('Plan entry lines')).toEqual([
      ['9310 Invented input tax credits', '13.00', '—', '—'],
      ['9500 Invented repairs', '—', '13.00', '—'],
    ]);
    expect(shown).toHaveTextContent('ITC debit13.00');
    expect(shown).toHaveTextContent('Transaction date2026-11-02from the extraction');
    expect(shown).toHaveTextContent(
      'Original tax period2026-Q4 (2026-10-01 to 2026-12-31, quarterly)',
    );
    expect(shown).toHaveTextContent('Adjustment date2026-11-22');
    expect(shown).toHaveTextContent('Books locked through2026-09-30');
    expect(within(shown).getByRole('heading', { name: LEDGER_HEADING })).toBeInTheDocument();
    expect(LEDGER_HEADING).toBe('What the client will see in their ledger');
    expect(shown).toHaveTextContent('Invented correction: tax moved to input tax credits');
  });

  it('the ITC debit shown is the server’s, not a sum of what was typed', async () => {
    post.mockResolvedValueOnce(previewed(plan({ itc_debit: '12.99' }), 'tok-a'));
    renderForm();
    await fillSplit();
    fireEvent.click(previewButton());
    expect(await serverPlan()).toHaveTextContent('ITC debit12.99');
  });

  it('sends the project and the job-cost category only when chosen', async () => {
    post.mockResolvedValueOnce(previewed(plan(), 'tok-a'));
    renderForm();
    await chooseA();
    set(screen.getByLabelText('Project of line 1'), FX_PROJECT);
    set(screen.getByLabelText('Job-cost category of line 1'), 'materials');
    set(reason(), REASON);
    fireEvent.click(previewButton());
    await serverPlan();
    expect(bodies()[0]).toEqual({
      decision: 'A',
      kinds: KINDS,
      reason: REASON,
      lines: [
        {
          account_id: FX_EXPENSE,
          amount: '113.00',
          project_id: FX_PROJECT,
          job_cost_category: 'materials',
        },
      ],
      tax_breakdown: [],
    });
  });

  it('writes a valid amount out to 2 decimals on blur, without dropping the preview', async () => {
    post.mockResolvedValueOnce(previewed(plan(), 'tok-a'));
    renderForm();
    await fillSplit();
    fireEvent.click(previewButton());
    await serverPlan();
    fireEvent.blur(screen.getByLabelText('Amount of line 1'));
    expect(screen.getByLabelText('Amount of line 1')).toHaveValue('100.00');
    fireEvent.blur(screen.getByLabelText('Amount of tax part 1'));
    expect(screen.getByLabelText('Amount of tax part 1')).toHaveValue('13.00');
    expect(queryPlan()).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it.each(['12.345', '0', '0.00', '-5', '1e2', '', 'abc', '1,000.00'])(
    'does not send the amount %j',
    async (amount) => {
      renderForm();
      await chooseA();
      set(screen.getByLabelText('Amount of line 1'), amount);
      set(reason(), REASON);
      fireEvent.click(previewButton());
      expect(
        await screen.findByText('Every amount must be above zero, with at most 2 decimals.'),
      ).toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
    },
  );
});

describe('TaxDecisionForm — the transaction date', () => {
  it('is pre-filled from the file and sent only when the reviewer changes it', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-1'))
      .mockResolvedValueOnce(previewed(planB(), 'tok-2'));
    renderForm();
    const date = screen.getByLabelText('Transaction date (optional)');
    expect(date).toHaveValue('2026-11-03');
    chooseB();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    await serverPlan();
    expect(bodies()[0]).not.toHaveProperty('transaction_date');

    set(date, '2026-11-01');
    expect(queryPlan()).not.toBeInTheDocument();
    fireEvent.click(previewButton());
    await serverPlan();
    expect(bodies()[1]).toEqual({
      decision: 'B',
      kinds: KINDS,
      reason: REASON,
      transaction_date: '2026-11-01',
    });
  });
});

describe('TaxDecisionForm — local checks spare the hourly limit', () => {
  it('no decision and no reason: nothing is sent', async () => {
    renderForm();
    fireEvent.click(previewButton());
    expect(await screen.findByText('Choose A or B.')).toBeInTheDocument();
    expect(screen.getByText('A reason is required.')).toBeInTheDocument();
    expect(reason()).toHaveAccessibleDescription('A reason is required.');
    expect(post).not.toHaveBeenCalled();
  });

  it('a reason of spaces is no reason', async () => {
    renderForm();
    chooseB();
    set(reason(), '   ');
    fireEvent.click(previewButton());
    expect(await screen.findByText('A reason is required.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('TaxDecisionForm — the preview is one unit', () => {
  const edits: [string, () => void][] = [
    ['the reason', () => set(reason(), `${REASON} changed`)],
    ['the decision', () => chooseB()],
    ['the transaction date', () => set(screen.getByLabelText('Transaction date (optional)'), '2026-11-01')],
    ['a line amount', () => set(screen.getByLabelText('Amount of line 1'), '99.00')],
    ['a line account', () => set(screen.getByLabelText('Account of line 1'), FX_SUPPLIES)],
    ['a line project', () => set(screen.getByLabelText('Project of line 1'), FX_PROJECT)],
    ['a line category', () => set(screen.getByLabelText('Job-cost category of line 1'), 'labour')],
    ['an added line', () => fireEvent.click(screen.getByRole('button', { name: 'Add a line' }))],
    ['a removed line', () => fireEvent.click(screen.getByRole('button', { name: 'Remove line 2' }))],
    ['a tax kind', () => set(screen.getByLabelText('Kind of tax part 1'), 'gst')],
    ['a tax amount', () => set(screen.getByLabelText('Amount of tax part 1'), '12.00')],
    ['the recoverable flag', () => fireEvent.click(screen.getByLabelText('Tax part 1 is recoverable'))],
    ['an added tax part', () => fireEvent.click(screen.getByRole('button', { name: 'Add a tax part' }))],
    ['a removed tax part', () => fireEvent.click(screen.getByRole('button', { name: 'Remove tax part 1' }))],
  ];

  it.each(edits)('an edit of %s clears the plan and the confirm button', async (_name, edit) => {
    post.mockResolvedValueOnce(previewed(plan(), 'tok-a'));
    renderForm();
    await fillSplit();
    fireEvent.click(previewButton());
    await serverPlan();
    expect(confirmButton()).toBeEnabled();
    edit();
    expect(queryPlan()).not.toBeInTheDocument();
    expect(queryConfirm()).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('after an edit, the old token and key are never sent again', async () => {
    post
      .mockResolvedValueOnce(previewed(plan(), 'tok-old'))
      .mockResolvedValueOnce(previewed(plan(), 'tok-new'))
      .mockResolvedValueOnce(executed(plan()));
    const { onDecided } = renderForm();
    await fillSplit();
    fireEvent.click(previewButton());
    await serverPlan();
    set(reason(), 'Invented second reason');
    fireEvent.click(previewButton());
    await serverPlan();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
    expect(bodies()[2]).toEqual({
      ...SPLIT_BODY,
      reason: 'Invented second reason',
      confirm: true,
      preview_token: 'tok-new',
      idempotency_key: '00000000-0000-4000-8000-000000000002',
    });
    expect(JSON.stringify(bodies()[2])).not.toContain('tok-old');
  });

  it('a new preview of the same form gets a new key', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-1'))
      .mockResolvedValueOnce(previewed(planB(), 'tok-2'))
      .mockResolvedValueOnce(executed(planB()));
    const { onDecided } = renderForm();
    chooseB();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    await serverPlan();
    fireEvent.click(previewButton());
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    await serverPlan();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
    expect(bodies()[2]).toMatchObject({
      preview_token: 'tok-2',
      idempotency_key: '00000000-0000-4000-8000-000000000002',
    });
  });

  it('a dry run without a token is not a preview to confirm', async () => {
    post.mockResolvedValueOnce({ status: 200, data: { executed: false, plan: planB() } });
    renderForm();
    chooseB();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    expect(
      await screen.findByText('The server did not answer with a preview. Preview again.'),
    ).toBeInTheDocument();
    expect(queryPlan()).not.toBeInTheDocument();
    expect(queryConfirm()).not.toBeInTheDocument();
  });
});

describe('TaxDecisionForm — confirm', () => {
  const toPreview = async () => {
    const handlers = renderForm();
    chooseB();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    await serverPlan();
    return handlers;
  };
  const CONFIRM = {
    decision: 'B',
    kinds: KINDS,
    reason: REASON,
    confirm: true,
    preview_token: 'tok-b',
    idempotency_key: '00000000-0000-4000-8000-000000000001',
  };

  it('a double click sends one confirm', async () => {
    let answer: (value: unknown) => void = () => {};
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const { onDecided } = await toPreview();
    const button = confirmButton();
    // Both clicks land before the page re-renders.
    act(() => {
      button.click();
      button.click();
    });
    expect(post).toHaveBeenCalledTimes(2);
    // While pending, the buttons are disabled and a third click does nothing.
    expect(confirmButton()).toBeDisabled();
    expect(previewButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(post).toHaveBeenCalledTimes(2);
    await act(async () => answer(executed(planB())));
    expect(onDecided).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('a double click on Preview sends one dry run', async () => {
    post.mockImplementationOnce(() => new Promise(() => {}));
    renderForm();
    chooseB();
    set(reason(), REASON);
    const button = previewButton();
    act(() => {
      button.click();
      button.click();
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Previewing…' })).toBeDisabled();
  });

  it('a retry after a network failure resends the same body, token and key', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(executed(planB()));
    const { onDecided } = await toPreview();
    fireEvent.click(confirmButton());
    expect(await screen.findByText('Could not confirm the decision.')).toBeInTheDocument();
    expect(onDecided).not.toHaveBeenCalled();
    // The plan and the button stay: the retry is the same request.
    expect(queryPlan()).toBeInTheDocument();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[1]).toEqual([FX_FILE_URL, CONFIRM]);
    expect(post.mock.calls[2]).toEqual([FX_FILE_URL, CONFIRM]);
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it('a 500 keeps the same request for the retry too', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
      .mockResolvedValueOnce({ status: 500, data: {} })
      .mockResolvedValueOnce(executed(planB()));
    const { onDecided } = await toPreview();
    fireEvent.click(confirmButton());
    expect(await screen.findByText('Could not confirm the decision.')).toBeInTheDocument();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[2]).toEqual([FX_FILE_URL, CONFIRM]);
  });

  it('executed:false is not success', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
      .mockResolvedValueOnce({ status: 200, data: { executed: false, plan: planB() } });
    const { onDecided, onReload } = await toPreview();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(TAX_DECISION_NOT_EXECUTED)).toBeInTheDocument();
    expect(onDecided).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
    expect(queryPlan()).not.toBeInTheDocument();
    expect(queryConfirm()).not.toBeInTheDocument();
  });

  it('a truthy executed that is not true is not success either', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
      .mockResolvedValueOnce({ status: 200, data: { executed: 'yes', plan: planB() } });
    const { onDecided } = await toPreview();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(TAX_DECISION_NOT_EXECUTED)).toBeInTheDocument();
    expect(onDecided).not.toHaveBeenCalled();
  });

  it.each(['preview_invalid', 'preview_expired', 'preview_stale'])(
    '%s on confirm: "Preview again, then confirm.", and the old preview is dropped',
    async (code) => {
      post
        .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
        .mockResolvedValueOnce(refused(code))
        .mockResolvedValueOnce(previewed(planB(), 'tok-c'))
        .mockResolvedValueOnce(executed(planB()));
      const { onDecided } = await toPreview();
      fireEvent.click(confirmButton());
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(PREVIEW_AGAIN);
      expect(alert).toHaveTextContent(code);
      expect(PREVIEW_AGAIN).toBe('Preview again, then confirm.');
      expect(onDecided).not.toHaveBeenCalled();
      expect(queryPlan()).not.toBeInTheDocument();
      expect(queryConfirm()).not.toBeInTheDocument();
      // The next preview binds a new token and a new key.
      fireEvent.click(previewButton());
      await serverPlan();
      fireEvent.click(confirmButton());
      await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
      expect(bodies()[3]).toMatchObject({
        preview_token: 'tok-c',
        idempotency_key: '00000000-0000-4000-8000-000000000002',
      });
    },
  );

  it('a 429 on confirm shows the server’s detail and keeps the request', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
      .mockResolvedValueOnce({
        status: 429,
        data: { detail: 'Invented limit: try again in 12 minutes.' },
      });
    const { onDecided } = await toPreview();
    fireEvent.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invented limit: try again in 12 minutes.',
    );
    expect(onDecided).not.toHaveBeenCalled();
    expect(confirmButton()).toBeEnabled();
  });
});

describe('TaxDecisionForm — refusals', () => {
  const previewRefused = async (response: unknown) => {
    post.mockResolvedValueOnce(response);
    const handlers = renderForm();
    chooseB();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    return handlers;
  };

  it('the map covers every 409 of the decision, and no other code', () => {
    expect([...TAX_DECISION_REFUSALS.keys()].sort()).toEqual(
      [
        'not_in_tax_review',
        'conditions_mismatch',
        'invalid_lines',
        'invalid_amount',
        'account_not_allowed',
        'project_not_allowed',
        'total_mismatch',
        'itc_not_supported',
        'not_registered',
        'transaction_date_required',
        'qst_recoverable_phase2',
        'no_active_itc_account',
        'period_locked',
        'reclassification_invalid',
        'idempotency_key_reused',
        'preview_invalid',
        'preview_expired',
        'preview_stale',
        'invalid_accounts',
        'unbalanced',
        'already_reversed',
        'already_corrected',
      ].sort(),
    );
  });

  it.each([...TAX_DECISION_REFUSALS])(
    '%s: its staff sentence, the code, and the server’s words',
    async (code, sentence) => {
      await previewRefused(refused(code));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(sentence);
      expect(within(alert).getByText(code)).toBeInTheDocument();
      expect(screen.getByText(`Server: server words for ${code}`)).toBeInTheDocument();
      expect(queryPlan()).not.toBeInTheDocument();
      expect(queryConfirm()).not.toBeInTheDocument();
    },
  );

  it('a code the map does not know is shown in the server’s words, with the code', async () => {
    await previewRefused(refused('invented_new_code', 'Invented new refusal.'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invented new refusal.');
    expect(alert).toHaveTextContent('invented_new_code');
    expect(screen.queryByText(/^Server:/)).not.toBeInTheDocument();
  });

  it('an edit clears the refusal', async () => {
    await previewRefused(refused('total_mismatch'));
    await screen.findByRole('alert');
    set(reason(), `${REASON} changed`);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a 404 reads "gone", with a refresh that reads the file again', async () => {
    const { onReload } = await previewRefused({ status: 404, data: { detail: 'Not found.' } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(TAX_DECISION_GONE);
    fireEvent.click(within(alert).getByRole('button', { name: 'Refresh' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('a 429 shows the server’s detail', async () => {
    await previewRefused({
      status: 429,
      data: { detail: 'Invented limit: 30 decisions an hour. Try again in 9 minutes.' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invented limit: 30 decisions an hour. Try again in 9 minutes.',
    );
  });

  it('400 field errors sit next to their fields', async () => {
    post.mockResolvedValueOnce({
      status: 400,
      data: {
        reason: 'Invented: the reason is refused.',
        transaction_date: 'Invented: the date is in the future.',
        lines: 'Invented: the lines are refused.',
        tax_breakdown: 'Invented: the breakdown is refused.',
        kinds: 'Invented: the kinds are refused.',
        decision: 'Invented: the decision is refused.',
        idempotency_key: 'Invented: the key is refused.',
      },
    });
    renderForm();
    await chooseA();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    expect(await screen.findByText('Invented: the reason is refused.')).toBeInTheDocument();
    const at = (id: string) => document.getElementById(id);
    expect(at('tax-decision-reason-error')).toHaveTextContent('Invented: the reason is refused.');
    expect(reason()).toHaveAccessibleDescription('Invented: the reason is refused.');
    expect(at('tax-decision-date-error')).toHaveTextContent('Invented: the date is in the future.');
    expect(screen.getByLabelText('Transaction date (optional)')).toHaveAccessibleDescription(
      'Invented: the date is in the future.',
    );
    expect(at('tax-decision-lines-error')).toHaveTextContent('Invented: the lines are refused.');
    expect(at('tax-decision-taxes-error')).toHaveTextContent('Invented: the breakdown is refused.');
    expect(at('tax-decision-kinds-error')).toHaveTextContent('Invented: the kinds are refused.');
    expect(at('tax-decision-decision-error')).toHaveTextContent(
      'Invented: the decision is refused.',
    );
    // A field with no place on the form is still shown, with its name.
    expect(screen.getByText('idempotency_key')).toBeInTheDocument();
    expect(screen.getByText(/Invented: the key is refused\./)).toBeInTheDocument();
    // Each message once.
    expect(screen.getAllByText('Invented: the kinds are refused.')).toHaveLength(1);
    expect(queryPlan()).not.toBeInTheDocument();
  });

  it('a 400 on confirm drops the preview', async () => {
    post
      .mockResolvedValueOnce(previewed(planB(), 'tok-b'))
      .mockResolvedValueOnce({ status: 400, data: { preview_token: 'Invented: required.' } });
    renderForm();
    chooseB();
    set(reason(), REASON);
    fireEvent.click(previewButton());
    await serverPlan();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(/Invented: required\./)).toBeInTheDocument();
    expect(queryPlan()).not.toBeInTheDocument();
    expect(queryConfirm()).not.toBeInTheDocument();
  });
});
