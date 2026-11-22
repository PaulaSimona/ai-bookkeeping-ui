// Test fixtures for the tax-review file (S98 P1d). Every id, name, amount and
// URL is invented; nothing here is a real client's data. Used by tests only.
import { type TaxReviewFile } from '@/hooks/useStaffTaxReview';

export const FX_ORG = '11111111-1111-4111-8111-111111111111';
export const FX_ROW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const FX_FILE_URL = `/api/accounting/staff/bank-rows/${FX_ROW}/tax-review/`;
export const FX_PURPOSES_URL = `/api/accounting/staff/orgs/${FX_ORG}/account-purposes/`;
export const FX_PROJECTS_URL = `/api/accounting/staff/orgs/${FX_ORG}/projects/`;
export const FX_SIGNED_URL = 'https://files.invalid/receipts/r-9?sig=invented-signature-9';

export const FX_BANK_ACCOUNT = 'b0000000-0000-4000-8000-000000000001';
export const FX_EXPENSE = 'e0000000-0000-4000-8000-000000000001';
export const FX_SUPPLIES = 'e0000000-0000-4000-8000-000000000002';
export const FX_ITC = 'c0000000-0000-4000-8000-000000000001';
export const FX_ITC_INACTIVE = 'c0000000-0000-4000-8000-000000000002';
export const FX_TAX_COLLECTED = 'c0000000-0000-4000-8000-000000000003';
export const FX_ENTRY = 'd0000000-0000-4000-8000-000000000001';
export const FX_ADJUSTMENT = 'd0000000-0000-4000-8000-000000000002';

export const taxFile = (over: Partial<TaxReviewFile> = {}): TaxReviewFile => ({
  org_id: FX_ORG,
  itc_accounts: [{ id: FX_ITC, code: '9310', name: 'Invented input tax credits', is_active: true }],
  bank_row: {
    id: FX_ROW,
    date: '2026-11-03',
    direction: 'money_out',
    amount: '113.00',
    description: 'POS PURCHASE INVENTED HARDWARE',
  },
  ticket: {
    id: 't0000000-0000-4000-8000-000000000001',
    status: 'in_review',
    routing_reason: 'tax_review',
    adjustment_entry_id: FX_ADJUSTMENT,
  },
  in_tax_review: true,
  open_conditions: [
    {
      id: 'o0000000-0000-4000-8000-000000000001',
      kind: 'tax_unverified',
      status: 'open',
      raised_at: '2026-11-04T15:30:00Z',
      raised_by: 'system',
      evidence: { note: 'invented open evidence' },
      resolved_at: null,
      resolved_by: null,
      resolution: null,
    },
    {
      id: 'o0000000-0000-4000-8000-000000000002',
      kind: 'tax_unexplained_amount',
      status: 'open',
      raised_at: '2026-11-04T15:31:00Z',
      raised_by: 'system',
      evidence: { unexplained: '1.25' },
      resolved_at: null,
      resolved_by: null,
      resolution: null,
    },
  ],
  closed_conditions: [
    {
      id: 'o0000000-0000-4000-8000-000000000003',
      kind: 'tax_kind_not_recoverable',
      status: 'resolved',
      raised_at: '2026-10-01T10:00:00Z',
      raised_by: 'system',
      evidence: { note: 'invented closed evidence' },
      resolved_at: '2026-10-02T11:00:00Z',
      resolved_by: 'reviewer@example.invalid',
      resolution: { decision: 'B' },
    },
  ],
  document_id: 4101,
  extraction: {
    total_amount: '113.00',
    tax_amount: '13.00',
    tax_type: 'HST',
    document_date: '2026-11-02',
    currency: 'CAD',
  },
  guard: {
    tax_mode: 'guard_v1',
    automated: { allowed: false, hold_reason: 'tax_unverified', evidence: { rule: 'invented rule' } },
    unexplained_amount: null,
  },
  bank_matches: [
    {
      id: 'm0000000-0000-4000-8000-000000000001',
      state: 'confirmed',
      journal_line_id: 'j0000000-0000-4000-8000-000000000001',
      entry_id: FX_ENTRY,
      account_code: '9010',
    },
  ],
  entry_chain: [
    {
      id: FX_ENTRY,
      role: 'bank_draft',
      entry_number: 41,
      entry_date: '2026-11-03',
      source: 'bank_feed',
      status: 'posted',
      description: 'Invented hardware purchase',
      is_live: true,
      corrects_entry_id: null,
      reverses_entry_id: null,
      lines: [
        {
          account_id: FX_EXPENSE,
          account_code: '9500',
          account_name: 'Invented repairs',
          debit: '113.00',
          credit: null,
          project_id: null,
          job_cost_category: null,
        },
        {
          account_id: FX_BANK_ACCOUNT,
          account_code: '9010',
          account_name: 'Invented chequing',
          debit: null,
          credit: '113.00',
          project_id: null,
          job_cost_category: null,
        },
      ],
    },
    {
      id: FX_ADJUSTMENT,
      role: 'adjustment',
      entry_number: 42,
      entry_date: '2026-11-04',
      source: 'staff_correction',
      status: 'reversed',
      description: 'Invented tax adjustment',
      is_live: false,
      corrects_entry_id: FX_ENTRY,
      reverses_entry_id: null,
      lines: [],
    },
  ],
  current_treatment: [
    {
      account_id: FX_EXPENSE,
      account_code: '9500',
      account_name: 'Invented repairs',
      project_id: null,
      job_cost_category: null,
      amount: '113.00',
    },
  ],
  live_adjustment_entry_id: null,
  dates: {
    transaction_date: '2026-11-03',
    original_tax_period: {
      label: '2026-Q4',
      start: '2026-10-01',
      end: '2026-12-31',
      frequency: 'quarterly',
    },
    adjustment_date: '2026-11-22',
    adjustment_tax_period: {
      label: '2026-Q4',
      start: '2026-10-01',
      end: '2026-12-31',
      frequency: 'quarterly',
    },
    locked_through_date: '2026-09-30',
    adjustment_date_locked: false,
  },
  audit_history: [
    {
      id: 7001,
      action: 'tax_condition_raised',
      actor: 'system',
      created_at: '2026-11-04T15:30:00Z',
      entity_type: 'bank_transaction',
      before: null,
      after: { kind: 'tax_unverified' },
    },
    {
      id: 7002,
      action: 'tax_review_file_read',
      actor: 'reviewer@example.invalid',
      created_at: '2026-11-05T09:00:00Z',
      entity_type: 'bank_transaction',
      before: { marker: 'invented-before' },
      after: { document_id: 4101, receipt_url_issued: true },
    },
  ],
  receipt: { url: FX_SIGNED_URL, expires_in: 300, content_type: 'image/png' },
  ...over,
});
