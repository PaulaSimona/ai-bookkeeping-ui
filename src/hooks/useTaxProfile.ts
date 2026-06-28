import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';

// ── Types ───────────────────────────────────────────────────────────────────
// Mirrors the owner-gated backend at GET/PUT /api/accounting/tax-profile/.
// Writable fields = the 7 below; created_at / updated_at are server-set and
// read-only (returned by GET, never sent on PUT).

export type TaxProfileCountry = 'CA' | 'US';
export type FilingFrequency = 'monthly' | 'quarterly' | 'annual';
export type HomeCurrency = 'CAD' | 'USD';

export interface TaxProfile {
  country: TaxProfileCountry;
  // CA only; the backend forces this false when country is 'US'.
  gst_hst_registered: boolean;
  gst_hst_number: string | null;
  filing_frequency: FilingFrequency | '' | null;
  province: string | null;
  // ISO date string, e.g. '2024-12-31'. The server normalizes the year to 2000.
  fiscal_year_end: string | null;
  home_currency: HomeCurrency;
  created_at: string;
  updated_at: string;
}

// What PUT accepts — the writable fields only. The page sends exactly what it
// has; this layer never injects or mutates fields.
export interface TaxProfilePayload {
  country: TaxProfileCountry;
  gst_hst_registered: boolean;
  gst_hst_number?: string;
  filing_frequency?: FilingFrequency | '';
  province?: string;
  fiscal_year_end?: string | null;
  home_currency: HomeCurrency;
}

// PUT echoes the saved profile and may add a chart_reseeded flag on a country
// change (see the backend reseed-on-country-change path).
export type SaveTaxProfileResult = TaxProfile & { chart_reseeded?: boolean };

// ── useTaxProfile ─────────────────────────────────────────────────────────────

export const useTaxProfile = () => {
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api.get('/api/accounting/tax-profile/')
      .then((res) => {
        if (!cancelled) setProfile(res?.data ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 = a fresh org with no profile configured yet. That is a valid
        // empty state, not an error — surface it as profile = null so the page
        // can render the create form rather than an error banner.
        if (err?.response?.status === 404) {
          setProfile(null);
          return;
        }
        setError(err?.response?.data?.detail ?? 'Failed to load tax profile');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [revision]);

  return { profile, isLoading, error, refetch };
};

// ── useSaveTaxProfile ─────────────────────────────────────────────────────────
// Thin PUT wrapper. Sends exactly the payload it is given — no US/GST coupling
// and no owner-gating here; those are page concerns layered on top later.

export const useSaveTaxProfile = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);

  const saveTaxProfile = useCallback(async (payload: TaxProfilePayload) => {
    setIsSubmitting(true);
    setErrors(null);
    try {
      const res = await api.put('/api/accounting/tax-profile/', payload);
      // 201 on create / 200 on update; the body may carry chart_reseeded.
      if (res?.status === 200 || res?.status === 201) {
        return { ok: true, data: res.data as SaveTaxProfileResult };
      }
      return { ok: false, data: null };
    } catch (err: any) {
      // 400 = validation (e.g. US + gst_hst_registered=true); 403 = non-owner.
      // Both arrive as { detail: ... } or field-keyed arrays — surface as-is so
      // the page can render the message(s).
      const data = err?.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      return { ok: false, data: null };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { saveTaxProfile, isSubmitting, errors, clearErrors: () => setErrors(null) };
};
