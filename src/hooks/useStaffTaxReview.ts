import { useCallback, useEffect, useState } from 'react';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { type PreviewedOutcome, postForPreviewedPlan } from '@/hooks/staffPlan';
import { type BankRow } from '@/hooks/useStaffBankRows';
import api from '@/utils/api';

/**
 * Staff tax review (S98 P1d; backend P1d + P1d-B2, main 93a77e2 —
 * accounting/tax_review_views.py, accounting/tax_review_service.py):
 *   GET  /api/accounting/review/bank/?tax_review=1            (paginated)
 *   GET  /api/accounting/staff/bank-rows/<id>/tax-review/     (the file)
 *   POST /api/accounting/staff/bank-rows/<id>/tax-review/     (the decision)
 * STAFF ONLY: no customer page may import this module (pinned by
 * staffTaxBoundary.test.ts). Every amount is the server's string and stays a
 * string. The file's receipt URL is short-lived and signed: it is handed to
 * the receipt viewer and kept nowhere else.
 *
 * The POST is a dry run unless confirm is true. A dry run answers
 * {executed: false, plan, preview_token}; the confirm run sends the same body
 * with confirm, that token and an idempotency key, and answers
 * {executed: true, plan}.
 */

const BANK_ROWS_URL = '/api/accounting/review/bank/';
const fileUrl = (rowId: string) => `/api/accounting/staff/bank-rows/${rowId}/tax-review/`;

// A row of the tax-review list: a bank row with its open conditions.
export type TaxReviewRow = BankRow;

// The list's one fixed filter. A module constant, so the reference is stable.
export const TAX_REVIEW_LIST_PARAMS: Record<string, string> = { tax_review: '1' };

export const useStaffTaxReviewList = () =>
  usePaginatedList<TaxReviewRow>(BANK_ROWS_URL, TAX_REVIEW_LIST_PARAMS);

// --- the file ---------------------------------------------------------------

export interface TaxCondition {
  id: string;
  kind: string;
  status: string;
  raised_at: string | null;
  raised_by: string | null;
  evidence: unknown;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: unknown;
}

export interface TaxGuardCheck {
  allowed: boolean;
  hold_reason: string | null;
  evidence: unknown;
}

export interface TaxReviewEntryLine {
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit: string | null;
  credit: string | null;
  project_id: string | null;
  job_cost_category: string | null;
}

export interface TaxReviewEntry {
  id: string;
  role: string; // bank_draft | correction | adjustment | reclassification | reversal
  entry_number: number | null;
  entry_date: string | null;
  source: string;
  status: string;
  description: string;
  is_live: boolean;
  corrects_entry_id: string | null;
  reverses_entry_id: string | null;
  lines: TaxReviewEntryLine[];
}

export interface TreatmentLine {
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  project_id: string | null;
  job_cost_category: string | null;
  amount: string;
}

export interface TaxPeriod {
  label: string;
  start: string;
  end: string;
  frequency: string;
}

export interface TaxReviewDates {
  transaction_date: string | null;
  original_tax_period: TaxPeriod | null;
  adjustment_date: string | null;
  adjustment_tax_period: TaxPeriod | null;
  locked_through_date: string | null;
  adjustment_date_locked: boolean;
}

export interface TaxReviewAudit {
  id: string | number;
  action: string;
  actor: string | null;
  created_at: string;
  entity_type: string;
  before: unknown;
  after: unknown;
}

// The org's ITC accounts as the decision treats them (P1d-B2). An inactive
// one is listed and never offered.
export interface ItcAccount {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface TaxReviewReceipt {
  url: string;
  expires_in: number; // seconds
  content_type: string;
}

export interface TaxReviewFile {
  org_id: string;
  itc_accounts: ItcAccount[];
  bank_row: { id: string; date: string; direction: string; amount: string; description: string };
  ticket: {
    id: string;
    status: string;
    routing_reason: string | null;
    adjustment_entry_id: string | null;
  } | null;
  in_tax_review: boolean;
  open_conditions: TaxCondition[];
  closed_conditions: TaxCondition[];
  document_id: number | null;
  extraction: {
    total_amount: string | null;
    tax_amount: string | null;
    tax_type: string | null;
    document_date: string | null;
    currency: string | null;
  } | null;
  guard: {
    tax_mode: string | null;
    automated: TaxGuardCheck | null;
    unexplained_amount: TaxGuardCheck | null;
  } | null;
  bank_matches: {
    id: string;
    state: string;
    journal_line_id: string | null;
    entry_id: string | null;
    account_code: string | null;
  }[];
  entry_chain: TaxReviewEntry[];
  current_treatment: TreatmentLine[];
  live_adjustment_entry_id: string | null;
  dates: TaxReviewDates;
  audit_history: TaxReviewAudit[];
  receipt: TaxReviewReceipt | null;
}

export type TaxReviewFileState =
  | { kind: 'loading' }
  | { kind: 'ready'; file: TaxReviewFile }
  | { kind: 'gone' }
  | { kind: 'error'; message: string };

const FILE_ERROR = 'Could not load the tax-review file.';

// A file counts only when it carries the parts every section reads.
const isFile = (value: unknown): value is TaxReviewFile => {
  if (value == null || typeof value !== 'object') return false;
  const file = value as Record<string, unknown>;
  return (
    typeof file.org_id === 'string' &&
    file.bank_row != null &&
    typeof file.bank_row === 'object' &&
    typeof file.in_tax_review === 'boolean' &&
    Array.isArray(file.itc_accounts) &&
    Array.isArray(file.open_conditions) &&
    Array.isArray(file.closed_conditions) &&
    Array.isArray(file.entry_chain) &&
    Array.isArray(file.current_treatment) &&
    Array.isArray(file.bank_matches) &&
    Array.isArray(file.audit_history) &&
    file.dates != null &&
    typeof file.dates === 'object'
  );
};

// One row's file. Each read is audited by the server and signs a fresh
// receipt link, so the file is read once per mount and again only when
// `reload` is called. While a reload is in flight the file already shown
// stays (`reloading` is true); the new one replaces it when it arrives.
export const useStaffTaxReviewFile = (rowId: string) => {
  const [state, setState] = useState<TaxReviewFileState>({ kind: 'loading' });
  const [reloading, setReloading] = useState(false);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setReloading(true);
    api
      .get(fileUrl(rowId))
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200 && isFile(res.data)) {
          setState({ kind: 'ready', file: res.data });
        } else if (res.status === 404) {
          setState({ kind: 'gone' });
        } else if (res.status === 429) {
          const detail = (res.data as { detail?: unknown } | null)?.detail;
          setState({
            kind: 'error',
            message: typeof detail === 'string' && detail !== '' ? detail : FILE_ERROR,
          });
        } else {
          setState({ kind: 'error', message: FILE_ERROR });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error', message: FILE_ERROR });
      })
      .finally(() => {
        if (!cancelled) setReloading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rowId, revision]);

  return { state, reloading, reload };
};

