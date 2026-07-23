// Accountant adjustment POST (Session-25 Phase E, U2) — the write side of the
// §13.2 manual-adjustment seam (backend AdjustmentCreateView). Amounts are sent
// as STRINGS (the backend requires a positive string amount per line and re-
// validates debits == credits). The view returns stable, human-readable
// { detail } bodies on 4xx which the caller surfaces verbatim. Standalone — no
// owner-hook import.
import api from '@/utils/api';

export type AdjustmentSide = 'debit' | 'credit';

export interface AdjustmentLinePayload {
  account_id: string;
  side: AdjustmentSide;
  amount: string; // positive two-decimal string
}

export interface AdjustmentPayload {
  date: string;  // ISO 'YYYY-MM-DD'
  memo: string;
  lines: AdjustmentLinePayload[];
}

// Returns the resolved axios response (the interceptor resolves non-401 errors),
// so the caller status-checks: 201 = posted; any other status → res.data.detail.
export const postAdjustment = (payload: AdjustmentPayload) =>
  api.post('/api/accounting/adjustments/', payload);
