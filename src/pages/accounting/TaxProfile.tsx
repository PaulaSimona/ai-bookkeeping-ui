// Tax Profile settings page — thin consumer of the shared TaxProfileForm
// (§14 14A-2, ruling R-a: the form body is shared with the onboarding
// wizard's step 1). This page owns load (useTaxProfile), role (useOrgMe),
// and success presentation (toast + refetch); the form owns state/submit.
import { type FC, useState } from 'react';
import { useTaxProfile, type SaveTaxProfileResult } from '@/hooks/useTaxProfile';
import { useOrgMe } from '@/hooks/useAccounts';
import { TaxProfileForm } from '@/components/accounting/TaxProfileForm';

// ─── Lightweight toast (top-right, auto-dismiss) ───────────────────────────────

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

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  // Success presentation. Runs before refetch, so `profile` here is still the
  // pre-save value — null means this save CREATED the profile. chart_reseeded
  // is absent (not false) on a no-country-change PUT; truthy check is correct.
  const handleSaved = (result: SaveTaxProfileResult) => {
    const wasCreate = profile == null;
    let msg = wasCreate ? 'Tax profile created.' : 'Tax profile updated.';
    if (result.chart_reseeded) {
      msg += ' — chart of accounts was reseeded for the new country.';
    }
    showToast(msg);
    refetch();
  };

  // ── Loading ──
  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="h-7 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-gray-200 rounded animate-pulse mb-8" />
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Toast message={toast} />

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Tax Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your tax registration and fiscal settings. These drive how the
            accounting agent treats tax on every document.
          </p>
        </div>

        {/* Hard load error (non-404) */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 flex items-center gap-3 mb-6">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="flex-1 text-sm text-red-700">{error}</p>
            <button onClick={refetch} className="text-xs text-red-700 hover:text-red-800 underline">
              Retry
            </button>
          </div>
        )}

        {/* Read-only note for non-owners */}
        {!isOwner && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 mb-6">
            Only the account owner can edit the tax profile. You can view the current settings below.
          </div>
        )}

        <TaxProfileForm profile={profile} isOwner={isOwner} onSaved={handleSaved} />
      </div>
    </div>
  );
};
