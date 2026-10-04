// StaffEntryActions (UI2-U4, D-S84-5 / D-S85-12 / D-S85-13): Correct and Change
// counterparty are two editors behind their own buttons, on the live entry
// only; the counterparty editor has one Save and confirms on set, replace and
// clear.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { MergeEditor, StaffEntryActions, type StaffEntryActionsEntry } from './StaffEntryActions';

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

// ─── Remediation (UI2-U5, D-S84-7 / D-S85-14) ─────────────────────────────────

const SURVIVOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_ENTRY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const REVERSE_URL = `/api/accounting/staff/entries/${ENTRY_ID}/reverse/`;
const ATTACH_URL = `/api/accounting/staff/entries/${ENTRY_ID}/attach-document/`;
const MERGE_URL = `/api/accounting/staff/entries/${ENTRY_ID}/merge-into/`;

// The bodies the remediation endpoints take (backend remediation_serializers.py).
const REMEDIATION_BODY = {
  reverse: { reason: 'Entered by mistake' },
  attach: { document_id: 41, reason: 'Receipt arrived later' },
  merge: { survivor_entry_id: SURVIVOR_ID, reason: 'Entered twice' },
};

const HAS_LINKS = {
  status: 409,
  data: {
    code: 'entry_has_links',
    detail:
      'This entry is linked to a bank transaction or a document. Merge it into the entry that ' +
      'should keep those links, or correct it, instead of reversing it.',
    field: 'entry',
    links: ['bank_state', 'active_match', 'document_state'],
  },
};

const reasonField = () => screen.getByRole('textbox', { name: 'Reason' });

describe('StaffEntryActions — remediation buttons (D-S85-13)', () => {
  it('offers Reverse and Attach document on the live entry; Merge into… only where the page has a list', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <StaffEntryActions orgId={ORG} entry={liveEntry()} onChanged={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Reverse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach document' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Merge into…' })).not.toBeInTheDocument();
    unmount();

    const onStartMerge = vi.fn();
    render(
      <StaffEntryActions orgId={ORG} entry={liveEntry()} onChanged={vi.fn()} onStartMerge={onStartMerge} />,
    );
    await user.click(screen.getByRole('button', { name: 'Merge into…' }));
    expect(onStartMerge).toHaveBeenCalledTimes(1);
  });

  it('offers none of them on an entry that is not the live one', () => {
    renderPanel(liveEntry({ display_status: 'reversed', live_entry: null }));
    for (const name of ['Reverse', 'Merge into…', 'Attach document']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('StaffEntryActions — Reverse', () => {
  it('needs a reason and a confirm naming the entry, then posts {reason}', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const onChanged = vi.fn();
    post.mockResolvedValue({
      status: 201,
      data: {
        action: 'reverse',
        entry: { id: ENTRY_ID, entry_number: 68 },
        entries_created: [{ id: 'r-1', entry_number: 120, kind: 'reversal' }],
        moved: {},
      },
    });
    render(<StaffEntryActions orgId={ORG} entry={liveEntry()} onChanged={onChanged} notify={notify} />);

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    // The editor's own Reverse waits for a reason.
    expect(screen.getByRole('button', { name: 'Reverse' })).toBeDisabled();
    await user.type(reasonField(), 'Entered by mistake');
    await user.click(screen.getByRole('button', { name: 'Reverse' }));

    expect(screen.getByText('Reverse JE-0068?')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(REVERSE_URL, REMEDIATION_BODY.reverse);
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('JE-0068 reversed. Created JE-0120 (reversal).', 'success'),
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('entry_has_links: shows the server\'s detail, lists the links and points to Merge or Correct', async () => {
    const user = userEvent.setup();
    const onStartMerge = vi.fn();
    post.mockResolvedValue(HAS_LINKS);
    render(
      <StaffEntryActions orgId={ORG} entry={liveEntry()} onChanged={vi.fn()} onStartMerge={onStartMerge} />,
    );

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    await user.type(reasonField(), 'Entered by mistake');
    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(HAS_LINKS.data.detail);
    // The `field` key names the refused entry.
    expect(alert).toHaveTextContent('Refused entry: JE-0068');
    expect(within(alert).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'a bank transaction is recorded against it',
      'a bank match is active on one of its lines',
      'a document is attached to it',
    ]);

    await user.click(within(alert).getByRole('button', { name: 'Merge into…' }));
    expect(onStartMerge).toHaveBeenCalledTimes(1);
    await user.click(within(alert).getByRole('button', { name: 'Correct' }));
    expect(await screen.findByText('Correct JE-0068')).toBeInTheDocument();
  });

  it('429: says the hourly limit was reached', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 429, data: { detail: 'Request was throttled.' } });
    renderPanel(liveEntry());

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    await user.type(reasonField(), 'Entered by mistake');
    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The hourly limit for these actions has been reached. Try again later.',
    );
  });
});

