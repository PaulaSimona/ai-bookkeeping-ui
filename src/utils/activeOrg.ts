// Active-org plumbing (Session-25 Phase E, U1). Two concerns live here so the
// React OrgContext and the framework-free axios interceptor stay in sync WITHOUT
// the interceptor importing React:
//   1. A module-level holder for the active org id — the interceptor reads it to
//      attach X-Org-Id on /api/accounting/* calls; OrgContext writes it.
//   2. Pure, storage-backed helpers for choosing/persisting the active org from
//      the /me payload's memberships — reused by OrgContext AND by the post-auth
//      landing logic (Login / HomeRedirect / RedirectPage) so both agree.
//
// Persistence is keyed per-user. The /me payload carries NO user id (only the
// nested user object with email/role/…), so email is the stable per-user key
// available client-side; a stored id is ALWAYS re-validated against the current
// /me memberships before use, so a stale or foreign key can never select an org
// the user is not actually a member of.

export interface Membership {
  org_id: string;
  org_name: string;
  role: string;
}

// ── 1. module-level holder (read by the axios interceptor) ─────────────────────

let activeOrgId: string | null = null;

export const getActiveOrgId = (): string | null => activeOrgId;

// Set by OrgContext whenever the active org changes (and on first resolve), so
// the very next /api/accounting/* request carries the right X-Org-Id header.
export const setActiveOrgIdHeader = (id: string | null): void => {
  activeOrgId = id;
};

// ── 2. per-user persistence + selection (pure) ─────────────────────────────────

const storageKey = (userKey: string): string => `t2.activeOrg.${userKey}`;

export const readStoredOrgId = (userKey: string | null): string | null => {
  if (!userKey) return null;
  try {
    return window.localStorage.getItem(storageKey(userKey));
  } catch {
    return null; // storage unavailable (private mode / disabled) — non-fatal
  }
};

export const writeStoredOrgId = (userKey: string | null, orgId: string): void => {
  if (!userKey) return;
  try {
    window.localStorage.setItem(storageKey(userKey), orgId);
  } catch {
    /* non-fatal — selection simply won't persist across reloads */
  }
};

// Choose the active org id from the caller's memberships:
//   0 memberships → null; 1 → that one (auto-select); >1 → the persisted choice
//   IF it is still a current membership, else null (require explicit selection).
export const pickActiveOrgId = (
  memberships: Membership[] | undefined,
  userKey: string | null,
): string | null => {
  const list = memberships ?? [];
  if (list.length === 0) return null;
  if (list.length === 1) return list[0].org_id;
  const stored = readStoredOrgId(userKey);
  if (stored && list.some((m) => m.org_id === stored)) return stored;
  return null;
};

export const findMembership = (
  memberships: Membership[] | undefined,
  orgId: string | null,
): Membership | null => {
  if (!orgId) return null;
  return (memberships ?? []).find((m) => m.org_id === orgId) ?? null;
};

// ── /me payload readers (the payload is nested under `user`; tolerate flat) ─────

/* eslint-disable @typescript-eslint/no-explicit-any */
export const membershipsOf = (payload: any): Membership[] =>
  payload?.user?.memberships ?? payload?.memberships ?? [];

export const userKeyOf = (payload: any): string | null =>
  payload?.user?.email ?? payload?.email ?? null;

export const hasTier2Of = (payload: any): boolean =>
  payload?.user?.has_tier2 ?? payload?.has_tier2 ?? false;

// Post-auth landing target. tier1Fallback differs by call site and MUST be
// preserved byte-for-byte (HomeRedirect → '/documents'; Login/RedirectPage →
// '/dashboard'). Only the NEW accountant case diverges from today's behavior:
// an entitled account whose ACTIVE membership role is accountant lands on the
// accountant Ledger; every other user keeps today's target.
export const authedHomePath = (payload: any, tier1Fallback: string): string => {
  const hasTier2 = hasTier2Of(payload);
  const activeId = pickActiveOrgId(membershipsOf(payload), userKeyOf(payload));
  const role = findMembership(membershipsOf(payload), activeId)?.role ?? null;
  if (hasTier2 && role === 'accountant') return '/accountant/ledger';
  if (hasTier2) return '/accounting/dashboard';
  return tier1Fallback;
};
/* eslint-enable @typescript-eslint/no-explicit-any */
