import api from '@/utils/api';
import {
  type RemediationRefusal,
  extractDetail,
  refusalCode,
} from '@/hooks/useStaffResolution';

// Dry-run-by-default staff actions (S87 B2b). The bank-row merge /
// release-flag (useStaffBankRows) and the feed re-point (useStaffRepoint)
// answer 200 {executed, plan}. With confirm false nothing is written and
// `plan` is what WOULD happen; with confirm true that plan was carried out. A
// refusal reads like a remediation refusal: 409 {code, detail} for a state
// conflict, 400 {<field>: message} for a body the server rejects, the staff
// lane's 404, 429 for the action's own hourly limit.

export type PlanOutcome<P> =
  | { ok: true; executed: boolean; plan: P }
  | { ok: false; refusal: RemediationRefusal };

// A response that is not the success the caller expected, as a refusal.
// `limitDetail` is what a 429 reads as (an hourly action limit, or the
// per-minute read limit).
export const refusalFromResponse = (
  res: unknown,
  fallback: string,
  limitDetail: string,
): RemediationRefusal => {
  const { status, data: raw } = (res ?? {}) as { status?: number; data?: unknown };
  const context: Record<string, unknown> =
    raw != null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  if (status === 404) return { status, detail: 'Not found', context };
  if (status === 429) return { status, detail: limitDetail, context };
  return { status, code: refusalCode(res), detail: extractDetail(res, fallback), context };
};

export const postForPlan = async <P>(
  url: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<PlanOutcome<P>> => {
  try {
    const res = await api.post(url, body);
    const data = res?.data as { executed?: unknown; plan?: P } | null | undefined;
    if (res && res.status === 200 && data != null && typeof data === 'object' && data.plan != null) {
      return { ok: true, executed: data.executed === true, plan: data.plan };
    }
    return {
      ok: false,
      refusal: refusalFromResponse(
        res,
        fallback,
        'The hourly limit for this action has been reached. Try again later.',
      ),
    };
  } catch {
    return { ok: false, refusal: { detail: fallback, context: {} } };
  }
};
