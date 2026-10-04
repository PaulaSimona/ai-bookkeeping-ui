// entryStatus — the ONE place a ledger entry's registry fields are turned into
// what a person sees and what they may do (S84 CW5 registry, D-S84-4 / D-S84-5,
// D-S85-13).
//
// A posted entry is never edited. What changes is which entry of its chain is
// LIVE — the one the books currently stand on. The backend resolves that for
// every entry it lists or returns (accounting/ledger_chain.py resolve_chains)
// and ships it on every lane as six fields; nothing here re-derives a chain.
//
//   display_status   reversal | corrected | reversed | posted (an unposted
//                    entry, which only a detail read returns, shows its own
//                    status)
//   corrected_by     {id, number} of the entry that corrected it, or null
//   live_entry       {id, number} of the chain's live entry, or null
//   chain_root       {id, number} of the chain's original
//   chain            every member, in entry-number order
//   chain_truncated  true when the chain is deeper than the server walks
//
// needs_review is NOT read here any more: the ledger lists show posted entries
// only, and a review flag on one must never surface as a label (the R6 gap).
// Pure; no I/O.

export interface EntryRef {
  id: string;
  number: string | null; // the display number, e.g. "JE-0068"
}

export type ChainRole = 'original' | 'correction' | 'reversal' | 'restore';

export interface ChainMember {
  id: string;
  number: string | null;
  date: string; // YYYY-MM-DD
  role: ChainRole | (string & NonNullable<unknown>);
  display_status: string;
}

// Optional on purpose: the write endpoints answer with the plain entry shape
// (no chain), and older fixtures carry none. A row without them is never
// treated as live.
export interface RegistryFields {
  display_status?: string;
  corrected_by?: EntryRef | null;
  live_entry?: EntryRef | null;
  chain_root?: EntryRef | null;
  chain?: ChainMember[];
  chain_truncated?: boolean;
}

export type EntryDisplayStatus =
  | 'posted'
  | 'corrected'
  | 'reversed'
  | 'reversal'
  | 'draft'
  | 'replaced'
  | 'voided'
  | (string & NonNullable<unknown>); // future/unknown values pass through untouched

export interface EntryStatusSource extends RegistryFields {
  status: string;
  // Accepted and ignored — see the header. Kept on the type so every row
  // shape still satisfies it.
  needs_review?: boolean;
}

// The status a person should see: the server's display_status, else (a payload
// without registry fields) the entry's own status column.
export const entryDisplayStatus = (row: EntryStatusSource): EntryDisplayStatus =>
  row.display_status ?? row.status;

const STATUS_LABELS: Record<string, string> = {
  posted: 'Posted',
  corrected: 'Corrected',
  reversed: 'Reversed',
  reversal: 'Reversal',
  draft: 'Draft',
  replaced: 'Replaced',
  voided: 'Voided',
};

// "Posted" / "Corrected" / "Reversed" / "Reversal"; any other value humanized.
export const entryStatusLabel = (row: EntryStatusSource): string => {
  const status = entryDisplayStatus(row);
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  const text = status.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
};

// ─── Entry kind ────────────────────────────────────────────────────────────────

export type EntryKind = 'live' | 'corrected' | 'reversed' | 'reversal' | 'other';

export interface EntryKindSource extends RegistryFields {
  id: string;
}

// What an entry IS within its chain.
//   live       posted, and the chain's live entry is this very entry
//   corrected  a later posted entry corrected it
//   reversed   reversed and not restored
//   reversal   a reversal entry
//   other      anything else: unposted, no registry fields, or posted but not
//              the live entry (a chain cut short by the server's depth cap)
export const entryKind = (row: EntryKindSource): EntryKind => {
  switch (row.display_status) {
    case 'reversal':
      return 'reversal';
    case 'corrected':
      return 'corrected';
    case 'reversed':
      return 'reversed';
    case 'posted':
      return row.live_entry != null && row.live_entry.id === row.id ? 'live' : 'other';
    default:
      return 'other';
  }
};

export const isLiveEntry = (row: EntryKindSource): boolean => entryKind(row) === 'live';

// ─── Allowed actions (D-S85-13) ────────────────────────────────────────────────
// Every write, in every lane, is offered on the LIVE entry only. A non-live
// entry shows its status and a link to the live entry instead. Conditions that
// are about something other than the chain (the owner's entry already has a
// counterparty; only its author may void an adjustment) stay with the screen.

export type Lane = 'owner' | 'staff' | 'accountant';

export type EntryAction =
  | 'assign_counterparty'
  | 'correct'
  | 'change_counterparty'
  | 'reverse'
  | 'merge'
  | 'attach_document'
  | 'adjust'
  | 'void';

const LANE_ACTIONS: Record<Lane, EntryAction[]> = {
  owner: ['assign_counterparty'],
  staff: ['correct', 'change_counterparty', 'reverse', 'merge', 'attach_document'],
  accountant: ['adjust', 'void'],
};

export const allowedActions = (lane: Lane, row: EntryKindSource): EntryAction[] =>
  isLiveEntry(row) ? [...LANE_ACTIONS[lane]] : [];

export const canAct = (lane: Lane, row: EntryKindSource, action: EntryAction): boolean =>
  allowedActions(lane, row).includes(action);

// ─── Link labels ───────────────────────────────────────────────────────────────

export interface EntryLinkSource extends EntryKindSource {
  reverses_entry_number_display?: string | null;
  reversed_by_entry_number_display?: string | null;
}

// "Corrected by JE-0102" / "Reversed by JE-0103" / "Reversal of JE-0068"; null
// for a live entry and for anything that is not part of such a link.
export const entryLinkLabel = (row: EntryLinkSource): string | null => {
  switch (entryKind(row)) {
    case 'corrected':
      return `Corrected by ${row.corrected_by?.number ?? 'a later entry'}`;
    case 'reversed':
      return `Reversed by ${row.reversed_by_entry_number_display ?? 'a reversal entry'}`;
    case 'reversal':
      return `Reversal of ${row.reverses_entry_number_display ?? 'an earlier entry'}`;
    default:
      return null;
  }
};

// The live entry to link to from a non-live one; null when the entry IS the
// live entry or the chain has none (reversed and not restored).
export const liveEntryLink = (row: EntryKindSource): EntryRef | null =>
  row.live_entry != null && row.live_entry.id !== row.id ? row.live_entry : null;

// "JE-0071" for 71 — mirrors the backend's _format_entry_number (ledger_serializers.py)
// for the rare caller that has only the integer. Prefer the API's *_number_display
// strings whenever they are present.
export const formatEntryNumber = (entryNumber: number | null | undefined): string | null =>
  entryNumber == null ? null : `JE-${String(entryNumber).padStart(4, '0')}`;
