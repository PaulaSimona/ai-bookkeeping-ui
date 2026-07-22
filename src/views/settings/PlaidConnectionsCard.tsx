// Plaid bank-connections card (s24 U2 — O-S24-3, D-S24-11). Read-only list of
// connected institutions, rendered ABOVE the Telegram card in the Bank &
// integrations tab, entitled orgs only. Reuses the shipped usePlaidItems hook —
// GET /api/accounting/plaid/items/ → {items:[{id, institution_name, status,
// created_at, accounts:[{name, mask, ledger_account_code}]}]} — byte-preserved.
//
// The "+ Connect" action: the Plaid Link flow is NOT a reusable component — it
// lives inline in BankConnections.tsx (usePlaidLink + handleConnect + reconnect/
// exchange orchestration). Rather than rebuild it here (out of scope), Connect
// navigates to that existing entry point (/accounting/bank-connections), the
// bank-feed setup surface.
import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { usePlaidItems, type PlaidItem } from '@/api/plaid/usePlaid';
import { Section, Spinner } from './ui';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', {
  year: 'numeric', month: 'short', day: 'numeric',
});

// Calm categorical status marker (not a red/green judgement): a healthy item is
// emerald, anything needing attention (login_required / error / pending) amber.
const StatusPill: FC<{ status: string }> = ({ status }) => {
  const healthy = status === 'active' || status === 'good' || status === 'connected';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${healthy ? 'text-emerald-600' : 'text-amber-600'}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const ItemRow: FC<{ item: PlaidItem }> = ({ item }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <p className="truncate text-sm font-semibold text-gray-900">{item.institution_name}</p>
        <StatusPill status={item.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.accounts.map((a, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
          >
            {a.name}
            <span className="font-[var(--font-family-mono)] text-gray-400">••{a.mask}</span>
          </span>
        ))}
      </div>
    </div>
    <p className="shrink-0 text-xs text-gray-400">Connected {fmtDate(item.created_at)}</p>
  </div>
);

export const PlaidConnectionsCard: FC = () => {
  const { items, isLoading, error } = usePlaidItems();

  return (
    <Section
      title="Bank connections"
      description="Connected bank and card accounts feeding your books automatically."
    >
      <div className="mb-4 flex justify-end">
        <Link
          to="/accounting/bank-connections"
          title="Connect from your bank feed setup"
          className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Connect
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
          <p className="text-sm text-gray-500">No bank accounts connected yet.</p>
          <p className="mt-1 text-xs text-gray-400">Connect a chequing, savings, or credit card account to start the automatic feed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => <ItemRow key={item.id} item={item} />)}
        </div>
      )}
    </Section>
  );
};
