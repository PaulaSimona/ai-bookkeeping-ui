// Stripe Connect data hooks (Chain C / C4 UI — O-S68-19). All calls go through
// the wrapped axios client, which adds Bearer + X-Org-Id on /api/accounting/
// URLs and RESOLVES error responses instead of throwing (utils/api.tsx:107) —
// so every hook status-checks, never try/catches. Nothing here handles a
// token or secret: the backend serializer is explicit-field (O-S68-12) and the
// UI only ever sees ids, status, livemode and dates.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

// ─── Types (mirror ConnectedStripeAccountSerializer, O-S68-12) ───────────────

export type ConnectedStripeAccount = {
  id: string;
  stripe_account_id: string;
  display_name: string | null;
  status: 'connected' | 'disconnected' | 'deauthorized';
  livemode: boolean;
  connected_at: string | null;
  disconnected_at: string | null;
};

export type StripeConnectSummary = {
  connected: boolean;
  configured: boolean;
  account: ConnectedStripeAccount | null;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number; error: string };

const ACCOUNT_URL = '/api/accounting/stripe/connect/account/';
const AUTHORIZE_URL = '/api/accounting/stripe/connect/authorize/';
const DISCONNECT_URL = '/api/accounting/stripe/connect/disconnect/';

// ─── Error copy (the six backend ERROR_CODES, stripe_connect_service.py) ─────

export const STRIPE_CONNECT_ERROR_COPY: Record<string, string> = {
  state: 'That connection attempt expired or was already used. Please try again.',
  denied: 'Stripe access was declined. No changes were made.',
  exchange: "Stripe didn't complete the connection. Please try again.",
  account_in_use: 'That Stripe account is already connected to a different organization.',
  already_connected: 'This organization already has a Stripe account connected.',
  config: "Stripe Connect isn't available yet.",
};

export const STRIPE_CONNECT_ERROR_FALLBACK = 'Stripe connection failed. Please try again.';

export const stripeConnectErrorCopy = (code: string | null | undefined): string =>
  (code && STRIPE_CONNECT_ERROR_COPY[code]) || STRIPE_CONNECT_ERROR_FALLBACK;

// ─── Error mapping (usePlaid.ts:114-129 shape) ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorMessage = (response: any): string => {
  if (response?.status === 403) {
    return 'Only the organization owner can manage the Stripe connection.';
  }
  if (response?.status === 503) {
    return STRIPE_CONNECT_ERROR_COPY.config;
  }
  if (response?.status === 502) {
    return "Stripe couldn't be reached. No changes were made. Please try again.";
  }
  if (typeof response?.data?.detail === 'string') {
    return response.data.detail;
  }
  return STRIPE_CONNECT_ERROR_FALLBACK;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** GET /stripe/connect/account/ — the org's Connect state (owner only). */
export const useStripeConnectAccount = () => {
  const [summary, setSummary] = useState<StripeConnectSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get(ACCOUNT_URL).then((response) => {
      if (cancelled) return;
      if (response?.status === 200 && response.data) {
        setSummary(response.data as StripeConnectSummary);
      } else {
        setError(errorMessage(response));
      }
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  return { summary, isLoading, error, refetch };
};

export type AuthorizeResult =
  | { ok: true; url: string }
  | { ok: false; status: number; message: string };

/** POST /stripe/connect/authorize/ → {url} the browser must navigate to. */
export const useStripeConnectAuthorize = () => {
  const [busy, setBusy] = useState(false);

  const authorize = useCallback(async (): Promise<AuthorizeResult> => {
    setBusy(true);
    const response = await api.post(AUTHORIZE_URL);
    const status: number = response?.status ?? 0;
    if (status === 200 && typeof response.data?.url === 'string') {
      // Caller navigates away; busy stays true so the button cannot re-fire.
      return { ok: true, url: response.data.url };
    }
    setBusy(false);
    if (status === 409) {
      return { ok: false, status, message: STRIPE_CONNECT_ERROR_COPY.already_connected };
    }
    if (status === 503) {
      return { ok: false, status, message: STRIPE_CONNECT_ERROR_COPY.config };
    }
    return { ok: false, status, message: errorMessage(response) };
  }, []);

  return { authorize, busy };
};

export type DisconnectResult =
  | { ok: true; summary: StripeConnectSummary }
  | { ok: false; status: number; message: string };

/** POST /stripe/connect/disconnect/ → the refreshed summary (200) or an error. */
export const useStripeConnectDisconnect = () => {
  const [busy, setBusy] = useState(false);

  const disconnect = useCallback(async (): Promise<DisconnectResult> => {
    setBusy(true);
    const response = await api.post(DISCONNECT_URL);
    setBusy(false);
    const status: number = response?.status ?? 0;
    if (status === 200 && response.data) {
      return { ok: true, summary: response.data as StripeConnectSummary };
    }
    return { ok: false, status, message: errorMessage(response) };
  }, []);

  return { disconnect, busy };
};
