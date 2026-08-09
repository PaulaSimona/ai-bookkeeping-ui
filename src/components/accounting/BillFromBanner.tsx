// Pre-flight bill-from banner (O-S41-8, S42 Chain 2). A persistent amber warning
// mounted on the invoice form and on draft invoice detail. It fetches the org
// identity once (useOrgProfile) and mirrors the backend six-field issuance guard
// via billFromCompleteness. Renders NOTHING when the identity is complete (or
// still loading / errored — the banner is advisory, never a blocker; the server
// guard is authoritative at issue-time). String-emptiness only; no money math.
import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { useOrgProfile, billFromCompleteness } from '@/hooks/useOrgProfile';

export interface BillFromBannerProps {
  /** Owners get an actionable edit link; non-owners are told to ask the owner. */
  isOwner: boolean;
}

export const BillFromBanner: FC<BillFromBannerProps> = ({ isOwner }) => {
  const { profile, isLoading, error } = useOrgProfile();

  // Advisory only — stay silent while loading or on a load error.
  if (isLoading || error || !profile) return null;

  const { isComplete, editableMissing, provinceMissing } = billFromCompleteness(profile);
  if (isComplete) return null;

  return (
    <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
      <div className="flex items-start gap-2.5">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div className="flex-1 space-y-1.5">
          <p className="font-medium">Complete your business identity before issuing.</p>

          {editableMissing.length > 0 && (
            <p>
              Missing: {editableMissing.join(', ')}.{' '}
              {isOwner ? (
                <Link to="/settings" className="font-medium underline hover:text-amber-900">
                  Set business identity →
                </Link>
              ) : (
                <span>Ask the account owner to complete the business identity in Settings.</span>
              )}
            </p>
          )}

          {provinceMissing && (
            <p>
              Your province/state isn’t set. This is part of your tax jurisdiction —{' '}
              <Link to="/accounting/tax-profile" className="font-medium underline hover:text-amber-900">
                review your Tax Profile →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
