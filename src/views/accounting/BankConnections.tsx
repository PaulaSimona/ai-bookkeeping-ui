// Bank Transactions (P2-C1 connections + O-S57-3 transactions surface). Plaid
// Link flow + connected-institutions list + imported-transactions table with
// filters, window balance, PDF export, per-transaction JE effects, and a
// per-connection Disconnect. The route path stays /accounting/bank-connections.
// Owner-gating is enforced in-page via useOrgMe() AND server-side.
//
// NOTE on components: the shared Badge/Button/Toast in components/ are dead
// react-bootstrap legacy (react-bootstrap is NOT installed) — importing them
// here would break the vite build. This page follows the live Tier 2 convention
// (TaxProfile/InvoiceActions): inline Tailwind and a local top-right toast; the
// Disconnect confirm mirrors the InvoiceActions Modal + DialogButtons pattern.
//
// R6: only the public status vocabulary (Imported/Matched/Posted/Excluded) is
// ever rendered — never a reviewer-internal word.
import { type FC, type ReactNode, Fragment, useCallback, useEffect, useRef, useState } from 'react';
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
  useReconnectLinkToken,
  useReconnectComplete,
  PLAID_LINK_TOKEN_KEY as LINK_TOKEN_KEY,
  PLAID_LINK_MODE_KEY,
  PLAID_RECONNECT_ITEM_KEY,
  type PlaidItem,
} from '@/api/plaid/usePlaid';
import {
  useBankTransactions,
  useBankBalance,
  useBankTransactionDetail,
  useDisconnectItem,
  useExportPdf,
  PUBLIC_STATUSES,
  type TransactionFilters,
  type PublicStatus,
  type BankTransactionDetail,
} from '@/api/plaid/useBankTransactions';
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

// ─── Connection status badge (Plaid item status — connections list only) ──────

const StatusBadge: FC<{ status: string }> = ({ status }) => {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {active ? 'Active' : status.replace(/_/g, ' ')}
    </span>
  );
};

// ─── Public transaction-status badge (O-S57-2 vocabulary — R6) ────────────────

const PUBLIC_STATUS_STYLES: Record<PublicStatus, string> = {
  Imported: 'bg-gray-50 text-gray-600 border-gray-200',
  Matched: 'bg-blue-50 text-blue-700 border-blue-200',
  Posted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Excluded: 'bg-amber-50 text-amber-700 border-amber-200',
};

