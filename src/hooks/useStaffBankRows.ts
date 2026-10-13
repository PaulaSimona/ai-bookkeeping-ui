import { usePaginatedList } from '@/hooks/usePaginatedList';
import { type PlanOutcome, postForPlan } from '@/hooks/staffPlan';

/**
 * Staff bank rows (S87 B2b; backend Release B2a, 125b419):
 *   GET  /api/accounting/review/bank/                        (paginated)
 *   POST /api/accounting/staff/bank-rows/<id>/merge/         {surviving_row_id, confirm}
 *   POST /api/accounting/staff/bank-rows/<id>/release-flag/  {confirm}
 * The list returns the rows of every org the viewer may see. The two POSTs
 * are dry runs unless confirm is true: both answer {executed, plan}, and the
 * plan of a dry run is what the confirm run then carries out (PlanOutcome).
 * Amounts are the server's strings and stay strings — display only.
 */

// Mirrors accounting/bank_review_serializers.py BankMatchSummarySerializer.
export interface BankRowMatchSummary {
  id: string;
  state: string; // suggested | auto_matched | confirmed | manually_matched | …
  similarity: string | null;
  date_delta_days: number | null;
  rationale: string;
  created_at: string;
  journal_line_id: string;
  entry_id: string | null;
  entry_date: string | null;
  entry_description: string | null;
  // The server sends these two as JSON numbers, not strings (a raw Decimal out
  // of a SerializerMethodField) — so they are not money to render as sent.
  line_debit: number | null;
  line_credit: number | null;
  account_code: string | null;
}

// The row a flagged or merged row is a (possible) copy of — always a row of
// the same org (BankRowSerializer.get_duplicate_sibling).
export interface BankRowSibling {
  id: string;
  relation: 'flagged_against' | 'merged_into';
  date: string;
  direction: string;
  amount: string;
  currency: string;
  counterparty_name: string;
  description: string;
  pending: boolean;
  excluded: boolean;
}

// Mirrors accounting/bank_review_serializers.py BankRowSerializer.
export interface BankRow {
  id: string;
  org_id: string | null;
  org_name: string | null;
  bank_account_id: string;
  bank_account_name: string | null;
  feed_mask: string | null; // the feed's last four digits, never more
  feed_account_code: string | null;
  date: string;
  direction: string; // money_in | money_out
  amount: string;
  currency: string;
  counterparty_name: string;
  description: string;
  source: string; // manual | csv | plaid
  suggested_match: BankRowMatchSummary | null;
  // The match that settled the row. A settled row is listed only while its
  // ticket waits for its document (F-S88-6), or closed as "no document
  // needed" when that status is asked for (O-S88-11).
  settled_match: BankRowMatchSummary | null;
  row_kind: 'suggested' | 'matched' | 'unmatched';
  pending: boolean;
  excluded: boolean;
  excluded_reason: string;
  ticket_status: string | null;
  ticket_status_label: string | null; // the server's words for the status
  routing_reason: string | null;
  routing_reason_label: string | null; // the server's words for the reason
  resolution_note: string | null; // the staff note of a closed ticket
  duplicate_sibling: BankRowSibling | null;
}

// The routing reason of a row intake flagged as a possible copy
// (accounting/bank_intake_service.py REASON_POSSIBLE_DUPLICATE).
export const POSSIBLE_DUPLICATE_REASON = 'possible_duplicate_bank_row';

// The ticket statuses the list filters on — mirrors the server's own set
// (accounting/models.py BankTransactionAccountingState.Status, in its
// order); any other value is a 400 there.
export const BANK_ROW_TICKET_STATUSES = [
  'pending',
  'processing',
  'needs_review',
  'failed',
  'waiting_document',
  'documented',
  'closed',
  'no_document_needed',
] as const;

// What the status filter calls each of them — the model's own labels, kept
// here because no endpoint lists them (Release C2, conflict 3). For the
// filter's options ONLY: a row always shows the label the server sent with it.
export const BANK_ROW_TICKET_STATUS_LABELS: Record<
  (typeof BANK_ROW_TICKET_STATUSES)[number],
  string
> = {
  pending: 'Pending',
  processing: 'Processing',
  needs_review: 'Needs Review',
  failed: 'Failed',
  waiting_document: 'Waiting for Document',
  documented: 'Documented',
  closed: 'Closed',
  no_document_needed: 'No document needed',
};

// A status or a routing reason as the screen shows it (N-S88-3): the server's
// label. With no label, the code exactly as it was sent — never reworded
// here; with neither, a dash.
export const labelOrCode = (
  label: string | null | undefined,
  code: string | null | undefined,
): string => label || code || '—';

export interface BankRowFilters {
  ticketStatus?: string;
  possibleDuplicate?: boolean;
  bankAccountId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// The list's query string: a filter that is not set is left out entirely,
// never sent empty.
export const bankRowParams = (filters: BankRowFilters): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.ticketStatus) params.ticket_status = filters.ticketStatus;
  if (filters.possibleDuplicate) params.possible_duplicate = '1';
  if (filters.bankAccountId) params.bank_account_id = filters.bankAccountId;
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  return params;
};

export const BANK_ROWS_URL = '/api/accounting/review/bank/';

export const useStaffBankRows = (filters: BankRowFilters) =>
  usePaginatedList<BankRow>(BANK_ROWS_URL, bankRowParams(filters));

// ─── Merge / release flag ──────────────────────────────────────────────────────

// A ticket as the plans show it: where it stands.
export interface BankTicketImage {
  status: string;
  routing_reason: string | null;
}

// Mirrors accounting/bank_duplicate_service.py MergePlan._image — ids,
// statuses and entry numbers only.
export interface BankMergePlan {
  stale_row_id: string;
  surviving_row_id: string;
  moves_match: {
    match_id: string;
    state: string;
    journal_line_id: string;
    entry_id: string;
    entry_number: number | null;
  } | null;
  moves_entry: { entry_id: string; entry_number: number | null } | null;
  stale_ticket: { before: BankTicketImage; after: BankTicketImage } | null;
  surviving_ticket: { before: BankTicketImage | null; after: BankTicketImage | null };
  excluded_reason: string;
}

// Mirrors accounting/bank_duplicate_service.py ReleasePlan._image.
export interface BankReleasePlan {
  row_id: string;
  sibling_id: string | null;
  ticket: { before: BankTicketImage; after: BankTicketImage };
  matched: {
    match_id: string;
    state: string;
    entry_id: string;
    entry_number: number | null;
  } | null;
}

// Merge the STALE row (the path) into the row that stays (the body): the
// stale row is marked duplicate and its match or entry moves onto the other.
// Refusals are 409 {code, detail} — same_row, different_bank_account,
// surviving_pending, surviving_has_active_match, surviving_has_entry, …
export const mergeBankRow = (
  staleRowId: string,
  survivingRowId: string,
  confirm: boolean,
): Promise<PlanOutcome<BankMergePlan>> =>
  postForPlan<BankMergePlan>(
    `/api/accounting/staff/bank-rows/${staleRowId}/merge/`,
    { surviving_row_id: survivingRowId, confirm },
    'Merge failed.',
  );

// Release a possible-duplicate flag: the row goes back to its normal lane.
// 409 not_flagged / row_excluded / row_has_entry / matched_entry_not_live.
export const releaseBankRowFlag = (
  rowId: string,
  confirm: boolean,
): Promise<PlanOutcome<BankReleasePlan>> =>
  postForPlan<BankReleasePlan>(
    `/api/accounting/staff/bank-rows/${rowId}/release-flag/`,
    { confirm },
    'Could not release the flag.',
  );
