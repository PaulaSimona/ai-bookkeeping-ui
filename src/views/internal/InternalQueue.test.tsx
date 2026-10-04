// InternalQueue (UI1-C3): the reject-correct request body is unchanged with the
// shared AccountPicker, and opening another queue entry starts its editor
// fresh (the detail pane is keyed by entry, F-S85-4).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { InternalQueue } from './InternalQueue';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const ENTRY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENTRY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const L = (code: string, name: string) => `${code} — ${name}`;

const accountRow = (org: string, tag: string, code: string, name: string, type: string) => ({
  id: `${tag}-${code}`,
  org_id: org,
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

const ACCOUNTS: Record<string, unknown[]> = {
  [`/api/accounting/staff/orgs/${ORG_A}/accounts/`]: [
    accountRow(ORG_A, 'a', '1000', 'Cash', 'asset'),
    accountRow(ORG_A, 'a', '5000', 'Rent Expense', 'expense'),
    accountRow(ORG_A, 'a', '5100', 'Office Supplies', 'expense'),
  ],
  [`/api/accounting/staff/orgs/${ORG_B}/accounts/`]: [
    accountRow(ORG_B, 'b', '1010', 'Chequing', 'asset'),
    accountRow(ORG_B, 'b', '6000', 'Travel', 'expense'),
  ],
};

const line = (
  id: string,
  accountId: string,
  code: string,
  name: string,
  debit: string | null,
  credit: string | null,
  order: number,
) => ({
  id,
  account_id: accountId,
  account_code: code,
  account_name: name,
  debit,
  credit,
  description: '',
  tax_code: '',
  line_order: order,
});

const queueEntry = (id: string, org: string, orgName: string, description: string, lines: unknown[]) => ({
  id,
  entry_number: null,
  entry_date: '2026-09-30',
  description,
  status: 'draft',
  source: 'ai',
  org_id: org,
  org_name: orgName,
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

const QUEUE = [
  queueEntry(ENTRY_A, ORG_A, 'Acme Ltd', 'Acme September rent', [
    line('a1', 'a-5000', '5000', 'Rent Expense', '50.00', null, 0),
    line('a2', 'a-1000', '1000', 'Cash', null, '50.00', 1),
  ]),
  queueEntry(ENTRY_B, ORG_B, 'Birch Inc', 'Birch flight to Calgary', [
    line('b1', 'b-6000', '6000', 'Travel', '75.00', null, 0),
    line('b2', 'b-1010', '1010', 'Chequing', null, '75.00', 1),
  ]),
];

// The body the reject-correct endpoint has always received for this edit.
const EXPECTED_BODY = {
  reason_code: 'wrong_account',
  note: '',
  lines: [
    {
      account_id: 'a-5100',
      debit: '50.00',
      credit: null,
      description: '',
      tax_code: '',
      line_order: 0,
    },
    {
      account_id: 'a-1000',
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

const pickers = () => screen.getAllByRole('combobox', { name: 'Account' });
const accountsLoaded = () =>
  waitFor(() => expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument());

const openEntry = async (user: ReturnType<typeof userEvent.setup>, description: string) => {
  // The title is in the queue row (and, once open, in the pane header too).
  await user.click((await screen.findAllByText(description))[0]);
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((url) => {
    if (url === '/api/accounting/review/') return Promise.resolve(page(QUEUE));
    if (url in ACCOUNTS) return Promise.resolve(page(ACCOUNTS[url]));
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
});

describe('InternalQueue reject & correct', () => {
  it('posts the unchanged request body for an account chosen through the picker', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 200, data: {} });
    render(<InternalQueue />);

    await openEntry(user, 'Acme September rent');
    await user.click(screen.getByRole('button', { name: 'Reject & correct' }));
    await accountsLoaded();

    await user.selectOptions(screen.getByDisplayValue('Select a reason…'), 'wrong_account');
    await user.click(pickers()[0]);
    await user.keyboard('5100{Enter}');
    await user.click(screen.getByRole('button', { name: 'Post correction' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      `/api/accounting/review/${ENTRY_A}/reject-correct/`,
      EXPECTED_BODY,
    );
  });

  it('starts the editor fresh when another queue entry is opened', async () => {
    const user = userEvent.setup();
    render(<InternalQueue />);

    // Entry A: into the editor, with edits in progress.
    await openEntry(user, 'Acme September rent');
    await user.click(screen.getByRole('button', { name: 'Reject & correct' }));
    await accountsLoaded();
    await user.selectOptions(screen.getByDisplayValue('Select a reason…'), 'wrong_amount');
    await user.type(screen.getByPlaceholderText('Context for this correction…'), 'half-typed note');
    await user.click(pickers()[0]);
    await user.keyboard('5100{Enter}');
    expect(pickers()[0]).toHaveValue(L('5100', 'Office Supplies'));

    // Entry B: the pane is back to its plain view — no editor carried over.
    await openEntry(user, 'Birch flight to Calgary');
    expect(screen.queryByText('Corrected lines')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();

    // And its editor opens on B's own lines, reason and note untouched.
    await user.click(screen.getByRole('button', { name: 'Reject & correct' }));
    await accountsLoaded();
    expect(pickers().map((p) => (p as HTMLInputElement).value)).toEqual([
      L('6000', 'Travel'),
      L('1010', 'Chequing'),
    ]);
    expect(screen.getByDisplayValue('Select a reason…')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Context for this correction…')).toHaveValue('');

    // B's picker offers B's accounts only. (Scoped to the picker's list: the
    // reason <select> has options of its own.)
    await user.click(pickers()[0]);
    const list = within(screen.getByRole('listbox'));
    expect(list.getAllByRole('option').map((o) => o.textContent)).toEqual([
      L('1010', 'Chequing'),
      L('6000', 'Travel'),
    ]);
  });
});
