// Plaid data hooks (P2-C1). All calls go through the wrapped axios client,
// which resolves error responses instead of throwing (non-401 errors return
// error.response) — so every hook status-checks, never try/catches.
// No token or secret is ever handled here: the backend exchanges and stores
// the Plaid access token server-side; the UI only sees link_token (short-
// lived, public by design) and display fields.
import { useCallback, useEffect, useState } from 'react';
import type { PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import api from '@/utils/api';

// localStorage stash for the OAuth redirect flow: Link re-initialization on
// /plaid/oauth-callback needs the SAME link_token back. Single-sourced here —
// BankConnections writes it, the callback page reads it, both clear it.
export const PLAID_LINK_TOKEN_KEY = 'plaid_link_token';
// Reconnect (C3): the OAuth callback must know WHICH mode the stashed
// session was — an update-mode success posts to reconnect/complete, never
// to exchange (which would trip the duplicate-Item guard). Absent keys =
// connect mode (backward compatible with any in-flight stash).
export const PLAID_LINK_MODE_KEY = 'plaid_link_mode';
export const PLAID_RECONNECT_ITEM_KEY = 'plaid_reconnect_item_id';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkTokenResponse {
  link_token: string;
  expiration: string | null;
}

/** One account as Plaid Link's onSuccess metadata reports it. */
export interface ExchangeMetadataAccount {
  id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
}

/** Exactly the shape the backend PlaidExchangeSerializer expects. */
export interface ExchangePayload {
  public_token: string;
  metadata: {
    institution: { institution_id: string; name: string };
    accounts: ExchangeMetadataAccount[];
  };
}

export interface ExchangeCreatedAccount {
  name: string;
  mask: string;
  ledger_account_code: string;
}

export interface ExchangeSkippedAccount {
  name: string;
  mask: string;
  type: string;
}

export interface ExchangeResponse {
  institution_name: string;
  accounts: ExchangeCreatedAccount[];
  skipped: ExchangeSkippedAccount[];
}

export interface PlaidItemAccount {
  name: string;
  mask: string;
  ledger_account_code: string | null;
}

export interface PlaidItem {
  id: string;
  institution_name: string;
  status: string;
  created_at: string;
  accounts: PlaidItemAccount[];
}

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number; error: string };

// ─── Link metadata → backend payload (single source of the mapping) ──────────

/**
 * Map Plaid Link's onSuccess metadata EXPLICITLY into the exact shape the
 * backend PlaidExchangeSerializer expects — never forward the raw metadata
 * object. Used by both the in-page flow (BankConnections) and the OAuth
 * redirect continuation (PlaidOauthCallback).
 */
export const buildExchangePayload = (
  publicToken: string,
  metadata: PlaidLinkOnSuccessMetadata,
): ExchangePayload => ({
  public_token: publicToken,
  metadata: {
    institution: {
      institution_id: metadata.institution?.institution_id ?? '',
      name: metadata.institution?.name ?? '',
    },
    accounts: metadata.accounts.map((account) => ({
      id: account.id,
      name: account.name ?? '',
      mask: account.mask ?? '',
      type: account.type ?? '',
      subtype: account.subtype ?? '',
    })),
  },
});

// ─── Error mapping ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorMessage = (response: any): string => {
  if (response?.status === 403) {
    return 'Only the organization owner can manage bank connections.';
  }
  if (response?.status === 503) {
    return 'Bank connections are not configured.';
  }
  // 502 (Plaid unreachable) and 400 (duplicate / unsupported / chart)
  // carry a human-readable detail from the backend — surface it as-is.
  if (typeof response?.data?.detail === 'string') {
    return response.data.detail;
  }
  return 'Something went wrong. Please try again.';
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useLinkToken = () => {
  const createLinkToken = async (): Promise<Result<LinkTokenResponse>> => {
    const response = await api.post('/api/accounting/plaid/link-token/');
    if (response?.status === 200 && response.data?.link_token) {
      return { ok: true, data: response.data as LinkTokenResponse };
    }
    return { ok: false, status: response?.status, error: errorMessage(response) };
  };
  return { createLinkToken };
};

export const useExchange = () => {
  const exchange = async (
    payload: ExchangePayload,
  ): Promise<Result<ExchangeResponse>> => {
    const response = await api.post('/api/accounting/plaid/exchange/', payload);
    if (response?.status === 201) {
      return { ok: true, data: response.data as ExchangeResponse };
    }
    return { ok: false, status: response?.status, error: errorMessage(response) };
  };
  return { exchange };
};

export const useReconnectLinkToken = () => {
  const createReconnectLinkToken = async (
    itemId: string,
  ): Promise<Result<LinkTokenResponse>> => {
    const response = await api.post(
      '/api/accounting/plaid/reconnect/link-token/', { item_id: itemId },
    );
    if (response?.status === 200 && response.data?.link_token) {
      return { ok: true, data: response.data as LinkTokenResponse };
    }
    return { ok: false, status: response?.status, error: errorMessage(response) };
  };
  return { createReconnectLinkToken };
};

export const useReconnectComplete = () => {
  const completeReconnect = async (
    itemId: string,
  ): Promise<Result<PlaidItem>> => {
    const response = await api.post(
      '/api/accounting/plaid/reconnect/complete/', { item_id: itemId },
    );
    if (response?.status === 200) {
      return { ok: true, data: response.data as PlaidItem };
    }
    return { ok: false, status: response?.status, error: errorMessage(response) };
  };
  return { completeReconnect };
};

export const usePlaidItems = () => {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get('/api/accounting/plaid/items/').then((response) => {
      if (cancelled) return;
      if (response?.status === 200) {
        setItems(response.data?.items ?? []);
      } else {
        setError(errorMessage(response));
      }
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [revision]);

  return { items, isLoading, error, refetch };
};