describe('StaffEntryActions — Attach document', () => {
  const openAttach = async (user: ReturnType<typeof userEvent.setup>, id = '41') => {
    await user.click(screen.getByRole('button', { name: 'Attach document' }));
    await user.type(screen.getByRole('textbox', { name: 'Document id' }), id);
    await user.type(reasonField(), 'Receipt arrived later');
  };

  it('takes a typed document id and a reason, confirms, posts {document_id, reason}, and lists what moved', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    post.mockResolvedValue({
      status: 201,
      data: {
        action: 'attach_document',
        entry: { id: ENTRY_ID, entry_number: 68 },
        entries_created: [],
        moved: { documents: [{ document_id: 41, mode: 'full', from_entry_id: null, to_entry_id: ENTRY_ID }] },
      },
    });
    render(<StaffEntryActions orgId={ORG} entry={liveEntry()} onChanged={vi.fn()} notify={notify} />);
    await openAttach(user);

    await user.click(screen.getByRole('button', { name: 'Attach' }));
    expect(screen.getByText('Attaches document 41 to JE-0068. Audited; cannot be undone.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(ATTACH_URL, REMEDIATION_BODY.attach);
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Attached to JE-0068: document 41 (full).', 'success'),
    );
  });

  it('does not offer to send an id that is not a whole number', async () => {
    const user = userEvent.setup();
    renderPanel(liveEntry());
    await openAttach(user, '4x');
    expect(screen.getByRole('button', { name: 'Attach' })).toBeDisabled();
  });

  it.each([
    ['document_has_open_draft', 'This document has a draft entry awaiting review. Resolve that draft first.'],
    ['document_attached_to_live_entry', 'This document is already attached to a live entry. Merge that entry instead.'],
  ])('%s: shows the server\'s detail and links that entry', async (code, detail) => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 409, data: { code, detail, entry_id: OTHER_ENTRY_ID } });
    const { onOpenEntry } = renderPanel(liveEntry());
    await openAttach(user);
    await user.click(screen.getByRole('button', { name: 'Attach' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(detail);
    await user.click(within(alert).getByRole('button', { name: 'Open that entry' }));
    expect(onOpenEntry).toHaveBeenCalledWith({ id: OTHER_ENTRY_ID, number: null });
  });

  it('a document outside the client\'s org is the "Not found" state', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    renderPanel(liveEntry());
    await openAttach(user);
    await user.click(screen.getByRole('button', { name: 'Attach' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Not found')).toBeInTheDocument();
  });
});

describe('MergeEditor', () => {
  const DUPLICATE = { id: ENTRY_ID, number: 'JE-0068', total: '100.00' };
  const SURVIVOR = { id: SURVIVOR_ID, number: 'JE-0090', total: '120.00' };

  const renderMerge = (survivor: typeof SURVIVOR | null = SURVIVOR) => {
    const handlers = { onCancel: vi.fn(), onMerged: vi.fn(), onOpenEntry: vi.fn() };
    render(<MergeEditor duplicate={DUPLICATE} survivor={survivor} {...handlers} />);
    return handlers;
  };

  const submit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(reasonField(), 'Entered twice');
    await user.click(screen.getByRole('button', { name: 'Merge' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
  };

  it('waits for a surviving entry to be picked', () => {
    renderMerge(null);
    expect(screen.getByText('Click the entry that should survive in the list below.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
  });

  it('the confirm names both entries and both totals, then posts {survivor_entry_id, reason}', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 201,
      data: {
        action: 'merge',
        entry: { id: ENTRY_ID, entry_number: 68 },
        survivor: { id: SURVIVOR_ID, entry_number: 90 },
        entries_created: [{ id: 'r-1', entry_number: 121, kind: 'reversal' }],
        moved: { bank_state_ids: [], matches_carried: [], matches_unmatched: [], documents: [] },
      },
    });
    const { onMerged } = renderMerge();

    await user.type(reasonField(), 'Entered twice');
    await user.click(screen.getByRole('button', { name: 'Merge' }));
    expect(screen.getByText('Merge JE-0068 into JE-0090?')).toBeInTheDocument();
    expect(
      screen.getByText(/JE-0068 \(total 100\.00\) is reversed as a duplicate, and its bank links and documents move to JE-0090 \(total 120\.00\)\./),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(MERGE_URL, REMEDIATION_BODY.merge);
    await waitFor(() => expect(onMerged).toHaveBeenCalledTimes(1));
    expect(onMerged.mock.calls[0][0]).toContain('JE-0068 merged into JE-0090.');
  });

  it('amount_mismatch: shows the server\'s detail and both totals', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 400,
      data: {
        code: 'amount_mismatch',
        detail: 'The two entries are not for the same amount, so one is not a duplicate of the other.',
        duplicate_total: '100.00',
        survivor_total: '120.00',
      },
    });
    const { onMerged } = renderMerge();
    await submit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The two entries are not for the same amount');
    expect(alert).toHaveTextContent('Duplicate total 100.00 · surviving entry total 120.00');
    expect(onMerged).not.toHaveBeenCalled();
  });

  it('duplicate_has_itc_adjustment: links the adjustment entry', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 409,
      data: {
        code: 'duplicate_has_itc_adjustment',
        detail: 'The duplicate has a live ITC adjustment. Reverse that adjustment first.',
        adjustment_entry_id: OTHER_ENTRY_ID,
      },
    });
    const { onOpenEntry } = renderMerge();
    await submit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The duplicate has a live ITC adjustment.');
    await user.click(within(alert).getByRole('button', { name: 'Open the adjustment entry' }));
    expect(onOpenEntry).toHaveBeenCalledWith({ id: OTHER_ENTRY_ID, number: null });
  });

  it.each([
    ['entry', 'JE-0068', 'already_reversed', 'This entry has already been reversed.'],
    ['survivor_entry_id', 'JE-0090', 'same_chain', 'An entry cannot be merged into itself or into an entry of its own correction chain.'],
  ])('the field key (%s) names the refused entry: %s', async (field, refused, code, detail) => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 409, data: { code, detail, field } });
    renderMerge();
    await submit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(detail);
    expect(alert).toHaveTextContent(`Refused entry: ${refused}`);
  });
});
