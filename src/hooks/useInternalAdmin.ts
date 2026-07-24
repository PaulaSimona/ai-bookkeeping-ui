import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';

/**
 * Super-user console data + actions (MASTER_T2 §15). Endpoints (all can_administer,
 * 403 on non-super):
 *   GET  /api/accounting/staff/list/
 *   GET  /api/accounting/assignments/list/   (includes inactive rows)
 *   GET  /api/accounting/orgs/
 *   POST /api/accounting/staff/invite/        {email}
 *   POST /api/accounting/staff/deactivate/    {staff_user_id}
 *   POST /api/accounting/assignments/          {staff_user_id, org_id}
 *   POST /api/accounting/assignments/deactivate/ {staff_user_id, org_id}
 * Lists are bare capped arrays (X-Total-Count header ignored client-side; count
 * derived from length). Every call status-checks the resolved response; a 403
 * sets `forbidden` so the page shows a calm "not permitted" state, never a crash.
 */

// Mirrors staff_serializers.py StaffProfileReadSerializer.
export interface StaffListItem {
  id: string;
  staff_user: string;
  staff_user_email: string;
  staff_user_name: string;
  is_super_user: boolean;
  role_type: string;
  is_active: boolean;
  created_at: string | null;
  created_by: string | null;
}

// Mirrors staff_serializers.py ReviewerAssignmentReadSerializer.
export interface AssignmentListItem {
  id: string;
  staff_user: string;
  staff_user_email: string;
  staff_user_name: string;
  org_id: string;
  org_name: string;
  is_active: boolean;
  assigned_by: string | null;
  assigned_at: string | null;
  deactivated_at: string | null;
}

export interface OrgItem {
  id: string;
  name: string;
}

export interface WriteResult {
  ok: boolean;
  errorDetail?: string;
}

interface ListState<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  forbidden: boolean;
  refetch: () => void;
}

const extractDetail = (res: unknown, fallback: string): string => {
  const data = (res as { data?: unknown } | null | undefined)?.data;
  if (data == null || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string' && obj.detail) return obj.detail;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'code') continue;
    if (Array.isArray(val)) parts.push(val.map((v) => String(v)).join(' '));
    else if (typeof val === 'string') parts.push(val);
  }
  return parts.length ? parts.join(' ') : fallback;
};

const useList = <T>(url: string, failMessage: string): ListState<T> => {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    api
      .get(url)
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) {
          // Bare capped array; coerce so a non-array can never white-screen .map().
          setData(Array.isArray(res.data) ? (res.data as T[]) : []);
        } else if (res.status === 403) {
          setForbidden(true);
          setData([]);
        } else {
          setData([]);
          setError(extractDetail(res, failMessage));
        }
      })
      .catch(() => {
        if (!cancelled) setError(failMessage);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, failMessage, revision]);

  return { data, isLoading, error, forbidden, refetch };
};

export const useStaffList = () =>
  useList<StaffListItem>('/api/accounting/staff/list/', 'Failed to load staff.');
export const useAssignments = () =>
  useList<AssignmentListItem>('/api/accounting/assignments/list/', 'Failed to load assignments.');
export const useOrgsList = () =>
  useList<OrgItem>('/api/accounting/orgs/', 'Failed to load organizations.');

const post = async (url: string, body: unknown, fallback: string): Promise<WriteResult> => {
  try {
    const res = await api.post(url, body);
    if (res && (res.status === 200 || res.status === 201)) return { ok: true };
    return { ok: false, errorDetail: extractDetail(res, fallback) };
  } catch {
    return { ok: false, errorDetail: fallback };
  }
};

export const createStaffInvite = (email: string) =>
  post('/api/accounting/staff/invite/', { email }, 'Failed to send invite.');

export const deactivateStaffAccount = (staffUserId: string) =>
  post('/api/accounting/staff/deactivate/', { staff_user_id: staffUserId }, 'Failed to deactivate staff.');

export const assignReviewer = (staffUserId: string, orgId: string) =>
  post('/api/accounting/assignments/', { staff_user_id: staffUserId, org_id: orgId }, 'Failed to assign reviewer.');

export const deactivateAssignment = (staffUserId: string, orgId: string) =>
  post(
    '/api/accounting/assignments/deactivate/',
    { staff_user_id: staffUserId, org_id: orgId },
    'Failed to revoke assignment.',
  );
