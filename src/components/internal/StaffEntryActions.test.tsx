// StaffEntryActions (UI2-U4, D-S84-5 / D-S85-12 / D-S85-13): Correct and Change
// counterparty are two editors behind their own buttons, on the live entry
// only; the counterparty editor has one Save and confirms on set, replace and
// clear.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { StaffEntryActions, type StaffEntryActionsEntry } from './StaffEntryActions';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const ENTRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COUNTERPARTIES_URL = `/api/accounting/staff/orgs/${ORG}/counterparties/`;
const ATTRIBUTE_URL = `/api/accounting/staff/entries/${ENTRY_ID}/attribute/`;

const BIRCH = { id: 'cp-1', name: 'Birch Inc', is_client: false, is_supplier: true, archived: false };
const CEDAR = { id: 'cp-2', name: 'Cedar Ltd', is_client: true, is_supplier: false, archived: false };

// The bodies POST staff/entries/<id>/attribute/ takes (backend: {counterparty:
// uuid | null, reason?}).
const EXPECTED = {
  set: { counterparty: 'cp-1' },
  replace: { counterparty: 'cp-2', reason: 'Wrong supplier picked' },
  clear: { counterparty: null },
};

const liveEntry = (over: Partial<StaffEntryActionsEntry> = {}): StaffEntryActionsEntry => ({
  id: ENTRY_ID,
  entry_number: 68,
  entry_number_display: 'JE-0068',
  counterparty: null,
  display_status: 'posted',
  corrected_by: null,
  live_entry: { id: ENTRY_ID, number: 'JE-0068' },
  ...over,
});

const renderPanel = (entry: StaffEntryActionsEntry) => {
  const handlers = { onChanged: vi.fn(), onOpenEntry: vi.fn() };
  render(<StaffEntryActions orgId={ORG} entry={entry} {...handlers} />);
  return handlers;
};

// The picker is the editor's only select; its options load from the org.
const picker = () => screen.getByRole('combobox');
const openCounterpartyEditor = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Change counterparty' }));
  await within(picker()).findByRole('option', { name: 'Birch Inc (supplier)' });
};
const popup = (title: string) => screen.getByText(title).closest('div')!.parentElement!;

// The entry as the staff detail endpoint returns it (the correction editor
// re-reads it on open).
const DETAIL = {
  id: ENTRY_ID,
  entry_number: 68,
  entry_number_display: 'JE-0068',
  entry_date: '2026-09-30',
  description: 'September rent',
  source: 'ai',
  status: 'posted',
  created_by: 'agent',
  counterparty: null,
  total_debits: '100.00',
  total_credits: '100.00',
  corrects_entry_id: null,
  lines: [],
  display_status: 'posted',
  corrected_by: null,
  live_entry: { id: ENTRY_ID, number: 'JE-0068' },
  chain_root: { id: ENTRY_ID, number: 'JE-0068' },
  chain: [{ id: ENTRY_ID, number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'posted' }],
  chain_truncated: false,
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation(async (url) => {
    if (url === COUNTERPARTIES_URL) {
      return { status: 200, data: { count: 2, next: null, previous: null, results: [BIRCH, CEDAR] } };
    }
    if (url === `/api/accounting/staff/entries/${ENTRY_ID}/`) return { status: 200, data: DETAIL };
    return { status: 200, data: { count: 0, next: null, previous: null, results: [] } };
  });
  post.mockResolvedValue({ status: 200, data: { entry: {}, changed: true } });
});

