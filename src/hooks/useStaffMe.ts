import { useState, useEffect } from 'react';
import api from '@/utils/api';

export interface StaffMe {
  isSuperUser: boolean;
  roleType: string;
}

export interface StaffMeState {
  loading: boolean;
  staff: StaffMe | null;
}

/**
 * System B staff self-read — GET /api/accounting/staff/me/ (backend D-S27-12).
 *
 * The identity source for the internal console. Fetched once per mount with the
 * standard authed client. Deliberately its OWN module, NOT the Redux auth slice,
 * and it never reads User.is_staff / User.is_superuser — internal-staff identity
 * comes only from the StaffProfile-backed endpoint.
 *
 * 200 {is_staff_member, is_super_user, role_type} → active staff.
 * 404 (authenticated non-staff or deactivated staff) or 401 (anon) → staff: null,
 * no error surfaced — the guards redirect silently.
 */
export const useStaffMe = (): StaffMeState => {
  const [state, setState] = useState<StaffMeState>({ loading: true, staff: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, staff: null });
    api
      .get('/api/accounting/staff/me/')
      .then((res) => {
        if (cancelled) return;
        // The api interceptor RESOLVES non-401 HTTP errors (returns error.response)
        // and resolves cancellations to null — a 404 body lands here, not in .catch.
        // Status-check before trusting the body; never surface an error.
        if (res == null) return; // cancelled
        if (res.status === 200 && res.data?.is_staff_member) {
          setState({
            loading: false,
            staff: {
              isSuperUser: !!res.data.is_super_user,
              roleType: String(res.data.role_type ?? ''),
            },
          });
        } else {
          // 404 non-staff / deactivated, or any non-200 → not staff. Silent.
          setState({ loading: false, staff: null });
        }
      })
      .catch(() => {
        // 401-anon refresh failure lands here → not staff. No error surfaced.
        if (!cancelled) setState({ loading: false, staff: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
