// Stripe Connect card (Chain C / C4 UI — O-S68-16 / O-S68-17). Rendered in the
// Bank & integrations tab directly under the Plaid card, entitled orgs only.
// PlaidConnectionsCard shape: Section + Spinner + calm status pill; the
// disconnect confirm is the shared ConfirmModal/DialogButtons (O-S68-18).
//
// Data: useStripeConnect hooks only (shared api client — Bearer + X-Org-Id are
// added there; no headers, no localStorage, no direct axios here). Connect is a
// POST that returns {url}; the browser is sent there with window.location.assign
// and busy stays true so the button cannot re-fire. Stripe returns the browser
// to STRIPE_CONNECT_RETURN_URL (/settings?tab=integrations) with connected=1 or
// connected=0&error=<code>; this card is the SOLE reader of those two params,
// toasts once, and strips them (tab= preserved) — the ref guards React
// strict-mode's double effect invoke.
import { type FC, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  stripeConnectErrorCopy,
  STRIPE_CONNECT_ERROR_COPY,
  useStripeConnectAccount,
  useStripeConnectAuthorize,
  useStripeConnectDisconnect,
  type ConnectedStripeAccount,
} from '@/api/stripe/useStripeConnect';
import { ConfirmModal, DialogButtons, Section, Spinner, ToastBanner, useToast } from './ui';

// Same formatting as PlaidConnectionsCard.fmtDate (module-local there).
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', {
  year: 'numeric', month: 'short', day: 'numeric',
});

// Calm categorical marker — Live emerald, Test amber (not a red/green judgement).
const ModePill: FC<{ livemode: boolean }> = ({ livemode }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${livemode ? 'text-emerald-600' : 'text-amber-600'}`}>
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${livemode ? 'bg-emerald-500' : 'bg-amber-500'}`} />
    {livemode ? 'Live' : 'Test'}
  </span>
);

const NOT_CONFIGURED_COPY = STRIPE_CONNECT_ERROR_COPY.config;
const CONNECT_COPY = 'Connect your Stripe account to post payouts, fees and sales automatically.';

const ConnectButton: FC<{ busy: boolean; onClick: () => void }> = ({ busy, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
  >
    {busy && <Spinner light />}
    {busy ? 'Redirecting…' : 'Connect Stripe'}
  </button>
);

const AccountRow: FC<{ account: ConnectedStripeAccount; children?: React.ReactNode }> = ({ account, children }) => {
  const connected = account.status === 'connected';
  const when = connected ? account.connected_at : account.disconnected_at;
  const label = connected
    ? 'Connected'
    : account.status === 'deauthorized' ? 'Access revoked' : 'Disconnected';
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <p className="truncate text-sm font-semibold text-gray-900">
            {account.display_name || account.stripe_account_id}
          </p>
          {connected && <ModePill livemode={account.livemode} />}
        </div>
        <p className="mt-1 font-[var(--font-family-mono)] text-xs text-gray-400">{account.stripe_account_id}</p>
        <p className="mt-2 text-xs text-gray-400">
          {label}{when ? ` ${fmtDate(when)}` : ''}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
};

export const StripeConnectCard: FC = () => {
  const { summary, isLoading, error, refetch } = useStripeConnectAccount();
  const { authorize, busy: authorizing } = useStripeConnectAuthorize();
  const { disconnect, busy: disconnecting } = useStripeConnectDisconnect();
  const { toast, showSuccess, showError } = useToast();
  const [notConfigured, setNotConfigured] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // O-S68-17 — return-URL outcome, read once, then stripped (tab= preserved).
  const [params, setParams] = useSearchParams();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const c = params.get('connected');
    const e = params.get('error');
    if (c === '1') {
      showSuccess('Stripe connected');
      refetch();
    } else if (e) {
      showError(stripeConnectErrorCopy(e));
    }
    if (c !== null || e !== null) {
      const next = new URLSearchParams(params);
      next.delete('connected');
      next.delete('error');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConnect = async () => {
    const r = await authorize();
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    if (r.status === 409) {
      refetch();
      return;
    }
    if (r.status === 503) {
      setNotConfigured(true);
      return;
    }
    showError(r.message);
  };

  const onConfirmDisconnect = async () => {
    const r = await disconnect();
    setConfirmOpen(false);
    if (r.ok) {
      refetch();
      showSuccess('Stripe disconnected');
      return;
    }
    if (r.status === 502) {
      showError('Stripe is unavailable right now — nothing was changed.');
      return;
    }
    showError(r.message);
  };

  const configured = summary?.configured && !notConfigured;
  const account = summary?.account ?? null;

  return (
    <Section
      title="Stripe"
      description="Payments received through your Stripe account, posted to your books automatically."
    >
      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : !configured ? (
        <p className="text-sm text-gray-500">{NOT_CONFIGURED_COPY}</p>
      ) : summary?.connected && account ? (
        <AccountRow account={account}>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={disconnecting}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Disconnect
          </button>
        </AccountRow>
      ) : account ? (
        <AccountRow account={account}>
          <ConnectButton busy={authorizing} onClick={onConnect} />
        </AccountRow>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-dashed border-gray-200 px-6 py-8 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-sm text-gray-500">{CONNECT_COPY}</p>
          <div className="shrink-0"><ConnectButton busy={authorizing} onClick={onConnect} /></div>
        </div>
      )}

      {confirmOpen && (
        <ConfirmModal title="Disconnect Stripe?" onClose={() => !disconnecting && setConfirmOpen(false)}>
          <p className="text-sm text-gray-600">
            New Stripe payments will stop posting to your books. Existing entries are not changed. You can reconnect at any time.
          </p>
          <DialogButtons
            busy={disconnecting}
            confirmLabel="Disconnect"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={onConfirmDisconnect}
          />
        </ConfirmModal>
      )}

      <ToastBanner toast={toast} />
    </Section>
  );
};
