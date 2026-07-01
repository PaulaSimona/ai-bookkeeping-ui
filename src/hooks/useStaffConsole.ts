import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';

// ── Row shapes ────────────────────────────────────────────────────────────────
// Mirror the super-user-gated backend under /api/accounting/. UUID fields are
// strings; the integer BigAutoField PKs (`id`) are numbers.

export interface OrgListItem {
  id: string;
  name: string;
}

export interface StaffListItem {
  id: number;
  staff_user: string;
  is_super_user: boolean;
  role_type: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  staff_user_email: string;
  staff_user_name: string;
}

export interface AssignmentListItem {
  id: number;
  staff_user: string;
  org_id: string;
  is_active: boolean;
  assigned_by: string | null;
  assigned_at: string;
  deactivated_at: string | null;
  staff_user_email: string;
  staff_user_name: string;
  org_name: string;
}

// ── Structured error ────────────────────────────────────────────────────────
// Reads and writes surface this instead of throwing, so the page can branch on
// `status` (403 → "not authorized", 404 → "not found", 409 → "conflict", …).

export interface ConsoleError {
  status: number | null; // HTTP status, or null if the request never reached the server
  detail: string;        // human-readable message
  data?: unknown;        // raw response body (e.g. field-keyed validation errors)
}

function toConsoleError(err: any, fallback: string): ConsoleError {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data;
  // Mirror useAccounts.ts parsing for the message; keep status + raw body too.
  const detail = typeof data?.detail === 'string' ? data.detail : fallback;
  return { status, detail, data };
}

// ── Read hooks ────────────────────────────────────────────────────────────────
// Each: cancellable GET on mount, { data, isLoading, error, refetch }. Plain-array
// responses. A 403 (or any failure) becomes a structured `error` — never thrown.

function useListEndpoint<T>(url: string, failMessage: string) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ConsoleError | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api.get(url)
      .then((res) => {
        // Plain array expected; coerce anything non-array to [] so a non-list
        // can never reach the page's .map() and white-screen it.
        const d = res?.data;
        if (!cancelled) setData(Array.isArray(d) ? d : []);
      })
      .catch((err) => {
        if (!cancelled) setError(toConsoleError(err, failMessage));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [url, revision]);

  return { data, isLoading, error, refetch };
}

export const useOrgsList = () =>
  useListEndpoint<OrgListItem>('/api/accounting/orgs/', 'Failed to load organizations');

export const useStaffList = () =>
  useListEndpoint<StaffListItem>('/api/accounting/staff/list/', 'Failed to load staff');

export const useAssignments = () =>
  useListEndpoint<AssignmentListItem>('/api/accounting/assignments/list/', 'Failed to load assignments');

// ── Write functions ────────────────────────────────────────────────────────
// Thin POST wrappers returning { ok, data, errors }. They do NOT refetch — the
// page triggers refetch on ok and shows `errors` (400/403/404/409) inline.

export interface AssignmentPayload {
  staff_user_id: string;
  org_id: string;
}

export interface WriteResult {
  ok: boolean;
  data: AssignmentListItem | null;
  errors: ConsoleError | null;
}

export async function assignReviewer(payload: AssignmentPayload): Promise<WriteResult> {
  try {
    // 201 on assign (reactivates a deactivated row rather than duplicating).
    const res = await api.post('/api/accounting/assignments/', payload);
    if (res?.status === 200 || res?.status === 201) {
      return { ok: true, data: res.data as AssignmentListItem, errors: null };
    }
    return { ok: false, data: null, errors: null };
  } catch (err: any) {
    // 400 invalid · 403 not authorized · 404 unknown user/org · 409 already active.
    return { ok: false, data: null, errors: toConsoleError(err, 'Failed to assign reviewer') };
  }
}

export async function deactivateAssignment(payload: AssignmentPayload): Promise<WriteResult> {
  try {
    // 200 on revoke (flips is_active=False; never deletes).
    const res = await api.post('/api/accounting/assignments/deactivate/', payload);
    if (res?.status === 200 || res?.status === 201) {
      return { ok: true, data: res.data as AssignmentListItem, errors: null };
    }
    return { ok: false, data: null, errors: null };
  } catch (err: any) {
    // 403 not authorized · 404 unknown user/org · 409 no active assignment.
    return { ok: false, data: null, errors: toConsoleError(err, 'Failed to remove assignment') };
  }
}

export async function createStaffInvite(email: string): Promise<WriteResult> {
  try {
    // 201 on create. Authenticated super-user call → the shared `api` wrapper (JWT)
    // is correct here. The read serializer excludes the secret token and the form
    // only toasts success, so we don't surface the echo (data stays null).
    const res = await api.post('/api/accounting/staff/invite/', { email });
    if (res?.status === 200 || res?.status === 201) {
      return { ok: true, data: null, errors: null };
    }
    return { ok: false, data: null, errors: null };
  } catch (err: any) {
    // 400 invalid · 403 not authorized · 409 email already has an account.
    return { ok: false, data: null, errors: toConsoleError(err, 'Failed to send invite') };
  }
}

export async function deactivateStaffAccount(staffUserId: string): Promise<WriteResult> {
  try {
    // 200 on revoke. Platform-wide: the backend cascades assignment deactivation and
    // flips StaffProfile + User is_active (never deletes). Success is toast-only on
    // the page → data stays null (mirror createStaffInvite).
    const res = await api.post('/api/accounting/staff/deactivate/', { staff_user_id: staffUserId });
    if (res?.status === 200) {
      return { ok: true, data: null, errors: null };
    }
    return { ok: false, data: null, errors: null };
  } catch (err: any) {
    // 400 self-revoke · 403 not authorized / target is super user · 404 unknown · 409 already revoked.
    return { ok: false, data: null, errors: toConsoleError(err, 'Failed to revoke access') };
  }
}
