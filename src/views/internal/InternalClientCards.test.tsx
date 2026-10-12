// InternalClientCards with the shared AccountPicker (UI1-C4, site #4): the
// picker offers exactly what the card-mapping rule allows, and the PATCH still
// carries the chosen account's id as mapped_account.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { InternalClientCards } from './InternalClientCards';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const CARD_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CARDS_URL = `/api/accounting/staff/orgs/${ORG}/cards/`;
const ACCOUNTS_URL = `/api/accounting/staff/orgs/${ORG}/accounts/`;

const L = (code: string, name: string) => `${code} — ${name}`;

const accountRow = (code: string, name: string, type: string, isActive = true) => ({
  id: `acc-${code}`,
  org_id: ORG,
  code,
  name,
  type,
  normal_balance: 'credit',
  is_active: isActive,
  parent_account_id: null,
  parent_account_code: null,
  full_name: L(code, name),
  has_posted_lines: false,
  children: [],
});

// Every way an account can be ruled out, next to the ones that are allowed.
const ACCOUNTS = [
  accountRow('1000', 'Cash', 'asset'), // wrong type
  accountRow('2100', 'Accounts Payable', 'liability'), // allowed
  accountRow('2110', 'Visa Card Payable', 'liability'), // allowed
  accountRow('2140', 'Card Settlement Clearing', 'liability'), // excluded code
  accountRow('2200', 'GST/HST Payable', 'liability'), // excluded 22xx range
  accountRow('2250', 'Payroll Remittances', 'liability'), // excluded 22xx range
  accountRow('2300', 'Old Card Payable', 'liability', false), // inactive
  accountRow('3100', 'Owner Loan', 'equity'), // allowed for a personal card only
  accountRow('4000', 'Sales Revenue', 'revenue'), // wrong type
  accountRow('5000', 'Rent Expense', 'expense'), // wrong type
];