describe('StaffEntryActions — two editors behind their own buttons', () => {
  it('offers Correct and Change counterparty on the live entry, and no Save until one is opened', () => {
    renderPanel(liveEntry());

    expect(screen.getByRole('button', { name: 'Correct' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change counterparty' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    // What Correct does: one correcting entry, not a replacement.
    expect(
      screen.getByText('Posts one new entry that corrects JE-0068. Audited; cannot be undone.'),
    ).toBeInTheDocument();
  });

  it('offers neither on an entry that is not the live one, and says why', () => {
    renderPanel(
      liveEntry({
        display_status: 'corrected',
        corrected_by: { id: 'e-102', number: 'JE-0102' },
        live_entry: { id: 'e-102', number: 'JE-0102' },
      }),
    );

    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change counterparty' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Corrected by JE-0102. Changes are made on the live entry, JE-0102.'),
    ).toBeInTheDocument();
  });

  it('opens the correction editor from Correct', async () => {
    const user = userEvent.setup();
    renderPanel(liveEntry());

    await user.click(screen.getByRole('button', { name: 'Correct' }));
    expect(await screen.findByText('Correct JE-0068')).toBeInTheDocument();
    // One editor at a time: the panel's buttons are gone while it is open.
    expect(screen.queryByRole('button', { name: 'Change counterparty' })).not.toBeInTheDocument();
  });
});

describe('StaffEntryActions — Change counterparty confirms every change (D-S85-12)', () => {
  it('set: confirms, then posts the counterparty', async () => {
    const user = userEvent.setup();
    const { onChanged } = renderPanel(liveEntry());
    await openCounterpartyEditor(user);

    // Nothing to save until something changes.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.selectOptions(picker(), 'cp-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The pop-up names the change; nothing has been written.
    expect(screen.getByText('Set counterparty?')).toBeInTheDocument();
    expect(screen.getByText(/Sets the counterparty of JE-0068 to Birch Inc\./)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(ATTRIBUTE_URL, EXPECTED.set);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    // The editor closes back to the panel.
    expect(await screen.findByRole('button', { name: 'Change counterparty' })).toBeInTheDocument();
  });

  it('replace: confirms naming both counterparties, then posts the new one with the reason', async () => {
    const user = userEvent.setup();
    renderPanel(liveEntry({ counterparty: { id: 'cp-1', name: 'Birch Inc' } }));
    await openCounterpartyEditor(user);

    await user.selectOptions(picker(), 'cp-2');
    await user.type(screen.getByPlaceholderText('Reason (optional)'), 'Wrong supplier picked');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Replace counterparty?')).toBeInTheDocument();
    expect(
      screen.getByText(/Replaces the counterparty of JE-0068: Birch Inc → Cedar Ltd\./),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(ATTRIBUTE_URL, EXPECTED.replace);
  });

  it('clear: confirms naming the counterparty removed, then posts null', async () => {
    const user = userEvent.setup();
    renderPanel(liveEntry({ counterparty: { id: 'cp-1', name: 'Birch Inc' } }));
    await openCounterpartyEditor(user);

    await user.selectOptions(picker(), '');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Remove counterparty?')).toBeInTheDocument();
    expect(screen.getByText(/Removes Birch Inc from JE-0068\./)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(ATTRIBUTE_URL, EXPECTED.clear);
  });

  it('writes nothing when the pop-up is cancelled', async () => {
    const user = userEvent.setup();
    const { onChanged } = renderPanel(liveEntry());
    await openCounterpartyEditor(user);

    await user.selectOptions(picker(), 'cp-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(within(popup('Set counterparty?')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Set counterparty?')).not.toBeInTheDocument();
    // Control: the editor is still open with the choice in place.
    expect(picker()).toHaveValue('cp-1');
    expect(post).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('StaffEntryActions — refusals', () => {
  it('shows the server\'s message for a 409 not_editable and keeps the editor open', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 409,
      data: { detail: 'A replaced draft cannot be edited.', code: 'not_editable' },
    });
    const { onChanged } = renderPanel(liveEntry());
    await openCounterpartyEditor(user);

    await user.selectOptions(picker(), 'cp-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('A replaced draft cannot be edited.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('shows the "Not found" state for a 404', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    renderPanel(liveEntry());
    await openCounterpartyEditor(user);

    await user.selectOptions(picker(), 'cp-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Not found')).toBeInTheDocument();
    expect(
      screen.getByText('This entry is not on a client assigned to you, or it no longer exists.'),
    ).toBeInTheDocument();
  });
});
