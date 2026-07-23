// Accountant Ledger (/accountant/ledger, Session-25 Phase E, U2). The posted,
// already-clean book the accountant reviews and adjusts. Read-only rows + an
// "Adjust" shortcut on revenue/expense entries; NO edit affordance anywhere
// (posted entries are immutable — corrections post as new adjusting entries).
// Own data layer (useAccountantLedger / useAccountantChart); t2 primitives +
// design tokens only, no hex literals.
import { type FC, type ReactNode, Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrgContext } from '@/context/OrgContext';
import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { StatusBadge } from '@/components/t2/StatusBadge';
import {
  useAccountantLedger,
  type AccountantLedgerRow,
} from './hooks/useAccountantLedger';
import { useAccountantChart } from './hooks/useAccountantChart';
import { EntryDrawer } from './EntryDrawer';

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const fmtMoney = (v: string | null): string => (v == null || v === '' ? '' : CAD.format(Number(v)));
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

const MONO = 'font-[var(--font-family-mono)] tabular-nums';
const GRID = 'grid grid-cols-[1fr_0.8fr_2.6fr_1fr_0.9fr_1.1fr] items-center gap-4';

// Humanize the raw source enum for display — a calm neutral badge; the raw value
// never leaks beyond this transform.
const humanizeSource = (s: string): string => {
  const t = s.replace(/_/g, ' ').trim();
  return t.length === 0 ? '—' : t.charAt(0).toUpperCase() + t.slice(1);
};

const PageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
  </div>
);

const NewAdjustmentButton: FC = () => (
  <Link
    to="/accountant/adjustments/new"
    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
    New adjustment
  </Link>
);

const LOCK_LINE =
  'Posted entries are immutable. Corrections post as new adjusting entries — nothing is ever edited or deleted.';

const Skeleton: FC = () => (
  <Card>
    <div className="divide-y divide-gray-50">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`${GRID} px-5 py-3.5`}>
          <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-3.5 w-14 animate-pulse rounded bg-gray-100" />
          <div className="h-3.5 w-48 animate-pulse rounded bg-gray-100" />
          <div className="h-3.5 w-16 animate-pulse rounded bg-gray-100 justify-self-end" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
          <div className="h-3.5 w-12 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  </Card>
);

const LedgerInner: FC = () => {
  const { activeOrg } = useOrgContext();
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useAccountantLedger();
  const { revenueExpenseIds } = useAccountantChart();

  const clientName = activeOrg?.org_name ?? 'This client';
  const showPager = count > pageSize;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  const isRevenueExpense = (row: AccountantLedgerRow): boolean =>
    row.lines.some((l) => revenueExpenseIds.has(l.account_id));

  // Drill-down drawer: one open at a time (expandedId), with an optional
  // already-expanded adjust form (adjustOpen). Clicking a row toggles details;
  // the row's "Adjust" action opens the drawer WITH the form expanded.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const toggleRow = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setAdjustOpen(false);
    } else {
      setExpandedId(id);
      setAdjustOpen(false);
    }
  };
  const openAdjust = (id: string) => {
    setExpandedId(id);
    setAdjustOpen(true);
  };
  // After a successful in-context post: collapse the drawer and refresh the list
  // so the new adjusting entry appears.
  const onPosted = () => {
    setExpandedId(null);
    setAdjustOpen(false);
    refetch();
  };

  return (
    <PageShell>
      <PageHeader
        title="Ledger"
        subtitle={`${clientName} · already posted & clean. Post adjustments where needed.`}
        right={<NewAdjustmentButton />}
      />

      <div className="mt-6">
        {isLoading ? (
          <Skeleton />
        ) : error ? (
          <Card padding className="max-w-md">
            <p className="text-sm text-gray-700">{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Try again
            </button>
          </Card>
        ) : count === 0 ? (
          <Card padding className="text-center">
            <p className="text-sm text-gray-500">No posted entries yet.</p>
          </Card>
        ) : (
          <Card>
            {/* Header row */}
            <div className={`${GRID} border-b border-gray-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500`}>
              <span>Date</span>
              <span>Entry</span>
              <span>Description</span>
              <span className="justify-self-end">Amount</span>
              <span>Source</span>
              <span className="justify-self-end">Action</span>
            </div>

            <div className="divide-y divide-gray-50">
              {items.map((row) => (
                <Fragment key={row.id}>
                  <div
                    onClick={() => toggleRow(row.id)}
                    className={`${GRID} cursor-pointer px-5 py-3.5 transition-colors hover:bg-gray-50 ${
                      expandedId === row.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <span className="whitespace-nowrap text-[13.5px] text-gray-700">{fmtDate(row.entry_date)}</span>
                    <span className={`whitespace-nowrap text-[12.5px] text-gray-500 ${MONO}`}>
                      {row.entry_number_display ?? ''}
                    </span>
                    <span className="truncate text-[13.5px] text-gray-900" title={row.description}>
                      {row.description}
                    </span>
                    <span className={`justify-self-end whitespace-nowrap text-[13.5px] text-gray-900 ${MONO}`}>
                      {fmtMoney(row.total_debits)}
                    </span>
                    <span>
                      <StatusBadge variant="neutral">{humanizeSource(row.source)}</StatusBadge>
                    </span>
                    <span className="justify-self-end">
                      {isRevenueExpense(row) ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openAdjust(row.id); }}
                          className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          Adjust
                        </button>
                      ) : (
                        <span className="text-[13px] text-gray-300">—</span>
                      )}
                    </span>
                  </div>
                  {expandedId === row.id && (
                    <EntryDrawer
                      row={row}
                      adjustOpen={adjustOpen}
                      onToggleAdjust={() => setAdjustOpen((v) => !v)}
                      onPosted={onPosted}
                    />
                  )}
                </Fragment>
              ))}
            </div>

            {showPager && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                <span className="text-xs text-gray-500">{from}–{to} of {count}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page * pageSize >= count}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Immutability lock line (verbatim). */}
        <p className="mt-4 text-[12.5px] text-gray-400">{LOCK_LINE}</p>
      </div>
    </PageShell>
  );
};

// Keyed on the active org so switching client fully remounts the data-bearing
// subtree (fresh fetch under the new X-Org-Id). A multi-client accountant who
// has not chosen a client yet is prompted to pick one from the sidebar.
export const AccountantLedger: FC = () => {
  const { activeOrgId, needsSelection } = useOrgContext();
  if (needsSelection) {
    return (
      <PageShell>
        <PageHeader title="Ledger" subtitle="Choose a client from the sidebar to view their ledger." />
      </PageShell>
    );
  }
  return <LedgerInner key={activeOrgId ?? 'none'} />;
};