const PublicStatusBadge: FC<{ status: PublicStatus; pending: boolean }> = ({ status, pending }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PUBLIC_STATUS_STYLES[status]}`}>
    {status}
    {pending && status === 'Imported' ? <span className="ml-1 text-gray-400">(pending)</span> : null}
  </span>
);

// ─── Confirm modal (InvoiceActions Modal + DialogButtons pattern) ─────────────

const ConfirmModal: FC<{ title: string; onClose: () => void; children: ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      {children}
    </div>
  </div>
);

const DialogButtons: FC<{ busy: boolean; confirmLabel: string; onCancel: () => void; onConfirm: () => void }> = ({ busy, confirmLabel, onCancel, onConfirm }) => (
  <div className="mt-5 flex justify-end gap-2">
    <button
      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      onClick={onCancel}
      disabled={busy}
    >
      Cancel
    </button>
    <button
      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      onClick={onConfirm}
      disabled={busy}
    >
      {busy ? 'Working…' : confirmLabel}
    </button>
  </div>
);

// ─── Connected item card ──────────────────────────────────────────────────────

// Reconnect is only offered for a dead-but-repairable login — mirrors the
// backend RC-1a gate (active is a no-op, revoked is unrepairable).
const RECONNECTABLE_STATUSES = new Set(['login_required', 'pending_expiration']);

const ItemCard: FC<{
  item: PlaidItem;
  onReconnect?: (item: PlaidItem) => void;
  onDisconnect?: (item: PlaidItem) => void;
}> = ({ item, onReconnect, onDisconnect }) => {
  const disconnected = item.status === 'revoked';
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-900">{item.institution_name}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Connected {new Date(item.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {disconnected ? (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500">
              Disconnected — history retained
            </span>
          ) : (
            <>
              <StatusBadge status={item.status} />
              {onReconnect && RECONNECTABLE_STATUSES.has(item.status) && (
                <button
                  onClick={() => onReconnect(item)}
                  className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 px-3 py-1 text-xs font-semibold transition-colors"
                >
                  Reconnect
                </button>
              )}
              {onDisconnect && (
                <button
                  onClick={() => onDisconnect(item)}
                  className="rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1 text-xs font-semibold transition-colors"
                >
                  Disconnect
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {item.accounts.map((account) => (
          <li
            key={`${account.name}-${account.mask}`}
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <span>{account.name}</span>
            {account.mask && <span className="text-gray-400">····{account.mask}</span>}
            {account.ledger_account_code && (
              <span className="text-gray-400">→ {account.ledger_account_code}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Transaction detail (JE effects — public terms only) ──────────────────────

const inputCls = 'rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-[#0066FF] focus:outline-none';

const DetailPanel: FC<{ loading: boolean; detail: BankTransactionDetail | null }> = ({ loading, detail }) => {
  if (loading) {
    return <div className="px-4 py-3 text-xs text-gray-400">Loading details…</div>;
  }
  if (!detail) return null;
  if (detail.journal_entries.length === 0) {
    return <div className="px-4 py-3 text-xs text-gray-400">No posted entries for this transaction yet.</div>;
  }
  return (
    <div className="space-y-3 px-4 py-3">
      {detail.journal_entries.map((je, i) => (
        <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-700">
            {je.entry_number != null ? `Entry #${je.entry_number}` : 'Entry'} · {je.entry_date}
          </p>
          {je.description && <p className="mt-0.5 text-xs text-gray-500">{je.description}</p>}
          <table className="mt-2 w-full text-xs">
            <tbody>
              {je.lines.map((ln, j) => (
                <tr key={j} className="text-gray-600">
                  <td className="py-0.5 pr-3">{ln.account_code} {ln.account_name}</td>
                  <td className="py-0.5 pr-3 text-right">{ln.debit ? `Dr ${ln.debit}` : ''}</td>
                  <td className="py-0.5 text-right">{ln.credit ? `Cr ${ln.credit}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const BankConnections: FC = () => {
  const { role, isLoading: orgLoading } = useOrgMe();
  const isOwner = role === 'owner';

  const { items, isLoading, error, refetch } = usePlaidItems();
  const { createLinkToken } = useLinkToken();
  const { exchange } = useExchange();
  const { createReconnectLinkToken } = useReconnectLinkToken();
  const { completeReconnect } = useReconnectComplete();
  const { disconnect } = useDisconnectItem();

  // C3: one Link session at a time; mode decides what onSuccess posts.
  const [linkSession, setLinkSession] = useState<{
    token: string;
    mode: 'connect' | 'reconnect';
    itemId?: string;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Transactions surface (O-S57-3) ──
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [page, setPage] = useState(1);
  const { data: txnData, isLoading: txnLoading, error: txnError, refetch: refetchTxns } =
    useBankTransactions(filters, page);
  const { balance } = useBankBalance(filters);
  const { loadDetail } = useBankTransactionDetail();
  const { exportPdf } = useExportPdf();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BankTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accountOptions, setAccountOptions] = useState<Record<string, string>>({});

  // ── Disconnect ──
  const [disconnectTarget, setDisconnectTarget] = useState<PlaidItem | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const clearStash = () => {
    localStorage.removeItem(LINK_TOKEN_KEY);
    localStorage.removeItem(PLAID_LINK_MODE_KEY);
    localStorage.removeItem(PLAID_RECONNECT_ITEM_KEY);
  };

  const showToast = useCallback((message: string, variant: ToastMsg['variant']) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, variant });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Account filter options accumulate from the rows themselves (the only source
  // carrying the bank_account UUID); once seen an option is never dropped, so a
  // filtered view never loses the other accounts from the dropdown.
  useEffect(() => {
    if (!txnData) return;
    setAccountOptions((prev) => {
      const next = { ...prev };
      for (const r of txnData.results) {
        if (r.bank_account_id && !next[r.bank_account_id]) {
          next[r.bank_account_id] = r.bank_account_mask
            ? `${r.bank_account_name ?? 'Account'} ····${r.bank_account_mask}`
            : (r.bank_account_name ?? r.bank_account_id);
        }
      }
      return next;
    });
  }, [txnData]);

  const updateFilter = (patch: Partial<TransactionFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setExpandedId(null);
  };

  const onRowClick = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    const res = await loadDetail(id);
    setDetailLoading(false);
    if (res.ok) setDetail(res.data);
    else showToast(res.error, 'error');
  };

  const handleExport = async () => {
    setExporting(true);
    const res = await exportPdf(filters);
    setExporting(false);
    if (!res.ok) {
      showToast(res.error, 'error');
      return;
    }
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank-transactions.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    const res = await disconnect(disconnectTarget.id);
    setDisconnecting(false);
    setDisconnectTarget(null);
    if (res.ok) {
      showToast(`${res.data.institution_name} disconnected — history retained.`, 'success');
      refetch();
      refetchTxns();
    } else {
      showToast(res.error, 'error');
    }
  };

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      // Reconnect mode: update-mode Link re-authed the EXISTING Item —
      // post reconnect/complete (never exchange, which would trip the
      // duplicate-Item guard).
      if (linkSession?.mode === 'reconnect' && linkSession.itemId) {
        const result = await completeReconnect(linkSession.itemId);
        clearStash();
        setLinkSession(null);
        setConnecting(false);
        if (result.ok) {
          showToast(`${result.data.institution_name} reconnected.`, 'success');
          refetch();
        } else {
          // 409/detail passes through the existing error path as-is.
          showToast(result.error, 'error');
        }
        return;
      }

      const result = await exchange(buildExchangePayload(publicToken, metadata));
      clearStash();
      setLinkSession(null);
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
    [linkSession, completeReconnect, exchange, refetch, showToast],
  );

  const onExit = useCallback<PlaidLinkOnExit>(
    (exitError) => {
      clearStash();
      setLinkSession(null);
      setConnecting(false);
      // User cancel is silent; only an exit WITH error gets a toast.
      if (exitError) {
        showToast('The bank connection was interrupted. Please try again.', 'error');
      }
    },
    [showToast],
  );

  const { open, ready } = usePlaidLink({
    token: linkSession?.token ?? null,
    onSuccess,
    onExit,
  });

  // Open Link as soon as the freshly minted token makes it ready.
  useEffect(() => {
    if (linkSession && ready) open();
  }, [linkSession, ready, open]);

  const handleConnect = async () => {
    setConnecting(true);
    const result = await createLinkToken();
    if (result.ok) {
      // Clear FIRST: an abandoned reconnect session (browser closed — onExit
      // never fires) must not leave stale mode/item keys under a new connect
      // session, or the OAuth callback would post reconnect/complete against
      // the wrong Item.
      clearStash();
      // Stash BEFORE opening — the C2 OAuth redirect flow reads it back.
      // Connect mode stashes ONLY the token key, exactly as before C3.
      localStorage.setItem(LINK_TOKEN_KEY, result.data.link_token);
      setLinkSession({ token: result.data.link_token, mode: 'connect' });
    } else {
      setConnecting(false);
      showToast(result.error, 'error');
    }
  };

  const handleReconnect = async (item: PlaidItem) => {
    setConnecting(true);
    const result = await createReconnectLinkToken(item.id);
    if (result.ok) {
      // Stash all three keys BEFORE opening — the OAuth callback needs
      // mode + item id to post reconnect/complete instead of exchange.
      localStorage.setItem(LINK_TOKEN_KEY, result.data.link_token);
      localStorage.setItem(PLAID_LINK_MODE_KEY, 'reconnect');
      localStorage.setItem(PLAID_RECONNECT_ITEM_KEY, item.id);
      setLinkSession({
        token: result.data.link_token, mode: 'reconnect', itemId: item.id,
      });
    } else {
      setConnecting(false);
      // 409 (active/revoked) and other details pass through as-is.
      showToast(result.error, 'error');
    }
  };

  // ── Loading (org role + items) ──
  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="h-7 w-56 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-gray-200 rounded animate-pulse mb-8" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 mb-4">
              <div className="h-4 w-40 bg-gray-100 rounded animate-pulse mb-3" />
              <div className="h-3 w-64 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rows = txnData?.results ?? [];
  const accountEntries = Object.entries(accountOptions);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Toast toast={toast} />

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bank Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect your bank so transactions flow into your books automatically.
          </p>
        </div>

        {/* Non-owner: the read-only-note treatment TaxProfile uses — but the
            Plaid endpoints are owner-only, so there is nothing to view. */}
        {!isOwner ? (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
            Only the account owner can manage bank connections.
          </div>
        ) : (
          <>
            {/* Load error */}
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

            {/* Connected institutions */}
            {items.length > 0 ? (
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onReconnect={handleReconnect}
                    onDisconnect={setDisconnectTarget}
                  />
                ))}
              </div>
            ) : !error && (
              <div className="rounded-2xl bg-white border border-gray-200 border-dashed p-10 text-center mb-6">
                <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
                <p className="text-sm font-medium text-gray-700">No banks connected yet</p>
                <p className="mt-1 text-xs text-gray-400">
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

            {/* ── Imported transactions ── */}
            <div className="mt-10">
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-900">Imported transactions</h2>
                <button
                  onClick={handleExport}
                  disabled={exporting || rows.length === 0}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {exporting ? 'Exporting…' : 'Export PDF'}
                </button>
              </div>

              {/* Filter bar */}
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">Account</span>
                  <select
                    className={inputCls}
                    value={filters.bank_account ?? ''}
                    onChange={(e) => updateFilter({ bank_account: e.target.value || undefined })}
                  >
                    <option value="">All accounts</option>
                    {accountEntries.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">From</span>
                  <input
                    type="date"
                    className={inputCls}
                    value={filters.date_from ?? ''}
                    onChange={(e) => updateFilter({ date_from: e.target.value || undefined })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">To</span>
                  <input
                    type="date"
                    className={inputCls}
                    value={filters.date_to ?? ''}
                    onChange={(e) => updateFilter({ date_to: e.target.value || undefined })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">Status</span>
                  <select
                    className={inputCls}
                    value={filters.status ?? ''}
                    onChange={(e) => updateFilter({ status: (e.target.value || undefined) as PublicStatus | undefined })}
                  >
                    <option value="">All statuses</option>
                    {PUBLIC_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Balance */}
              {balance && (
                <div className="mb-4 flex flex-wrap gap-6 rounded-xl border border-gray-100 bg-white px-5 py-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Opening balance (imported activity)</p>
                    <p className="font-semibold text-gray-900">{balance.opening_balance}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Closing balance</p>
                    <p className="font-semibold text-gray-900">{balance.closing_balance}</p>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Account</th>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txnLoading ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">Loading transactions…</td></tr>
                    ) : txnError ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-red-600">{txnError}</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">No transactions for this filter.</td></tr>
                    ) : (
                      rows.map((r) => {
                        const negative = r.signed_amount.startsWith('-');
                        return (
                          <Fragment key={r.id}>
                            <tr
                              onClick={() => onRowClick(r.id)}
                              className="cursor-pointer border-b border-gray-50 hover:bg-gray-50"
                            >
                              <td className="px-4 py-2.5 text-gray-700">{r.date}</td>
                              <td className="px-4 py-2.5 text-gray-500">
                                {r.bank_account_name}
                                {r.bank_account_mask && <span className="text-gray-400"> ····{r.bank_account_mask}</span>}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700">
                                {r.description || r.counterparty_name || '—'}
                                {r.description && r.counterparty_name && (
                                  <span className="block text-xs text-gray-400">{r.counterparty_name}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <PublicStatusBadge status={r.public_status} pending={r.pending} />
                              </td>
                              <td className={`px-4 py-2.5 text-right font-medium ${negative ? 'text-red-600' : 'text-emerald-700'}`}>
                                {r.signed_amount}
                              </td>
                            </tr>
                            {expandedId === r.id && (
                              <tr className="border-b border-gray-50 bg-gray-50/50">
                                <td colSpan={5}>
                                  <DetailPanel loading={detailLoading} detail={detail} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {txnData && (txnData.next || txnData.previous) && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-xs text-gray-400">{txnData.count} transaction(s)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setPage((p) => Math.max(1, p - 1)); setExpandedId(null); }}
                      disabled={!txnData.previous}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => { setPage((p) => p + 1); setExpandedId(null); }}
                      disabled={!txnData.next}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Disconnect confirm */}
      {disconnectTarget && (
        <ConfirmModal title="Disconnect bank connection" onClose={() => setDisconnectTarget(null)}>
          <p className="text-sm text-gray-600">
            Disconnecting <span className="font-semibold text-gray-900">{disconnectTarget.institution_name}</span> stops
            the automatic feed and removes this connection at your bank. All imported transactions and their history are
            kept. This can’t be undone — you’d reconnect to resume the feed.
          </p>
          <DialogButtons
            busy={disconnecting}
            confirmLabel="Disconnect"
            onCancel={() => setDisconnectTarget(null)}
            onConfirm={handleConfirmDisconnect}
          />
        </ConfirmModal>
      )}
    </div>
  );
};
