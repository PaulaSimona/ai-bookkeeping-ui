import api from '@/utils/api';
import { type PlanOutcome, postForPlan, refusalFromResponse } from '@/hooks/staffPlan';
import { type RemediationRefusal } from '@/hooks/useStaffResolution';

/**
 * Staff feed re-point (S87 B2b; backend Release B2a, 125b419):
 *   GET  /api/accounting/staff/bank-accounts/<feed>/repoint-targets/
 *   POST /api/accounting/staff/bank-accounts/<feed>/repoint/
 *        {target_account_code, confirm, amount?, reason?}
 * Moves a credit-card feed to another card-liability account. The POST is a
 * dry run unless confirm is true (PlanOutcome). Every amount in a plan is the
 * server's string and stays a string — display only, never parsed here.
 */

export interface RepointTarget {
  code: string;
  name: string;
}

// Mirrors accounting/feed_repoint_service.py repoint_targets. `targets` is
// every account the re-point accepts for this feed, by code; the account the
// feed is on now is named separately and is never one of them.
export interface RepointTargets {
  feed_id: string;
  current_account: RepointTarget;
  targets: RepointTarget[];
  new_account_available: boolean;
}

// One account the feed is leaving (feed_repoint_service.py Leg.as_audit).
export interface RepointLeg {
  from_account_id: string;
  from_account_code: string;
  feed_lines: string;
  settlement_debits: string;
  earlier_moves: string;
  rest: string;
  basis: string;
  computed: string;
  moved: string;
}

// Mirrors accounting/feed_repoint_service.py RepointPlan.as_dict.
export interface RepointPlan {
  mode: string; // first | sweep
  option: string; // B | C
  feed_id: string;
  from_account_code: string | null;
  target_account_code: string;
  target_account_name: string;
  target_is_new: boolean;
  card_id: string | null;
  card_switches: boolean;
  computed: string;
  amount: string;
  override_reason: string | null;
  legs: RepointLeg[];
  balances: { account_code: string; before: string; after: string }[];
  notices: string[];
  entry_id: string | null; // null on a dry run, and when nothing had to move
}

// What target_account_code reads for "create this card's own account".
export const REPOINT_NEW_ACCOUNT = 'new';

export const REPOINT_REASON_MAX = 500;

export type RepointTargetsOutcome =
  | { ok: true; targets: RepointTargets }
  | { ok: false; refusal: RemediationRefusal };

// What the feed may be re-pointed at. 409 feed_not_card for a feed that is
// not a credit-card feed; the staff lane's 404 for one the caller may not see.
export const fetchRepointTargets = async (feedId: string): Promise<RepointTargetsOutcome> => {
  const fallback = 'Could not load the accounts this feed can move to.';
  try {
    const res = await api.get(`/api/accounting/staff/bank-accounts/${feedId}/repoint-targets/`);
    const data = res?.data as RepointTargets | null | undefined;
    if (res && res.status === 200 && data != null && typeof data === 'object') {
      // Never hand a non-list to the dialog's .map().
      return { ok: true, targets: { ...data, targets: Array.isArray(data.targets) ? data.targets : [] } };
    }
    return {
      ok: false,
      refusal: refusalFromResponse(res, fallback, 'Too many requests just now. Try again in a minute.'),
    };
  } catch {
    return { ok: false, refusal: { detail: fallback, context: {} } };
  }
};

export interface RepointRequest {
  targetAccountCode: string; // an account code, or REPOINT_NEW_ACCOUNT
  confirm: boolean;
  // An override of the amount the server computed: sent as typed (a string,
  // never a number), and only together with its reason.
  amount?: string;
  reason?: string;
}

// Re-point the feed (or, with confirm false, ask what that would do). 409
// {code, detail}: open_drafts, target_is_current, nothing_to_move,
// target_in_use, …; 400 {<field>: message} for a body the server rejects.
export const repointFeed = (
  feedId: string,
  request: RepointRequest,
): Promise<PlanOutcome<RepointPlan>> => {
  const body: Record<string, unknown> = {
    target_account_code: request.targetAccountCode,
    confirm: request.confirm,
  };
  // Unset is left out, never sent empty; a reason alone is not an override.
  const amount = request.amount?.trim();
  if (amount) {
    body.amount = amount;
    const reason = request.reason?.trim();
    if (reason) body.reason = reason;
  }
  return postForPlan<RepointPlan>(
    `/api/accounting/staff/bank-accounts/${feedId}/repoint/`,
    body,
    'Re-point failed.',
  );
};