// --- the decision -----------------------------------------------------------

export const TAX_DECISION_REASON_MAX = 200;
export const TAX_DECISION_MAX_LINES = 20;

// Mirrors the server's choices (accounting/tax_review_service.py).
export const JOB_COST_CATEGORIES = [
  'materials',
  'labour',
  'subcontractors',
  'equipment',
  'permits_fees',
  'other_direct',
  'not_job_cost',
] as const;
export const TAX_BREAKDOWN_KINDS = ['gst', 'hst', 'pst', 'qst', 'rst', 'other'] as const;

export interface TaxDecisionLine {
  account_id: string;
  amount: string; // a decimal string, never a number
  project_id?: string;
  job_cost_category?: string;
}

export interface TaxBreakdownLine {
  kind: string;
  amount: string; // a decimal string, never a number
  recoverable: boolean;
}

// The body of a dry run. A confirm run is this same body with confirm,
// preview_token and idempotency_key added — see confirmBody.
export interface TaxDecisionBody {
  decision: 'A' | 'B';
  kinds: string[];
  reason: string;
  transaction_date?: string;
  lines?: TaxDecisionLine[]; // decision A only
  tax_breakdown?: TaxBreakdownLine[]; // decision A only
}

export interface TaxPlanLine {
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  amount?: string;
  debit?: string | null;
  credit?: string | null;
  project_id?: string | null;
  job_cost_category?: string | null;
}

export interface TaxDecisionPlan {
  decision: 'A' | 'B';
  outcome: string; // reclassification_posted | adjustment_reversed | no_entry
  kinds: string[];
  current_lines: TaxPlanLine[];
  target_lines: TaxPlanLine[] | null;
  entry_lines: TaxPlanLine[];
  entry_description: string | null;
  itc_debit: string | null;
  tax_breakdown: TaxBreakdownLine[] | null;
  reverses_adjustment_entry_id: string | null;
  transaction_date: string | null;
  transaction_date_source: string | null;
  original_tax_period: TaxPeriod | null;
  adjustment_date: string | null;
  adjustment_tax_period: TaxPeriod | null;
  locked_through_date: string | null;
  // A confirm run only: the entry it posted and the entry that reversed the
  // earlier adjustment, each null when there is none.
  entry_id?: string | null;
  reversal_entry_id?: string | null;
}

// The confirm run's body: the dry run's body, unchanged, plus the three
// fields that bind it to that preview.
export const confirmBody = (
  body: TaxDecisionBody,
  previewToken: string,
  idempotencyKey: string,
): Record<string, unknown> => ({
  ...body,
  confirm: true,
  preview_token: previewToken,
  idempotency_key: idempotencyKey,
});

export type TaxDecisionOutcome = PreviewedOutcome<TaxDecisionPlan>;

// The decision request of one row. `preview` sends the body as a dry run;
// `confirm` sends the same body bound to its preview. Refusals: 400
// {<field>: message}; the staff lane's 404; 409 {code, detail}; 429 with the
// server's detail (dry runs count toward the hourly limit, so a preview is
// sent only when the reviewer asks for one).
export const useStaffTaxDecision = (rowId: string) => {
  const preview = useCallback(
    (body: TaxDecisionBody): Promise<TaxDecisionOutcome> =>
      postForPreviewedPlan<TaxDecisionPlan>(
        fileUrl(rowId),
        { ...body },
        'Could not preview the decision.',
      ),
    [rowId],
  );
  const confirm = useCallback(
    (
      body: TaxDecisionBody,
      previewToken: string,
      idempotencyKey: string,
    ): Promise<TaxDecisionOutcome> =>
      postForPreviewedPlan<TaxDecisionPlan>(
        fileUrl(rowId),
        confirmBody(body, previewToken, idempotencyKey),
        'Could not confirm the decision.',
      ),
    [rowId],
  );
  return { preview, confirm };
};
