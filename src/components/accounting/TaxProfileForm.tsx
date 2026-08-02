// Shared tax-profile form (§14 14A-2, ruling R-a) — the single form body used
// by BOTH the Tax Profile settings page and the onboarding wizard's step 1.
// Extracted verbatim from pages/accounting/TaxProfile.tsx; logic unchanged,
// styling moved to the light content-area standard (s14/a0 precedent).
//
// The component owns form state and submission (useSaveTaxProfile). Success
// presentation stays with the consumer: onSaved receives the save result —
// including chart_reseeded, which is ABSENT (not false) on a PUT that did not
// change the country, so consumers keep the truthy check.
import { type FC, type FormEvent, useEffect, useState } from 'react';
// O-S33-1: the canonical table. The local copy removed from here held the
// same 13 codes in the same order — the only difference is the label
// 'Quebec' where this file said 'Québec'; the canonical spelling matches
// the backend chart fixture.
import { CA_PROVINCES } from '@/utils/constants';
import {
  useSaveTaxProfile,
  type TaxProfile,
  type TaxProfileCountry,
  type FilingFrequency,
  type HomeCurrency,
  type TaxProfilePayload,
  type SaveTaxProfileResult,
} from '@/hooks/useTaxProfile';

// ─── Constants ──────────────────────────────────────────────────────────────
// CA provinces/territories live HERE (not imported from the Tier 1 settings
// view) so the Tier 2 data layer stays self-contained. PST provinces are
// flagged for the inline hint.


const FILING_FREQUENCIES: { value: FilingFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

// ─── Local form shape ─────────────────────────────────────────────────────────

interface FormState {
  country: TaxProfileCountry;
  gst_hst_registered: boolean;
  gst_hst_number: string;
  filing_frequency: FilingFrequency | '';
  province: string;
  fiscal_year_end: string; // '' or 'YYYY-MM-DD'
  home_currency: HomeCurrency;
}

const DEFAULTS: FormState = {
  country: 'CA',
  gst_hst_registered: false,
  gst_hst_number: '',
  filing_frequency: '',
  province: '',
  fiscal_year_end: '',
  home_currency: 'CAD',
};

// ─── Shared field styling (light content-area standard) ───────────────────────

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed';

const Field: FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label, hint, children,
}) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
  </div>
);

// ─── Form ──────────────────────────────────────────────────────────────────────

export interface TaxProfileFormProps {
  /** Current profile, or null for a fresh org (404 empty state → create form). */
  profile: TaxProfile | null;
  /** Non-owners see every field disabled and no Save button. */
  isOwner: boolean;
  /** Called on a successful save with the result (incl. chart_reseeded when present). */
  onSaved: (result: SaveTaxProfileResult) => void;
}

