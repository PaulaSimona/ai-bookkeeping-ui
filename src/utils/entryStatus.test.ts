// Entry-kind rules (UI2-U0, D-S84-4 / D-S84-5 / D-S85-13): what an entry is
// within its chain, what each lane may do with it, and the labels it shows.
import { describe, expect, it } from 'vitest';
import {
  REGISTRY_STATUS_OPTIONS,
  allowedActions,
  canAct,
  entryDisplayStatus,
  entryKind,
  entryLinkLabel,
  entryStatusLabel,
  formatEntryNumber,
  isLiveEntry,
  liveEntryLink,
  nonLiveNote,
  type EntryLinkSource,
} from './entryStatus';

const ref = (id: string, number: string) => ({ id, number });

// One chain as the registry serializer sends it: JE-0068 was corrected by
// JE-0102, which is now the live entry.
const ORIGINAL: EntryLinkSource & { status: string } = {
  id: 'e-68',
  status: 'posted',
  display_status: 'corrected',
  corrected_by: ref('e-102', 'JE-0102'),
  live_entry: ref('e-102', 'JE-0102'),
  chain_root: ref('e-68', 'JE-0068'),
  chain_truncated: false,
};
const CORRECTION: EntryLinkSource & { status: string } = {
  id: 'e-102',
  status: 'posted',
  display_status: 'posted',
  corrected_by: null,
  live_entry: ref('e-102', 'JE-0102'),
  chain_root: ref('e-68', 'JE-0068'),
  chain_truncated: false,
};
// A reversed entry and its reversal: the chain has no live entry.
const REVERSED: EntryLinkSource & { status: string } = {
  id: 'e-70',
  status: 'posted',
  display_status: 'reversed',
  corrected_by: null,
  live_entry: null,
  reversed_by_entry_number_display: 'JE-0103',
};
const REVERSAL: EntryLinkSource & { status: string } = {
  id: 'e-103',
  status: 'posted',
  display_status: 'reversal',
  corrected_by: null,
  live_entry: null,
  reverses_entry_number_display: 'JE-0070',
};

describe('entryKind', () => {
  it('is live when the entry is posted and is its own chain\'s live entry', () => {
    expect(entryKind(CORRECTION)).toBe('live');
    expect(isLiveEntry(CORRECTION)).toBe(true);
  });

  it('is corrected, reversed or reversal straight from display_status', () => {
    expect(entryKind(ORIGINAL)).toBe('corrected');
    expect(entryKind(REVERSED)).toBe('reversed');
    expect(entryKind(REVERSAL)).toBe('reversal');
  });

  it('is never live when the live entry is another entry or absent', () => {
    // Posted, but the server names a different live entry (or none: a chain cut
    // short by the depth cap leaves live_entry null).
    expect(entryKind({ id: 'e-1', display_status: 'posted', live_entry: ref('e-2', 'JE-0002') })).toBe('other');
    expect(entryKind({ id: 'e-1', display_status: 'posted', live_entry: null })).toBe('other');
  });

  it('is never live without the registry fields', () => {
    // The plain entry a write endpoint returns carries no chain.
    expect(entryKind({ id: 'e-1' })).toBe('other');
    expect(isLiveEntry({ id: 'e-1' })).toBe(false);
  });

  it('treats an unposted entry as other', () => {
    expect(entryKind({ id: 'e-1', display_status: 'draft', live_entry: null })).toBe('other');
    expect(entryKind({ id: 'e-1', display_status: 'voided', live_entry: null })).toBe('other');
  });
});

describe('allowed actions (D-S85-13)', () => {
  it('offers every lane its writes on the live entry', () => {
    expect(allowedActions('staff', CORRECTION)).toEqual([
      'correct',
      'change_counterparty',
      'reverse',
      'merge',
      'attach_document',
    ]);
    expect(allowedActions('owner', CORRECTION)).toEqual(['assign_counterparty']);
    expect(allowedActions('accountant', CORRECTION)).toEqual(['adjust', 'void']);
  });

  it('offers nothing, in any lane, on a corrected, reversed or reversal entry', () => {
    for (const row of [ORIGINAL, REVERSED, REVERSAL]) {
      for (const lane of ['owner', 'staff', 'accountant'] as const) {
        expect(allowedActions(lane, row)).toEqual([]);
      }
    }
  });

  it('allows Correct on the live entry only', () => {
    expect(canAct('staff', CORRECTION, 'correct')).toBe(true);
    expect(canAct('staff', ORIGINAL, 'correct')).toBe(false);
    expect(canAct('staff', REVERSED, 'correct')).toBe(false);
    expect(canAct('staff', REVERSAL, 'correct')).toBe(false);
    expect(canAct('staff', { id: 'e-1' }, 'correct')).toBe(false);
  });

  it('never offers one lane another lane\'s action', () => {
    expect(canAct('owner', CORRECTION, 'correct')).toBe(false);
    expect(canAct('accountant', CORRECTION, 'reverse')).toBe(false);
    expect(canAct('staff', CORRECTION, 'adjust')).toBe(false);
  });
});

