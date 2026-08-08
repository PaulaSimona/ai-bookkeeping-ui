// Business identity form (O-S41-8, S42 Chain 2) — the four writable bill-from
// fields (legal_name, street_address, city, postal_code). Owner-gated exactly as
// TaxProfileForm: non-owners see disabled fields and no Save button. Save via
// useSaveOrgProfile (PATCH, owner-only server-side). The read-only
// name / province_state / country are shown as context but never submitted;
// province_state gaps are resolved in the Tax Profile / jurisdiction flow, not
// here. String fields only — no money math.
import { type FC, type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useSaveOrgProfile,
  type OrgProfile,
  type OrgProfilePayload,
} from '@/hooks/useOrgProfile';

// ─── Shared field styling (light content-area standard; TaxProfileForm parity) ──

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

// ─── Local form shape (the four writable fields) ────────────────────────────────

interface FormState {
  legal_name: string;
  street_address: string;
  city: string;
  postal_code: string;
}

const DEFAULTS: FormState = {
  legal_name: '', street_address: '', city: '', postal_code: '',
};

// ─── Form ──────────────────────────────────────────────────────────────────────

export interface BusinessIdentityFormProps {
  /** Current identity block, or null before load. */
  profile: OrgProfile | null;
  /** Non-owners see every field disabled and no Save button. */
  isOwner: boolean;
  /** Called on a successful save with the updated identity block. */
  onSaved: (result: OrgProfile) => void;
}

export const BusinessIdentityForm: FC<BusinessIdentityFormProps> = ({ profile, isOwner, onSaved }) => {
  const { saveOrgProfile, isSubmitting, errors, clearErrors } = useSaveOrgProfile();

  const [form, setForm] = useState<FormState>(DEFAULTS);

  useEffect(() => {
    if (profile) {
      setForm({
        legal_name: profile.legal_name ?? '',
        street_address: profile.street_address ?? '',
        city: profile.city ?? '',
        postal_code: profile.postal_code ?? '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    const payload: OrgProfilePayload = {
      legal_name: form.legal_name,
      street_address: form.street_address,
      city: form.city,
      postal_code: form.postal_code,
    };
    const res = await saveOrgProfile(payload);
    if (res.ok && res.data) onSaved(res.data);
    // 400 (validation) / 403 (non-owner) surface via `errors` below.
  };

  const fieldErr = (f: string) => errors?.[f]?.[0];
  const topErr = errors?.detail?.[0] ?? errors?.non_field_errors?.[0];

  // Read-only jurisdiction context — legal display name falls back to org name,
  // exactly as the issuance guard evaluates it.
  const displayName = (profile?.legal_name || profile?.name || '').trim();
  const provinceState = (profile?.province_state || '').trim();

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-5">

      {/* Save error banner (validation / permission) */}
      {topErr && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {topErr}
        </div>
      )}

      <Field label="Legal / business name" hint={displayName ? undefined : `Falls back to your organization name (“${profile?.name ?? ''}”) until set.`}>
        <input
          type="text"
          value={form.legal_name}
          disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))}
          placeholder={profile?.name ?? 'e.g. Acme Widgets Inc.'}
          className={inputCls}
        />
        {fieldErr('legal_name') && <p className="mt-1 text-xs text-red-600">{fieldErr('legal_name')}</p>}
      </Field>

      <Field label="Street address">
        <input
          type="text"
          value={form.street_address}
          disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, street_address: e.target.value }))}
          placeholder="e.g. 100 Bank St"
          className={inputCls}
        />
        {fieldErr('street_address') && <p className="mt-1 text-xs text-red-600">{fieldErr('street_address')}</p>}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="City">
          <input
            type="text"
            value={form.city}
            disabled={!isOwner}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="e.g. Ottawa"
            className={inputCls}
          />
          {fieldErr('city') && <p className="mt-1 text-xs text-red-600">{fieldErr('city')}</p>}
        </Field>

        <Field label="Postal / ZIP code">
          <input
            type="text"
            value={form.postal_code}
            disabled={!isOwner}
            onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
            placeholder="e.g. K1P 1J1"
            className={inputCls}
          />
          {fieldErr('postal_code') && <p className="mt-1 text-xs text-red-600">{fieldErr('postal_code')}</p>}
        </Field>
      </div>

      {/* Province / state — READ-ONLY here; part of the tax jurisdiction. */}
      <Field
        label="Province / state"
        hint="Set as part of your tax jurisdiction — not editable here."
      >
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={provinceState || '—'}
            disabled
            readOnly
            className={inputCls}
          />
          <Link to="/accounting/tax-profile" className="whitespace-nowrap text-sm font-medium text-[#0066FF] hover:underline">
            Tax Profile →
          </Link>
        </div>
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
            {isSubmitting ? 'Saving…' : 'Save business identity'}
          </button>
        </div>
      )}
    </form>
  );
};
