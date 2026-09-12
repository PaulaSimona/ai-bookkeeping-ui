// entryDisplayStatus (F-S71-2, O-S71-3, O-S73-2) — the ONE place a journal
// entry's status column is turned into the status a person should see.
//
// Why a derivation: the ledger engine never mutates a reversed original — it
// stays status='posted' and reversed_by_entry is the only marker (backend
// O-S71-2). Reading row.status alone therefore renders "Posted" for an entry
// that has been offset, and the "Reversed" branches every renderer already
// carries never fire. This helper closes that gap without any backend status
// mutation, using the linkage the API ships on every lane (O-S73-1).
//
// Precedence (O-S71-3):
//   1. needs_review          → 'needs_review'   (the queue badge always wins)
//   2. reversed_by_entry_id  → 'reversed'       (posted-but-offset original)
//   3. otherwise             → row.status as sent (draft / posted / replaced /
//                              voided / anything future — passed through)
//
// Structurally typed on purpose: LedgerEntryRow, AccountantLedgerRow (no
// needs_review) and ReviewEntry (no link fields) all satisfy it unchanged.
// Pure; no I/O; the backend stays authoritative for the underlying column.

export type EntryDisplayStatus =
  | 'needs_review'
  | 'reversed'
  | 'draft'
  | 'posted'
  | 'replaced'
  | 'voided'
  | (string & NonNullable<unknown>); // future/unknown column values pass through untouched

export interface EntryStatusSource {
  status: string;
  needs_review?: boolean;
  reversed_by_entry_id?: string | null;
}

export const entryDisplayStatus = (row: EntryStatusSource): EntryDisplayStatus => {
  if (row.needs_review) return 'needs_review';
  if (row.reversed_by_entry_id != null) return 'reversed';
  return row.status;
};

// "JE-0071" for 71 — mirrors the backend's _format_entry_number (ledger_serializers.py)
// for the rare caller that has only the integer. Prefer the API's *_number_display
// strings whenever they are present.
export const formatEntryNumber = (entryNumber: number | null | undefined): string | null =>
  entryNumber == null ? null : `JE-${String(entryNumber).padStart(4, '0')}`;
