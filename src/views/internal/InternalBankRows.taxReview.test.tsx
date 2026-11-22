// InternalBankRows (S98 P1d item 2, U1): the side pane of a bank row with open
// tax conditions links to that row's tax-review file. Only the server's
// tax_condition_kinds decides: an empty list, or a read that does not carry
// the field, shows no link.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type BankRow } from '@/hooks/useStaffBankRows';
import { InternalBankRows } from './InternalBankRows';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ROWS_URL = '/api/accounting/review/bank/';
const ORGS_URL = '/api/accounting/orgs/';

// Invented fixtures only (the repo is public).
const ORG = '11111111-1111-4111-8111-111111111111';
const HELD_ID = 'a1a1a1a1-0000-4000-8000-000000000001';
const CLEAR_ID = 'a1a1a1a1-0000-4000-8000-000000000002';
const OLD_ID = 'a1a1a1a1-0000-4000-8000-000000000003';

const bankRow = (over: Partial<BankRow> = {}): BankRow => ({
  id: HELD_ID,
  org_id: ORG,
  org_name: 'Maple Test Co',
  bank_account_id: 'f0000000-0000-4000-8000-000000000001',
  bank_account_name: 'Operating chequing',
  feed_mask: '4321',
  feed_account_code: '1010',
  date: '2026-11-03',
  direction: 'money_out',
  amount: '113.00',
  currency: 'CAD',
  counterparty_name: 'Invented Hardware',
  description: 'HELD FOR TAX',
  source: 'plaid',
  suggested_match: null,
  settled_match: null,
  row_kind: 'unmatched',
  pending: false,
  excluded: false,
  excluded_reason: '',
  ticket_status: 'needs_review',
  ticket_status_label: 'Needs Review',
  routing_reason: null,
  routing_reason_label: null,
  resolution_note: null,
  duplicate_sibling: null,
  reported_amount: null,
  reported_direction: null,
  reported_date: null,
  reported_at: null,
  routed_from_status: null,
  routed_from_reason: null,
  ...over,
});

const HELD = bankRow({ tax_condition_kinds: ['tax_unverified'] });
const CLEAR = bankRow({ id: CLEAR_ID, description: 'NOTHING TO DECIDE', tax_condition_kinds: [] });
// A row as a read before P1d sent it: no tax fields at all.
const OLD = bankRow({ id: OLD_ID, description: 'READ BEFORE P1D' });

const Landed = () => {
  const { rowId } = useParams();
  return <p>{`tax-review file of ${rowId}`}</p>;
};

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/internal/bank-rows']}>
      <Routes>
        <Route path="/internal/bank-rows" element={<InternalBankRows />} />
        <Route path="/internal/tax-review/:rowId" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );

const openRow = async (user: ReturnType<typeof userEvent.setup>, description: string) => {
  await user.click((await screen.findByText(description)).closest('tr') as HTMLElement);
  return screen.getByRole('region', { name: 'Bank row detail' });
};

const LINK = 'Open the tax-review file →';

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((url) => {
    if (url === ORGS_URL)
      return Promise.resolve({ status: 200, data: [{ id: ORG, name: 'Maple Test Co' }] });
    if (url === ROWS_URL)
      return Promise.resolve({
        status: 200,
        data: { count: 3, next: null, previous: null, results: [HELD, CLEAR, OLD] },
      });
    return Promise.resolve({ status: 404, data: {} });
  });
});

describe('bank row side pane: the tax-review link', () => {
  it('links a row with open tax conditions to its tax-review file', async () => {
    const user = userEvent.setup();
    renderScreen();
    const pane = await openRow(user, 'HELD FOR TAX');
    expect(within(pane).getByRole('link', { name: LINK })).toHaveAttribute(
      'href',
      `/internal/tax-review/${HELD_ID}`,
    );

    await user.click(within(pane).getByRole('link', { name: LINK }));
    expect(await screen.findByText(`tax-review file of ${HELD_ID}`)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows no link when the list is empty or the read does not carry it', async () => {
    const user = userEvent.setup();
    renderScreen();
    for (const description of ['NOTHING TO DECIDE', 'READ BEFORE P1D']) {
      const pane = await openRow(user, description);
      expect(within(pane).queryByRole('link', { name: LINK })).not.toBeInTheDocument();
    }
  });
});