describe('labels', () => {
  it('names the linked entry: Corrected by, Reversed by, Reversal of', () => {
    expect(entryLinkLabel(ORIGINAL)).toBe('Corrected by JE-0102');
    expect(entryLinkLabel(REVERSED)).toBe('Reversed by JE-0103');
    expect(entryLinkLabel(REVERSAL)).toBe('Reversal of JE-0070');
  });

  it('has no link label for the live entry', () => {
    expect(entryLinkLabel(CORRECTION)).toBeNull();
  });

  it('links a non-live entry to its chain\'s live entry', () => {
    expect(liveEntryLink(ORIGINAL)).toEqual(ref('e-102', 'JE-0102'));
    expect(liveEntryLink(CORRECTION)).toBeNull(); // it IS the live entry
    expect(liveEntryLink(REVERSED)).toBeNull(); // the chain has none
  });

  it('says, on a non-live entry, how it is linked and where changes are made', () => {
    expect(nonLiveNote(ORIGINAL)).toBe(
      'Corrected by JE-0102. Changes are made on the live entry, JE-0102.',
    );
    // A reversed chain has no live entry to point at.
    expect(nonLiveNote(REVERSED)).toBe('Reversed by JE-0103.');
    expect(nonLiveNote(REVERSAL)).toBe('Reversal of JE-0070.');
    // The live entry has nothing to say; nor has a payload without registry fields.
    expect(nonLiveNote(CORRECTION)).toBeNull();
    expect(nonLiveNote({ id: 'e-1' })).toBeNull();
  });

  it('shows the display status as the status label', () => {
    expect(entryStatusLabel(CORRECTION)).toBe('Posted');
    expect(entryStatusLabel(ORIGINAL)).toBe('Corrected');
    expect(entryStatusLabel(REVERSED)).toBe('Reversed');
    expect(entryStatusLabel(REVERSAL)).toBe('Reversal');
    expect(entryStatusLabel({ status: 'accountant_hold' })).toBe('Accountant hold');
  });

  it('falls back to the status column when a payload has no display_status', () => {
    expect(entryDisplayStatus({ status: 'draft' })).toBe('draft');
    expect(entryDisplayStatus({ status: 'posted', display_status: 'corrected' })).toBe('corrected');
  });
});

describe('needs_review', () => {
  it('does not change any status or label', () => {
    const flagged = { ...CORRECTION, needs_review: true };
    expect(entryDisplayStatus(flagged)).toBe('posted');
    expect(entryStatusLabel(flagged)).toBe('Posted');
    expect(entryStatusLabel({ ...ORIGINAL, needs_review: true })).toBe('Corrected');
    expect(entryDisplayStatus({ status: 'posted', needs_review: true })).toBe('posted');
    // …and it does not affect what may be done with the entry either.
    expect(entryKind(flagged)).toBe('live');
  });
});

describe('registry filter options (D-S84-4)', () => {
  it('is the one shared list: Posted sends nothing; Draft and Replaced are not offered', () => {
    // The values are the ?status= the list endpoints accept
    // (ledger_chain.registry_entries); anything else is a 400 there.
    expect(REGISTRY_STATUS_OPTIONS).toEqual([
      { value: '', label: 'Posted' },
      { value: 'live', label: 'Live' },
      { value: 'corrected', label: 'Corrected' },
      { value: 'reversed', label: 'Reversed' },
      { value: 'reversals', label: 'Reversal entries' },
      { value: 'all', label: 'All' },
    ]);
  });
});

describe('formatEntryNumber', () => {
  it('formats like the backend', () => {
    expect(formatEntryNumber(68)).toBe('JE-0068');
    expect(formatEntryNumber(null)).toBeNull();
  });
});
