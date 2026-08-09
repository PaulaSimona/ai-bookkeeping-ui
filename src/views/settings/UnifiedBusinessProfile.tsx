// Unified Business Profile (S43, O-S43-2 v2) — the SINGLE business-profile
// surface for Tier 2-entitled users. Absorbs the standalone Business Identity
// page: the Organization bill-from block (4 writable fields via the existing
// owner-gated PATCH /api/accounting/org-profile/) plus a clearly-labeled
// "Subscription billing" section carrying ONLY the display name + billing
// province via the existing /api/user/profile contract.
//
// NO write-through, NO server-side coupling: this is client-side orchestration
// of two independent, pre-existing bounded endpoints. The five inert Company
// fields (business_number, address, number, city, postal_code) are NOT rendered
// and remain untouched — the subscription PUT echoes the full 7-key company
// block loaded from the server (a partial block 500s server-side, KeyError),
// editing only company_name + province in place.
//
// Feedback follows the house pattern (F-S41-2): inline field errors + the
// page-local LocalToast (settings/ui.tsx), surfaced via the showSuccess /
// showError props Settings passes down. NEVER the global useToast.
import { type FC, type FormEvent, useEffect, useState } from 'react';
import api from '@/utils/api';
import { CA_PROVINCES, US_STATES } from '@/utils/constants';
import { useOrgProfile, type OrgProfile } from '@/hooks/useOrgProfile';
import { useOrgMe } from '@/hooks/useAccounts';
import { BusinessIdentityForm } from '@/components/accounting/BusinessIdentityForm';
import { Field, Input, SaveButton, Section, Select, Spinner } from './ui';

type ToastFns = { showSuccess: (m: string) => void; showError: (m: string) => void };

// ─── Subscription billing (display name + billing province ONLY) ────────────────
// GET  /api/user/profile → {..., phone_number, company:{7 keys}}   (byte-preserved)
// PUT  /api/user/profile ← {phone_number, company:{ALL 7 keys}}    (byte-preserved)
// Load-then-merge: the full company block is held in state and echoed on save;
// only company_name + province are editable here. No refetch before save.
const SubscriptionBillingSection: FC<ToastFns> = ({ showSuccess, showError }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [country, setCountry] = useState('CA'); // LOCAL only — never persisted
  // Full 7-key company block + phone_number, mirroring the Tier 1 section's
  // contract. The five inert fields are carried verbatim and never rendered.
  const [form, setForm] = useState({
    phone_number:    '',
    company_name:    '',
    business_number: '',
    address:         '',
    number:          '',
    city:            '',
    province:        '',
    postal_code:     '',
  });

  useEffect(() => {
    api.get('/api/user/profile').then((res) => {
      if (res?.data) {
        const c = res.data.company ?? {};
        setForm({
          phone_number:    res.data.phone_number ?? '',
          company_name:    c.company_name    ?? '',
          business_number: c.business_number ?? '',
          address:         c.address         ?? '',
          number:          c.number          ?? '',
          city:            c.city            ?? '',
          province:        c.province        ?? '',
          postal_code:     c.postal_code     ?? '',
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // All 7 company keys ALWAYS sent — a partial block 500s server-side
      // (KeyError). Only company_name + province were editable; the rest are
      // echoed from loaded state, so the inert fields stay untouched.
      const { phone_number, ...companyFields } = form;
      const res = await api.put('/api/user/profile', { phone_number, company: companyFields });
      if (res?.status === 200) {
        showSuccess('Subscription billing saved.');
      } else {
        showError('Failed to save. Please try again.');
      }
    } catch {
      showError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Section title="Subscription billing" description="The name and province on your subscription invoices.">
      <div className="flex h-32 items-center justify-center"><Spinner /></div>
    </Section>
  );

  return (
    <Section
      title="Subscription billing"
      description="The name and province used on your subscription invoices and for tax calculations."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Billing name">
          <Input value={form.company_name} onChange={set('company_name')} placeholder="Acme Corp" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="CA">Canada</option>
              <option value="US">United States</option>
            </Select>
          </Field>
          <Field label={country === 'CA' ? 'Province' : 'State'}>
            {country === 'CA' ? (
              <Select value={form.province} onChange={set('province')}>
                <option value="">Select…</option>
                {CA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </Select>
            ) : (
              <Select value={form.province} onChange={set('province')}>
                <option value="">Select…</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="pt-1">
          <SaveButton saving={saving} />
        </div>
      </form>
    </Section>
  );
};

// ─── Business Identity (bill-from) — reuses BusinessIdentityForm verbatim ────────
const BusinessIdentitySection: FC<ToastFns> = ({ showSuccess }) => {
  const { role, isLoading: orgLoading } = useOrgMe();
  const isOwner = role === 'owner';
  const { profile, isLoading, error, refetch } = useOrgProfile();

  const handleSaved = (_result: OrgProfile) => {
    showSuccess('Business identity updated.');
    refetch();
  };

  if (orgLoading || isLoading) return (
    <Section
      title="Business Identity"
      description="The name and address that appear as the “bill from” on every invoice and credit note you issue."
    >
      <div className="flex h-48 items-center justify-center"><Spinner /></div>
    </Section>
  );

  return (
    <Section
      title="Business Identity"
      description="The name and address that appear as the “bill from” on every invoice and credit note you issue. Complete this before issuing."
    >
      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button onClick={refetch} className="text-xs text-red-700 underline hover:text-red-800">Retry</button>
        </div>
      )}

      {!isOwner && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Only the account owner can edit the business identity. You can view the current details below.
        </div>
      )}

      <BusinessIdentityForm profile={profile} isOwner={isOwner} onSaved={handleSaved} />
    </Section>
  );
};

// ─── Unified surface ────────────────────────────────────────────────────────────
export const UnifiedBusinessProfile: FC<ToastFns> = ({ showSuccess, showError }) => (
  <div className="space-y-6">
    <BusinessIdentitySection showSuccess={showSuccess} showError={showError} />
    <SubscriptionBillingSection showSuccess={showSuccess} showError={showError} />
  </div>
);
