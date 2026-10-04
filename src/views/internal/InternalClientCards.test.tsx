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
