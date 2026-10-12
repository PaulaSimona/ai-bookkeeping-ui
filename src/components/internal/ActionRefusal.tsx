import { type FC } from 'react';

import { RemediationRefusalView } from '@/components/internal/StaffEntryActions';
import { type RemediationRefusal } from '@/hooks/useStaffResolution';

// The amber notice of the plan-first staff actions: something staff must know
// that is not the server's refusal.
export const noticeCls =
  'rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200';

// What came back instead of a plan, or instead of the confirmed action — the
// bank-row merge and release, and the feed re-point (N-S87-6: one notice for
// both).
//   404 — what the action is addressed to is gone (`gone` says what): read
//         the list again.
//   429 — a rate limit, in the hook's words. Never retried here.
//   anything else — the server's refusal: its detail, and its code beneath.
export const ActionRefusal: FC<{
  refusal: RemediationRefusal;
  // The 404 sentence, in the words of the screen that shows it.
  gone: string;
  onRefresh: () => void;
}> = ({ refusal, gone, onRefresh }) => {
  if (refusal.status === 404) {
    return (
      <div role="alert" className={`flex items-center justify-between gap-4 ${noticeCls}`}>
        <p>{gone}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-medium underline underline-offset-2 hover:text-white"
        >
          Refresh
        </button>
      </div>
    );
  }
  if (refusal.status === 429) {
    return (
      <div role="alert" className={noticeCls}>
        {refusal.detail}
      </div>
    );
  }
  return (
    <RemediationRefusalView refusal={refusal}>
      {refusal.code && <p className="font-mono text-xs">{refusal.code}</p>}
    </RemediationRefusalView>
  );
};