export const TaxProfileForm: FC<TaxProfileFormProps> = ({ profile, isOwner, onSaved }) => {
  const { saveTaxProfile, isSubmitting, errors, clearErrors } = useSaveTaxProfile();

  const [form, setForm] = useState<FormState>(DEFAULTS);

  // Seed the form once the profile loads. A null profile (404 / fresh org) is
  // a valid empty state — keep the defaults so the owner can create one.
  useEffect(() => {
    if (profile) {
      setForm({
        country: profile.country,
        gst_hst_registered: profile.gst_hst_registered,
        gst_hst_number: profile.gst_hst_number ?? '',
        filing_frequency: (profile.filing_frequency ?? '') as FilingFrequency | '',
        province: profile.province ?? '',
        fiscal_year_end: profile.fiscal_year_end ?? '',
        home_currency: profile.home_currency,
      });
    }
  }, [profile]);

  // Country switch carries the conditional logic that mirrors the backend
  // validator: US forces gst_hst_registered=false and defaults the currency to
  // USD (still user-changeable); CA reveals the CA-only fields again.
  const onCountryChange = (next: TaxProfileCountry) => {
    setForm((f) => {
      if (next === f.country) return f;
      if (next === 'US') {
        return { ...f, country: 'US', gst_hst_registered: false, home_currency: 'USD' };
      }
      return { ...f, country: 'CA' };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearErrors();

    // Build exactly the writable fields. Enforce the US rule client-side:
    // a US business never carries GST/HST registration or CA-only fields.
    const isCA = form.country === 'CA';
    const payload: TaxProfilePayload = {
      country: form.country,
      gst_hst_registered: isCA ? form.gst_hst_registered : false,
      gst_hst_number: isCA && form.gst_hst_registered ? form.gst_hst_number : '',
      filing_frequency: isCA && form.gst_hst_registered ? form.filing_frequency : '',
      province: isCA ? form.province : '',
      fiscal_year_end: form.fiscal_year_end ? form.fiscal_year_end : null,
      home_currency: form.home_currency,
    };

    const res = await saveTaxProfile(payload);
    if (res.ok && res.data) {
      onSaved(res.data);
    }
    // 400 (validation) / 403 (non-owner) surface via `errors` below.
  };

  const isCA = form.country === 'CA';
  const showRegisteredFields = isCA && form.gst_hst_registered;
  const fieldErr = (f: string) => errors?.[f]?.[0];
  const topErr = errors?.detail?.[0] ?? errors?.non_field_errors?.[0];

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-5">

      {/* Save error banner (validation / permission) */}
      {topErr && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {topErr}
        </div>
      )}

      {/* Country */}
      <Field label="Country">
        <select
          value={form.country}
          disabled={!isOwner}
          onChange={(e) => onCountryChange(e.target.value as TaxProfileCountry)}
          className={inputCls}
        >
          <option value="CA">Canada</option>
          <option value="US">United States</option>
        </select>
        {fieldErr('country') && <p className="mt-1 text-xs text-red-600">{fieldErr('country')}</p>}
      </Field>

      {/* GST/HST registration — CA only */}
      {isCA && (
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.gst_hst_registered}
              disabled={!isOwner}
              onChange={(e) => setForm((f) => ({ ...f, gst_hst_registered: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF] disabled:opacity-60"
            />
            <span className="text-sm text-gray-700">Registered for GST/HST</span>
          </label>
          {fieldErr('gst_hst_registered') && (
            <p className="mt-1 text-xs text-red-600">{fieldErr('gst_hst_registered')}</p>
          )}
        </div>
      )}

      {/* GST/HST number + filing frequency — CA + registered only */}
      {showRegisteredFields && (
        <>
          <Field label="GST/HST number">
            <input
              type="text"
              value={form.gst_hst_number}
              disabled={!isOwner}
              onChange={(e) => setForm((f) => ({ ...f, gst_hst_number: e.target.value }))}
              placeholder="e.g. 123456789RT0001"
              className={inputCls}
            />
            {fieldErr('gst_hst_number') && (
              <p className="mt-1 text-xs text-red-600">{fieldErr('gst_hst_number')}</p>
            )}
          </Field>

          <Field label="Filing frequency">
            <select
              value={form.filing_frequency}
              disabled={!isOwner}
              onChange={(e) => setForm((f) => ({ ...f, filing_frequency: e.target.value as FilingFrequency | '' }))}
              className={inputCls}
            >
              <option value="">— Not set —</option>
              {FILING_FREQUENCIES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {fieldErr('filing_frequency') && (
              <p className="mt-1 text-xs text-red-600">{fieldErr('filing_frequency')}</p>
            )}
          </Field>
        </>
      )}

      {/* Province — CA only */}
      {isCA && (
        <Field label="Province" hint="BC, SK, MB and QC have provincial sales tax (PST) that affects tax treatment.">
          <select
            value={form.province}
            disabled={!isOwner}
            onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
            className={inputCls}
          >
            <option value="">— Select province —</option>
            {CA_PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
          {fieldErr('province') && <p className="mt-1 text-xs text-red-600">{fieldErr('province')}</p>}
        </Field>
      )}

      {/* Fiscal year end */}
      <Field
        label="Fiscal year end (month & day)"
        hint="Only the month and day matter — the year is ignored."
      >
        <input
          type="date"
          value={form.fiscal_year_end}
          disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, fiscal_year_end: e.target.value }))}
          className={inputCls}
        />
        {fieldErr('fiscal_year_end') && (
          <p className="mt-1 text-xs text-red-600">{fieldErr('fiscal_year_end')}</p>
        )}
      </Field>

      {/* Home currency */}
      <Field label="Home currency">
        <select
          value={form.home_currency}
          disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, home_currency: e.target.value as HomeCurrency }))}
          className={inputCls}
        >
          <option value="CAD">CAD — Canadian Dollar</option>
          <option value="USD">USD — US Dollar</option>
        </select>
        {fieldErr('home_currency') && (
          <p className="mt-1 text-xs text-red-600">{fieldErr('home_currency')}</p>
        )}
      </Field>

      {/* Save — owners only */}
      {isOwner && (
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isSubmitting ? 'Saving…' : 'Save tax profile'}
          </button>
        </div>
      )}
    </form>
  );
};
