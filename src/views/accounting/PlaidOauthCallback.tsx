// Plaid OAuth redirect continuation (P2-C2).
//
// OAuth institutions (most Canadian banks) bounce the browser out to the
// bank's own auth page and then redirect back to the REGISTERED redirect URI
// after bank-side auth. This page is that URI's target: it re-initializes
// Plaid Link with the SAME link_token that started the session (stashed in
// localStorage by BankConnections before opening) plus receivedRedirectUri —
// Plaid's documented OAuth pattern — so Link can complete the flow and hand
// back the public_token.
import { type FC, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePlaidLink,
  type PlaidLinkOnSuccess,
  type PlaidLinkOnExit,
} from 'react-plaid-link';
import {
  buildExchangePayload,
  useExchange,
  useReconnectComplete,
  PLAID_LINK_TOKEN_KEY,
  PLAID_LINK_MODE_KEY,
  PLAID_RECONNECT_ITEM_KEY,
} from '@/api/plaid/usePlaid';

const clearStash = () => {
  localStorage.removeItem(PLAID_LINK_TOKEN_KEY);
  localStorage.removeItem(PLAID_LINK_MODE_KEY);
  localStorage.removeItem(PLAID_RECONNECT_ITEM_KEY);
};

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center px-6">
    {children}
  </div>
);

export const PlaidOauthCallback: FC = () => {
  const navigate = useNavigate();
  const { exchange } = useExchange();
  const { completeReconnect } = useReconnectComplete();

  // Read once on mount — absent/empty means the session did not start here
  // (or already finished) and there is nothing to resume.
  const [token] = useState<string | null>(
    () => localStorage.getItem(PLAID_LINK_TOKEN_KEY) || null,
  );
  // C3: mode + item id stashed by handleReconnect; absent = connect mode.
  const [mode] = useState<string | null>(
    () => localStorage.getItem(PLAID_LINK_MODE_KEY),
  );
  const [reconnectItemId] = useState<string | null>(
    () => localStorage.getItem(PLAID_RECONNECT_ITEM_KEY),
  );
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      // Reconnect continuation: the update-mode session re-authed an
      // EXISTING Item — post reconnect/complete, never exchange (which
      // would trip the duplicate-Item guard).
      if (mode === 'reconnect') {
        // Mode says reconnect but the item id is gone: NEVER fall through
        // to exchange (a reconnect success posted there would confuse the
        // duplicate-Item guard). Treat the session as expired instead.
        if (!reconnectItemId) {
          clearStash();
          setError('This bank connection session has expired.');
          return;
        }
        const result = await completeReconnect(reconnectItemId);
        clearStash();
        if (result.ok) {
          navigate('/accounting/bank-connections');
        } else {
          setError(result.error);
        }
        return;
      }

      const result = await exchange(buildExchangePayload(publicToken, metadata));
      localStorage.removeItem(PLAID_LINK_TOKEN_KEY);
      if (result.ok) {
        // The list page refetches on mount — the new institution appearing
        // there IS the confirmation (its toast is not reachable from here).
        navigate('/accounting/bank-connections');
      } else {
        setError(result.error);
      }
    },
    [mode, reconnectItemId, completeReconnect, exchange, navigate],
  );

  const onExit = useCallback<PlaidLinkOnExit>(() => {
    clearStash();
    navigate('/accounting/bank-connections');
  }, [navigate]);

  const { open, ready } = usePlaidLink({
    token,
    receivedRedirectUri: window.location.href,
    onSuccess,
    onExit,
  });

  // Same auto-open pattern as BankConnections: open as soon as Link is ready.
  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  // ── No stashed token: calm expired state, no crash, no auto-retry ──
  if (!token) {
    return (
      <Shell>
        <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-8 max-w-sm text-center">
          <p className="text-sm font-medium text-white/80">
            This bank connection session has expired.
          </p>
          <button
            onClick={() => navigate('/accounting/bank-connections')}
            className="mt-5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Start again
          </button>
        </div>
      </Shell>
    );
  }

  // ── Exchange failed: inline backend detail ──
  if (error) {
    return (
      <Shell>
        <div className="rounded-2xl bg-[#0A1628] border border-red-500/20 p-8 max-w-sm text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => navigate('/accounting/bank-connections')}
            className="mt-5 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Back to bank connections
          </button>
        </div>
      </Shell>
    );
  }

  // ── Resuming: Link is initializing / open ──
  return (
    <Shell>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-white/60">Resuming your bank connection…</p>
      </div>
    </Shell>
  );
};
