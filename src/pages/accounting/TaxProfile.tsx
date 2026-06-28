import { type FC, type FormEvent, useEffect, useState } from 'react';
import {
  useTaxProfile,
  useSaveTaxProfile,
  type TaxProfileCountry,
  type FilingFrequency,
  type HomeCurrency,
  type TaxProfilePayload,
} from '@/hooks/useTaxProfile';
import { useOrgMe } from '@/hooks/useAccounts';

// ─── Constants ──────────────────────────────────────────────────────────────
// CA provinces/territories live HERE (not imported from the Tier 1 settings
// view) so the Tier 2 data layer stays self-contained. PST provinces are
// flagged for the inline hint.

const CA_PROVINCES: { code: string; name: string }[] = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Québec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

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

// ─── Shared field styling (matches the other Tier 2 pages) ─────────────────────

const inputCls =
  'w-full rounded-lg border border-white/15 bg-[#0A1628] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed';

const Field: FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label, hint, children,
}) => (
  <div>
    <label className="block text-xs font-medium text-white/60 mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-white/30">{hint}</p>}
  </div>
);

// ─── Lightweight toast (dark, top-right, auto-dismiss) ─────────────────────────

const Toast: FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-medium text-white shadow-lg">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      {message}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const TaxProfile: FC = () => {
  const { role, isLoading: orgLoading } = useOrgMe();
  const isOwner = role === 'owner';

  const { profile, isLoading, error, refetch } = useTaxProfile();
  const { saveTaxProfile, isSubmitting, errors, clearErrors } = useSaveTaxProfile();

  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [toast, setToast] = useState<string | null>(null);

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

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

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

    const wasCreate = profile == null;
    const res = await saveTaxProfile(payload);
    if (res.ok && res.data) {
      let msg = wasCreate ? 'Tax profile created.' : 'Tax profile updated.';
      if (res.data.chart_reseeded) {
        msg += ' — chart of accounts was reseeded for the new country.';
      }
      showToast(msg);
      refetch();
    }
    // 400 (validation) / 403 (non-owner) surface via `errors` below.
  };

  // ── Loading ──
  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="h-7 w-48 bg-white/8 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-white/8 rounded animate-pulse mb-8" />
          <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-6 space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-28 bg-white/8 rounded animate-pulse" />
                <div className="h-10 w-full bg-white/8 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isCA = form.country === 'CA';
  const showRegisteredFields = isCA && form.gst_hst_registered;
  const fieldErr = (f: string) => errors?.[f]?.[0];
  const topErr = errors?.detail?.[0] ?? errors?.non_field_errors?.[0];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <Toast message={toast} />

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Tax Profile</h1>
          <p className="mt-1 text-sm text-white/50">
            Your tax registration and fiscal settings. These drive how the
            accounting agent treats tax on every document.
          </p>
        </div>

        {/* Hard load error (non-404) */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3 mb-6">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="flex-1 text-sm text-red-400">{error}</p>
            <button onClick={refetch} className="text-xs text-red-400 hover:text-red-300 underline">
              Retry
            </button>
          </div>
        )}

        {/* Read-only note for non-owners */}
        {!isOwner && (
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/60 mb-6">
            Only the account owner can edit the tax profile. You can view the current settings below.
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl bg-[#0A1628] border border-white/10 p-6 space-y-5">

          {/* Save error banner (validation / permission) */}
          {topErr && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
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
            {fieldErr('country') && <p className="mt-1 text-xs text-red-400">{fieldErr('country')}</p>}
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
                  className="h-4 w-4 rounded border-white/20 text-[#0066FF] focus:ring-[#0066FF] disabled:opacity-60"
                />
                <span className="text-sm text-white/70">Registered for GST/HST</span>
              </label>
              {fieldErr('gst_hst_registered') && (
                <p className="mt-1 text-xs text-red-400">{fieldErr('gst_hst_registered')}</p>
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
                  <p className="mt-1 text-xs text-red-400">{fieldErr('gst_hst_number')}</p>
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
                  <p className="mt-1 text-xs text-red-400">{fieldErr('filing_frequency')}</p>
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
              {fieldErr('province') && <p className="mt-1 text-xs text-red-400">{fieldErr('province')}</p>}
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
              <p className="mt-1 text-xs text-red-400">{fieldErr('fiscal_year_end')}</p>
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
              <p className="mt-1 text-xs text-red-400">{fieldErr('home_currency')}</p>
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
      </div>
    </div>
  );
};
