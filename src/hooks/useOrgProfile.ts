// §Settings org bill-from identity data layer (O-S41-8, S42 Chain 2). Mirrors
// the owner-gated backend at GET/PATCH /api/accounting/org-profile/. The wrapped
// api client RESOLVES non-401 errors (utils/api.tsx returns error.response), so
// every call here status-checks the resolved response — null-check cancel, then
// branch on res.status. NO .catch reliance (the F-S41-2 house pattern). No money
// math anywhere; the only client computation is string-emptiness completeness.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

const BASE = '/api/accounting/org-profile/';

// GET returns the enumerated identity block: the four writable fields plus the
// read-only name / province_state / country the pre-flight banner needs.
export interface OrgProfile {
  legal_name: string;
  street_address: string;
  city: string;
  postal_code: string;
  // Read-only context — NOT writable via this endpoint.
  name: string;
  province_state: string;
  country: string;
}

// PATCH accepts the four writable fields only.
export interface OrgProfilePayload {
  legal_name?: string;
  street_address?: string;
  city?: string;
  postal_code?: string;
}

// ── useOrgProfile (GET, once per mount) ────────────────────────────────────────

export const useOrgProfile = () => {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get(BASE)
      .then((res) => {
        if (cancelled || res == null) return; // res == null → request cancelled
        if (res.status === 200) setProfile(res.data as OrgProfile);
        else { setProfile(null); setError(res.data?.detail ?? 'Failed to load business identity'); }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  return { profile, isLoading, error, refetch };
};

// ── useSaveOrgProfile (PATCH) ──────────────────────────────────────────────────

export const useSaveOrgProfile = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);

  const saveOrgProfile = useCallback(async (payload: OrgProfilePayload) => {
    setIsSubmitting(true);
    setErrors(null);
    try {
      const res = await api.patch(BASE, payload);
      if (res == null) {
        setErrors({ detail: ['Request was cancelled — please retry.'] });
        return { ok: false as const, data: null };
      }
      if (res.status === 200) {
        return { ok: true as const, data: res.data as OrgProfile };
      }
      // 400 = validation (e.g. max_length); 403 = non-owner / not on plan. The
      // body is { detail } or field-keyed arrays — surface as-is.
      const data = res.data;
      if (data && typeof data === 'object') setErrors(data);
      else setErrors({ detail: ['Could not save business identity.'] });
      return { ok: false as const, data: null };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { saveOrgProfile, isSubmitting, errors, clearErrors: () => setErrors(null) };
};

// ── Completeness predicate (mirrors the backend six-field issuance guard) ───────
// Mirrors accounting/sales_invoice_service.py::_validate_bill_from (O-S41-8):
// (legal_name OR name fallback), street_address, city, province_state,
// postal_code. province_state is checked here even though it is NOT editable on
// the identity form — it is jurisdiction-frozen, so it is reported separately.

export interface BillFromStatus {
  isComplete: boolean;
  editableMissing: string[]; // fixable on the Business identity form
  provinceMissing: boolean;  // fixable only via the jurisdiction / Tax Profile flow
}

export function billFromCompleteness(p: OrgProfile): BillFromStatus {
  const nameOk = ((p.legal_name || p.name || '').trim()) !== '';
  const editableMissing: string[] = [];
  if (!nameOk) editableMissing.push('legal/display name');
  if (!(p.street_address || '').trim()) editableMissing.push('street address');
  if (!(p.city || '').trim()) editableMissing.push('city');
  if (!(p.postal_code || '').trim()) editableMissing.push('postal code');
  const provinceMissing = !(p.province_state || '').trim();
  return {
    isComplete: editableMissing.length === 0 && !provinceMissing,
    editableMissing,
    provinceMissing,
  };
}
