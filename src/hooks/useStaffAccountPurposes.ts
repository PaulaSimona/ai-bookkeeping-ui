import { useCallback, useEffect, useState } from 'react';
import { type PreviewedOutcome, postForPreviewedPlan } from '@/hooks/staffPlan';
import api from '@/utils/api';

/**
 * A client's account purposes (S98 P1d; backend P1d —
 * accounting/account_purpose_views.py):
 *   GET  /api/accounting/staff/orgs/<org>/account-purposes/   {count, accounts}
 *   POST /api/accounting/staff/accounts/<id>/purpose/         {purpose, reason, confirm, preview_token}
 * STAFF ONLY: no customer page may import this module (pinned by
 * staffTaxBoundary.test.ts). The read is not paginated: every account of the
 * org, active and inactive, in code order. Each account carries the purposes
 * the server allows for it (`allowed_purposes`) and whether its purpose lets
 * it take a purchase allocation (`allowed_for_allocation`) — both are the
 * server's and are never worked out here.
 *
 * The POST is a dry run unless confirm is true. The dry run answers the plan
 * and a preview token; the confirm run sends that token with the same body.
 */

export interface AccountPurposeRow {
  id: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  purpose: string;
  allowed_for_allocation: boolean;
  allowed_purposes: string[];
}

// The purposes that let an account take a purchase allocation. FOR GROUPING
// ONLY: the page offers the server's `allowed_purposes` and uses this list to
// put the allocation ones first — always intersected with what the server
// sent, never offered on its own. Whether an account is allowed for
// allocation is the server's `allowed_for_allocation`, never this list.
export const ALLOCATION_PURPOSES: readonly string[] = [
  'expense',
  'cost_of_sales',
  'inventory',
  'prepaid',
  'fixed_asset',
];

export const ACCOUNT_PURPOSE_REASON_MAX = 200;

const purposesUrl = (orgId: string) => `/api/accounting/staff/orgs/${orgId}/account-purposes/`;
const purposeUrl = (accountId: string) => `/api/accounting/staff/accounts/${accountId}/purpose/`;

const READ_ERROR = 'Could not load the account purposes.';

const isRow = (value: unknown): value is AccountPurposeRow => {
  if (value == null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.code === 'string' &&
    typeof row.name === 'string' &&
    typeof row.purpose === 'string' &&
    typeof row.allowed_for_allocation === 'boolean' &&
    Array.isArray(row.allowed_purposes)
  );
};

// The org's accounts with their purposes. `orgId` null reads nothing (a
// caller that learns the org from another read passes null until it has it).
export const useStaffAccountPurposes = (orgId: string | null) => {
  const [accounts, setAccounts] = useState<AccountPurposeRow[]>([]);
  const [isLoading, setIsLoading] = useState(orgId != null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (orgId == null) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    api
      .get(purposesUrl(orgId))
      .then((res) => {
        if (cancelled || res == null) return;
        const data = res.data as { accounts?: unknown; detail?: unknown } | null | undefined;
        if (res.status === 200 && Array.isArray(data?.accounts)) {
          setAccounts(data.accounts.filter(isRow));
          return;
        }
        setAccounts([]);
        if (res.status === 404) setNotFound(true);
        setError(
          res.status === 404
            ? 'Not found'
            : res.status === 429 && typeof data?.detail === 'string' && data.detail !== ''
              ? data.detail
              : READ_ERROR,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
          setError(READ_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, revision]);

  return { accounts, isLoading, error, notFound, refetch };
};

// Mirrors account_purpose_views.py: what the change would do (dry run) or did.
export interface AccountPurposePlan {
  account_id: string;
  code: string;
  name: string;
  type: string;
  before: string;
  after: string;
  allowed_for_allocation: boolean; // as it stands AFTER the change
  changes: boolean; // false: the account already has this purpose
  reason: string;
}

export type AccountPurposeOutcome = PreviewedOutcome<AccountPurposePlan>;

// The purpose change of one account. `preview` is the dry run; `confirm`
// sends the same purpose and reason with the dry run's token. Refusals: 400
// {purpose | reason | confirm | preview_token | detail}; the staff lane's
// 404; 409 purpose_type_mismatch and preview_invalid / _expired / _stale.
export const useStaffAccountPurposeAction = () => {
  const preview = useCallback(
    (accountId: string, purpose: string, reason: string): Promise<AccountPurposeOutcome> =>
      postForPreviewedPlan<AccountPurposePlan>(
        purposeUrl(accountId),
        { purpose, reason },
        'Could not preview the change.',
      ),
    [],
  );
  const confirm = useCallback(
    (
      accountId: string,
      purpose: string,
      reason: string,
      previewToken: string,
    ): Promise<AccountPurposeOutcome> =>
      postForPreviewedPlan<AccountPurposePlan>(
        purposeUrl(accountId),
        { purpose, reason, confirm: true, preview_token: previewToken },
        'Could not change the purpose.',
      ),
    [],
  );
  return { preview, confirm };
};
