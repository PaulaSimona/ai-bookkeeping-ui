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

// Void a posted accountant adjustment (W-S25-6 / O-S26-1). Author-only, enforced
// server-side; the UI only shows the affordance to the author (defence in depth).
// Resolved response: 200 = voided ({entry_id, status, voided_at, void_reason});
// any other status → res.data.detail (stable backend message surfaced verbatim).
export const voidAdjustment = (entryId: string, reason: string) =>
  api.post(`/api/accounting/adjustments/${entryId}/void/`, { reason });
