import api from '@/utils/api';
import { refusalFromResponse } from '@/hooks/staffPlan';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { type RemediationRefusal } from '@/hooks/useStaffResolution';

/**
 * A client's "no document" accounts (Release C2 U7; backend Release C1,
 * O-S88-4 — accounting/bank_ticket_views.py StaffOrgNoDocumentAccountsView):
 *   GET  /api/accounting/staff/orgs/<org>/no-document-accounts/   (paginated)
 *   POST /api/accounting/staff/orgs/<org>/no-document-accounts/   {account_id, no_document}
 * The list is the org's ACTIVE EXPENSE accounts in code order, each with its
 * mark. A posted bank row whose entry is, apart from the bank's own line, on
 * marked accounts only closes without waiting for a document.
 *
 * The POST marks or unmarks one account and is carried out at once — it has
 * no dry run. It answers {account, changed}: how the account stands now, and
 * whether this request changed anything. The mark a caller shows is the one
 * in that answer, never the one it asked for.
 */

// Mirrors bank_ticket_views.py _account_image.
export interface NoDocumentAccount {
  id: string;
  code: string;
  name: string;
  no_document: boolean;
}

const accountsUrl = (orgId: string) => `/api/accounting/staff/orgs/${orgId}/no-document-accounts/`;

export const useStaffNoDocumentAccounts = (orgId: string) =>
  usePaginatedList<NoDocumentAccount>(accountsUrl(orgId));

export type NoDocumentMarkOutcome =
  | { ok: true; account: NoDocumentAccount; changed: boolean }
  | { ok: false; refusal: RemediationRefusal };

// An answer counts only when it says how the account stands.
const isAccount = (value: unknown): value is NoDocumentAccount => {
  if (value == null || typeof value !== 'object') return false;
  const account = value as Record<string, unknown>;
  return (
    typeof account.id === 'string' &&
    typeof account.code === 'string' &&
    typeof account.name === 'string' &&
    typeof account.no_document === 'boolean'
  );
};

// Mark (`marked` true) or unmark one account. Refusals: 400 {account_id} /
// {no_document} for a body the server rejects; the staff lane's 404 (an
// account of another client is that same 404); 409 {code, detail} —
// not_expense_account, account_inactive; 429 for the action's hourly limit.
export const setNoDocumentAccount = async (
  orgId: string,
  accountId: string,
  marked: boolean,
): Promise<NoDocumentMarkOutcome> => {
  const fallback = marked ? 'Could not mark the account.' : 'Could not remove the mark.';
  try {
    const res = await api.post(accountsUrl(orgId), { account_id: accountId, no_document: marked });
    const data = res?.data as { account?: unknown; changed?: unknown } | null | undefined;
    if (res && res.status === 200 && data != null && typeof data === 'object' && isAccount(data.account)) {
      return { ok: true, account: data.account, changed: data.changed === true };
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
