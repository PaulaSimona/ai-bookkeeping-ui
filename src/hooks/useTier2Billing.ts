// Bookkeeping Service billing actions (S45 §21 Chain C). Thin wrappers over the
// two owner-gated backend endpoints shipped in Chain B. The wrapped api client
// RESOLVES non-401 errors (utils/api.tsx returns error.response), so every call
// status-checks the resolved response — null-check cancel, then branch on status.
// No retries. Distinct outcomes are surfaced to the caller for the page's UX.
import { useCallback } from 'react';
import api from '@/utils/api';

export type CheckoutOutcome =
  | { kind: 'redirect' } // window.location assigned — page is navigating away
  | { kind: 'already_active' } // 409 — org already has a live subscription
  | { kind: 'not_configured' } // 503 — no price IDs configured server-side
  | { kind: 'error'; message: string };

export type PortalOutcome =
  | { kind: 'redirect' }
  | { kind: 'never_subscribed' } // 400 — no subscription to manage
  | { kind: 'error'; message: string };

export function useTier2Billing() {
  const createCheckout = useCallback(async (priceId: string): Promise<CheckoutOutcome> => {
    const res = await api.post('/api/accounting/stripe/create-checkout-session/', { price_id: priceId });
    if (res == null) return { kind: 'error', message: 'Request was cancelled — please try again.' };
    if (res.status === 200 && res.data?.url) {
      window.location.href = res.data.url;
      return { kind: 'redirect' };
    }
    if (res.status === 409) return { kind: 'already_active' };
    if (res.status === 503) return { kind: 'not_configured' };
    return { kind: 'error', message: res.data?.error ?? 'Could not start checkout. Please try again.' };
  }, []);

  const openPortal = useCallback(async (): Promise<PortalOutcome> => {
    const res = await api.post('/api/accounting/stripe/create-portal-session/');
    if (res == null) return { kind: 'error', message: 'Request was cancelled — please try again.' };
    if (res.status === 200 && res.data?.url) {
      window.location.href = res.data.url;
      return { kind: 'redirect' };
    }
    if (res.status === 400) return { kind: 'never_subscribed' };
    return { kind: 'error', message: res.data?.error ?? 'Could not open the billing portal. Please try again.' };
  }, []);

  return { createCheckout, openPortal };
}
