// Tax profile tab (s24 U2 — O-S24-3, D-S24-10). Reuses the shipped shared
// data layer + form (useTaxProfile + TaxProfileForm) rather than rebuilding it,
// so the GET/PUT contract and the exact writable-key set stay byte-identical
// (country, gst_hst_registered, gst_hst_number, filing_frequency, province,
// fiscal_year_end, home_currency — created_at/updated_at read-only). The form
// renders ONLY the serializer fields (no invented PST field) and already gates
// writes to owners (non-owners see disabled fields + no Save — an accountant
// can't trigger the owner-only 403). Wrapped in the sibling-tab Section surface.
import { type FC } from 'react';
import { useOrgMe } from '@/hooks/useAccounts';
import { useTaxProfile, type SaveTaxProfileResult } from '@/hooks/useTaxProfile';
import { TaxProfileForm } from '@/components/accounting/TaxProfileForm';
import { Section, Spinner } from './ui';

export const TaxProfileTab: FC<{ onSaved: (msg: string) => void }> = ({ onSaved }) => {
  const { role, isLoading: orgLoading } = useOrgMe();
  const isOwner = role === 'owner';
  const { profile, isLoading, error, refetch } = useTaxProfile();

  // Mirrors the standalone TaxProfile page's success presentation exactly:
  // profile is still the pre-save value here → null means this save CREATED it;
  // chart_reseeded is absent (not false) on a no-country-change PUT.
  const handleSaved = (result: SaveTaxProfileResult) => {
    const wasCreate = profile == null;
    let msg = wasCreate ? 'Tax profile created.' : 'Tax profile updated.';
    if (result.chart_reseeded) msg += ' — chart of accounts was reseeded for the new country.';
    onSaved(msg);
    refetch();
  };

  return (
    <Section
      title="Tax profile"
      description="Your tax registration and fiscal settings — these drive how the accounting agent treats tax on every document."
    >
      {orgLoading || isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner /></div>
      ) : (
        <>
          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
          {!isOwner && (
            <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Only the account owner can edit the tax profile. You can view the current settings below.
            </p>
          )}
          <TaxProfileForm profile={profile} isOwner={isOwner} onSaved={handleSaved} />
        </>
      )}
    </Section>
  );
};