const CARD = {
  id: CARD_ID,
  last4: '3277',
  network: 'mastercard',
  label: 'Capital One M/C',
  classification: 'unidentified',
  mapped_account: null,
  mapped_account_code: null,
  mapped_account_name: null,
  source: 'detected',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/internal/clients/${ORG}/cards`]}>
      <Routes>
        <Route path="/internal/clients/:orgId/cards" element={<InternalClientCards />} />
      </Routes>
    </MemoryRouter>,
  );

const picker = () => screen.getByRole('combobox', { name: 'Account' });
const offered = () =>
  within(screen.getByRole('listbox'))
    .getAllByRole('option')
    .map((o) => o.textContent);

const openClassify = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Classify' }));
};

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  get.mockImplementation((url) => {
    if (url === CARDS_URL) return Promise.resolve(page([CARD]));
    if (url === ACCOUNTS_URL) return Promise.resolve(page(ACCOUNTS));
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
});

describe('InternalClientCards account picker', () => {
  it('offers a business card only active liability accounts outside 2140 and 22xx', async () => {
    const user = userEvent.setup();
    renderPage();
    await openClassify(user);
    await user.click(screen.getByRole('button', { name: 'business' }));

    await user.click(picker());
    expect(offered()).toEqual([
      L('2100', 'Accounts Payable'),
      L('2110', 'Visa Card Payable'),
    ]);
  });

  it('adds equity accounts for a personal card, and nothing else', async () => {
    const user = userEvent.setup();
    renderPage();
    await openClassify(user);
    await user.click(screen.getByRole('button', { name: 'personal' }));

    await user.click(picker());
    expect(offered()).toEqual([
      L('2100', 'Accounts Payable'),
      L('2110', 'Visa Card Payable'),
      L('3100', 'Owner Loan'),
    ]);
  });

  it('cannot reach an excluded account by typing its code', async () => {
    const user = userEvent.setup();
    renderPage();
    await openClassify(user);
    await user.click(screen.getByRole('button', { name: 'business' }));

    await user.click(picker());
    await user.keyboard('2140{Enter}');
    expect(screen.getByText('No matching accounts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the chosen account id as mapped_account', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ status: 200, data: { ...CARD, classification: 'business' } });
    renderPage();
    await openClassify(user);
    await user.click(screen.getByRole('button', { name: 'business' }));

    expect(picker()).toHaveAttribute('placeholder', 'Select an account…');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.click(picker());
    await user.keyboard('2110{Enter}');
    expect(picker()).toHaveValue(L('2110', 'Visa Card Payable'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith(`/api/accounting/staff/cards/${CARD_ID}/`, {
      classification: 'business',
      mapped_account: 'acc-2110',
    });
  });

  it('clears the chosen account when the classification changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await openClassify(user);
    await user.click(screen.getByRole('button', { name: 'personal' }));
    await user.click(picker());
    await user.keyboard('3100{Enter}');
    expect(picker()).toHaveValue(L('3100', 'Owner Loan'));

    // 3100 is not valid for a business card.
    await user.click(screen.getByRole('button', { name: 'business' }));
    expect(picker()).toHaveValue('');
  });

  it('reports a failed account load instead of claiming the chart has no suitable account', async () => {
    const user = userEvent.setup();
    get.mockImplementation((url) => {
      if (url === CARDS_URL) return Promise.resolve(page([CARD]));
      return Promise.resolve({ status: 500, data: null });
    });
    renderPage();
    await openClassify(user);
    await user.click(screen.getByRole('button', { name: 'business' }));

    expect(await screen.findByText('Failed to load accounts.')).toBeInTheDocument();
    expect(screen.queryByText(/no suitable/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Account' })).not.toBeInTheDocument();
  });
});

// ─── Change (S87 B2b U5, O-S87-9) ─────────────────────────────────────────────
// "Change" re-points a business card's bank feed. It needs the feed the server
// names for the card (feed_id); without one, the card says why.

const FEED = 'f1f1f1f1-0000-4000-8000-000000000001';
const TARGETS_URL = `/api/accounting/staff/bank-accounts/${FEED}/repoint-targets/`;

const NO_FEED_NOTE = 'No bank feed is linked to this card, so there is nothing to re-point.';
const AMBIGUOUS_NOTE = "More than one feed could be this card's, so it cannot be changed here.";

const cardOf = (over: Record<string, unknown>) => ({ ...CARD, ...over });
const business = (over: Record<string, unknown>) =>
  cardOf({
    classification: 'business',
    mapped_account: 'acc-2110',
    mapped_account_code: '2110',
    mapped_account_name: 'Visa Card Payable',
    ...over,
  });

const LINKED = business({
  id: 'a1a1a1a1-0000-4000-8000-000000000001',
  last4: '3277',
  feed_id: FEED,
  feed_unlinked_reason: null,
});
const UNLINKED = business({
  id: 'a2a2a2a2-0000-4000-8000-000000000002',
  last4: '1111',
  feed_id: null,
  feed_unlinked_reason: 'no_feed',
});
const AMBIGUOUS = business({
  id: 'a3a3a3a3-0000-4000-8000-000000000003',
  last4: '2222',
  feed_id: null,
  feed_unlinked_reason: 'ambiguous',
});
// The server names a feed for any card it can; only a business card gets Change.
const PERSONAL = cardOf({
  id: 'a4a4a4a4-0000-4000-8000-000000000004',
  last4: '4444',
  classification: 'personal',
  mapped_account: 'acc-3100',
  mapped_account_code: '3100',
  mapped_account_name: 'Owner Loan',
  feed_id: 'f2f2f2f2-0000-4000-8000-000000000002',
  feed_unlinked_reason: null,
});
const UNIDENTIFIED = cardOf({ last4: '5555', feed_id: null, feed_unlinked_reason: 'no_feed' });

// The part of a card's row that holds its details and its actions.
const cardRow = (last4: string) => {
  let node = screen.getByText(`····${last4}`) as HTMLElement;
  while (node.parentElement && !node.querySelector('button')) node = node.parentElement;
  return node;
};
const actionsOf = (last4: string) =>
  within(cardRow(last4))
    .getAllByRole('button')
    .map((b) => b.textContent);

describe('InternalClientCards Change', () => {
  it('offers Change only on a business card with a feed, says why a business card has none, and leaves the other cards as they were', async () => {
    const user = userEvent.setup();
    get.mockImplementation((url) => {
      if (url === CARDS_URL) {
        return Promise.resolve(page([LINKED, UNLINKED, AMBIGUOUS, PERSONAL, UNIDENTIFIED]));
      }
      if (url === ACCOUNTS_URL) return Promise.resolve(page(ACCOUNTS));
      if (url === TARGETS_URL) {
        return Promise.resolve({
          status: 200,
          data: {
            feed_id: FEED,
            current_account: { code: '2110', name: 'Visa Card Payable' },
            targets: [{ code: '2150', name: 'Mastercard 3277' }],
            new_account_available: false,
          },
        });
      }
      return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
    });
    renderPage();

    // One Change on the page: the business card whose feed the server named.
    expect(await screen.findAllByRole('button', { name: 'Change' })).toHaveLength(1);
    expect(actionsOf('3277')).toEqual(['Change', 'Retire']);

    // A business card with no feed, or more than one candidate, says why.
    expect(actionsOf('1111')).toEqual(['Retire']);
    expect(within(cardRow('1111')).getByText(NO_FEED_NOTE)).toBeInTheDocument();
    expect(actionsOf('2222')).toEqual(['Retire']);
    expect(within(cardRow('2222')).getByText(AMBIGUOUS_NOTE)).toBeInTheDocument();

    // Personal and unidentified cards: their own actions, and no note.
    expect(actionsOf('4444')).toEqual(['Retire']);
    expect(actionsOf('5555')).toEqual(['Classify', 'Re-send notification', 'Retire']);
    expect(screen.getAllByText(NO_FEED_NOTE)).toHaveLength(1);
    expect(screen.getAllByText(AMBIGUOUS_NOTE)).toHaveLength(1);

    // Change opens the dialog on that card's feed, filled from its targets —
    // not from the chart the page loaded for classifying.
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(
      await screen.findByRole('dialog', { name: 'Change account for the card ending 3277' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: '2150 Mastercard 3277' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(TARGETS_URL);
    expect(screen.queryByRole('radio', { name: /2100/ })).not.toBeInTheDocument();
  });

  it('hides Change on a retired business card, whatever its feed', async () => {
    // Retired, though the server still names a feed for it.
    const RETIRED = business({
      id: 'a5a5a5a5-0000-4000-8000-000000000005',
      last4: '7777',
      is_active: false,
      feed_id: 'f3f3f3f3-0000-4000-8000-000000000003',
      feed_unlinked_reason: null,
    });
    get.mockImplementation((url) => {
      if (url === CARDS_URL) return Promise.resolve(page([LINKED, RETIRED]));
      if (url === ACCOUNTS_URL) return Promise.resolve(page(ACCOUNTS));
      return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
    });
    renderPage();

    // The active card keeps its Change; the retired one has none.
    const change = await screen.findAllByRole('button', { name: 'Change' });
    expect(change).toHaveLength(1);
    expect(cardRow('3277')).toContainElement(change[0]);
    expect(screen.getByText('····7777')).toBeInTheDocument();
    expect(screen.getByText('Retired')).toBeInTheDocument();
    // Every button on the page: the retired card contributes none.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Add card',
      'Change',
      'Retire',
    ]);
  });
});
