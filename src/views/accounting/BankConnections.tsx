// Bank Connections (P2-C1) — Plaid Link flow + connected-institutions list.
// Mirrors the TaxProfile page precedent: private route, NO route-level role
// guard; owner-gating enforced inside the page via useOrgMe() (and again
// server-side — every Plaid endpoint is owner-only).
//
// NOTE on components: the shared Badge/Button/Toast in components/ are dead
// react-bootstrap legacy (react-bootstrap is NOT installed; the global toast
// renderer is mounted nowhere) — importing them here would break the vite
// build. This page follows the live Tier 2 convention instead (TaxProfile):
// inline Tailwind button/badge and a local top-right toast.
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import {
  usePlaidLink,
  type PlaidLinkOnSuccess,
  type PlaidLinkOnExit,
} from 'react-plaid-link';
import {
  buildExchangePayload,
  useLinkToken,
  useExchange,
  usePlaidItems,
  PLAID_LINK_TOKEN_KEY as LINK_TOKEN_KEY,
  type PlaidItem,
} from '@/api/plaid/usePlaid';
import { useOrgMe } from '@/hooks/useAccounts';

// ─── Local toast (TaxProfile convention, extended with variants) ──────────────

interface ToastMsg { message: string; variant: 'success' | 'error' | 'info' }

const TOAST_STYLES: Record<ToastMsg['variant'], string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-600',
  info: 'bg-[#0066FF]',
};

const Toast: FC<{ toast: ToastMsg | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className={`fixed top-5 right-5 z-50 max-w-md rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-lg ${TOAST_STYLES[toast.variant]}`}>
      {toast.message}
    </div>
  );
};

// ─── Status badge (inline Tailwind — see components note above) ───────────────

const StatusBadge: FC<{ status: string }> = ({ status }) => {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {active ? 'Active' : status.replace(/_/g, ' ')}
    </span>
  );
};

// ─── Connected item card ──────────────────────────────────────────────────────

const ItemCard: FC<{ item: PlaidItem }> = ({ item }) => (
  <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-5">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-semibold text-white">{item.institution_name}</p>
        <p className="mt-0.5 text-xs text-white/40">
          Connected {new Date(item.created_at).toLocaleDateString()}
        </p>
      </div>
      <StatusBadge status={item.status} />
    </div>
    <ul className="mt-4 space-y-1.5">
      {item.accounts.map((account) => (
        <li
          key={`${account.name}-${account.mask}`}
          className="flex items-center gap-2 text-sm text-white/70"
        >
          <span>{account.name}</span>
          {account.mask && <span className="text-white/40">····{account.mask}</span>}
          {account.ledger_account_code && (
            <span className="text-white/40">→ {account.ledger_account_code}</span>
          )}
        </li>
      ))}
    </ul>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────────

export const BankConnections: FC = () => {
  const { role, isLoading: orgLoading } = useOrgMe();
  const isOwner = role === 'owner';

  const { items, isLoading, error, refetch } = usePlaidItems();
  const { createLinkToken } = useLinkToken();
  const { exchange } = useExchange();

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, variant: ToastMsg['variant']) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, variant });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      const result = await exchange(buildExchangePayload(publicToken, metadata));
      localStorage.removeItem(LINK_TOKEN_KEY);
      setLinkToken(null);
      setConnecting(false);

      if (result.ok) {
        showToast(`${result.data.institution_name} connected.`, 'success');
        if (result.data.skipped.length > 0) {
          const names = result.data.skipped
            .map((s) => `${s.name} (${s.type})`)
            .join(', ');
          showToast(`Connected — but some accounts are not supported and were skipped: ${names}`, 'info');
        }
        refetch();
      } else {
        // 400 details (duplicate guard / unsupported / chart) surface as-is.
        showToast(result.error, 'error');
      }
    },
    [exchange, refetch, showToast],
  );

  const onExit = useCallback<PlaidLinkOnExit>(
    (exitError) => {
      localStorage.removeItem(LINK_TOKEN_KEY);
      setLinkToken(null);
      setConnecting(false);
      // User cancel is silent; only an exit WITH error gets a toast.
      if (exitError) {
        showToast('The bank connection was interrupted. Please try again.', 'error');
      }
    },
    [showToast],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  });

  // Open Link as soon as the freshly minted token makes it ready.
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const handleConnect = async () => {
    setConnecting(true);
    const result = await createLinkToken();
    if (result.ok) {
      // Stash BEFORE opening — the C2 OAuth redirect flow reads it back.
      localStorage.setItem(LINK_TOKEN_KEY, result.data.link_token);
      setLinkToken(result.data.link_token);
    } else {
      setConnecting(false);
      showToast(result.error, 'error');
    }
  };

  // ── Loading (org role + items) ──
  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="h-7 w-56 bg-white/8 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-white/8 rounded animate-pulse mb-8" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#0A1628] border border-white/10 p-5 mb-4">
              <div className="h-4 w-40 bg-white/8 rounded animate-pulse mb-3" />
              <div className="h-3 w-64 bg-white/8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <Toast toast={toast} />

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Bank Connections</h1>
          <p className="mt-1 text-sm text-white/50">
            Connect your bank so transactions flow into your books automatically.
          </p>
        </div>

        {/* Non-owner: the read-only-note treatment TaxProfile uses — but the
            Plaid endpoints are owner-only, so there is nothing to view. */}
        {!isOwner ? (
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/60">
            Only the account owner can manage bank connections.
          </div>
        ) : (
          <>
            {/* Load error */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3 mb-6">
                <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="flex-1 text-sm text-red-400">{error}</p>
                <button onClick={refetch} className="text-xs text-red-400 hover:text-red-300 underline">
                  Retry
                </button>
              </div>
            )}

            {/* Connected institutions */}
            {items.length > 0 ? (
              <div className="space-y-4 mb-6">
                {items.map((item) => <ItemCard key={item.id} item={item} />)}
              </div>
            ) : !error && (
              <div className="rounded-2xl bg-[#0A1628] border border-white/10 border-dashed p-10 text-center mb-6">
                <svg className="w-10 h-10 mx-auto text-white/20 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
                <p className="text-sm font-medium text-white/70">No banks connected yet</p>
                <p className="mt-1 text-xs text-white/40">
                  Connect a chequing, savings, or credit card account to start the automatic feed.
                </p>
              </div>
            )}

            {/* Connect button */}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {connecting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {connecting ? 'Opening…' : 'Connect a bank account'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
