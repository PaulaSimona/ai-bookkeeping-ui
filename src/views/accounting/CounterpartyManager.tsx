// CounterpartyManager (§14 14-C-2b, D-14C2-5 / D-14C2-18) — the merged
// aging + management surface shared by the Clients and Suppliers pages, which
// differ only in role + copy (RoleConfig). Own data hooks / page logic (Tier 2
// owner surface); presentational bits come from src/components/t2 only. No
// New-invoice button (D-14C2-18e).
import { type FC, type ReactNode, useEffect, useState } from 'react';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { StatCard } from '@/components/t2/StatCard';
import { FilterChip } from '@/components/t2/FilterChip';
import { AvatarChip } from '@/components/t2/AvatarChip';
import { TableShell, TableRow, type T2Column } from '@/components/t2/TableShell';
// CRUD action functions + the role type stay (add/archive are unchanged); the
// useCounterparties LIST hook and its CounterpartyRow type are retired here —
// the balances endpoint is now the table's sole source (14-C-4 U3).
import {
  archiveCounterparty,
  unarchiveCounterparty,
  type CounterpartyRole,
} from '@/hooks/useCounterparties';
import { ClientCreateForm } from '@/views/accounting/ClientCreateForm';
import {
  useCounterpartyBalances,
  type AgingBuckets,
  type CounterpartyBalanceRow,
} from '@/hooks/useCounterpartyBalances';

export interface RoleConfig {
  role: CounterpartyRole;
  title: string;
  subtitle: string;
  totalLabel: string;   // TOTAL RECEIVABLE / TOTAL PAYABLE
  columnLabel: string;  // CLIENT / SUPPLIER
  noun: string;         // client / supplier
  addLabel: string;     // Add client / Add supplier
  emptyActive: string;
  emptyArchived: string;    // empty state: "No archived …" + explainer
  archivedExplainer: string; // persistent banner copy (no "No archived …" prefix)
  avatarTint: 'blue' | 'green' | 'red';
}

const TERMS: { value: string; label: string }[] = [
  { value: 'due_on_receipt', label: 'Due on receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
];
const TERMS_LABEL: Record<string, string> = Object.fromEntries(
  TERMS.map((t) => [t.value, t.label]),
);

const num = (s: string) => {
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
};

const fmtMoney = (s: string) => {
  const n = Number(s);
  if (Number.isNaN(n)) return `$${s}`;
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

const inputCls =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

const PageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
  </div>
);

// Segmented aging bar (D-14C2-18d): 120×6px rounded track, four proportional
// segments; zero/negative total → empty track.
const AgingBar: FC<{ aging: AgingBuckets }> = ({ aging }) => {
  const vals = [
    Math.max(0, num(aging.current)),
    Math.max(0, num(aging.d31_60)),
    Math.max(0, num(aging.d61_90)),
    Math.max(0, num(aging.d90_plus)),
  ];
  const total = vals.reduce((a, b) => a + b, 0);
  const colors = ['bg-emerald-500', 'bg-blue-400', 'bg-amber-500', 'bg-red-500'];
  return (
    <div className="h-1.5 w-[120px] rounded-full bg-gray-100 overflow-hidden flex">
      {total > 0 &&
        vals.map((v, i) =>
          v > 0 ? (
            <div key={i} className={colors[i]} style={{ width: `${(v / total) * 100}%` }} />
          ) : null,
        )}
    </div>
  );
};

export const CounterpartyManager: FC<{ config: RoleConfig }> = ({ config }) => {
  const [archivedTab, setArchivedTab] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Two balances queries (active + archived) so both filter chips show a live,
  // C4-semantic count (all role-enabled counterparties, incl. zero-activity);
  // the selected tab drives the table. Both carry the (debounced) search and
  // paginate independently. This is now the SOLE source — rows carry identity +
  // balance + aging together, so the CRUD-list + balMap id-join is retired.
  const activeBalances = useCounterpartyBalances({ role: config.role, archived: false, search });
  const archivedBalances = useCounterpartyBalances({ role: config.role, archived: true, search });

  const current = archivedTab ? archivedBalances : activeBalances;
  const { items, count, page, setPage, pageSize, isLoading, error } = current;

  const refetchAll = () => {
    activeBalances.refetch();
    archivedBalances.refetch();
  };

  // Debounce search; reset both lists to page 1 when it settles.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      activeBalances.setPage(1);
      archivedBalances.setPage(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const selectTab = (archived: boolean) => {
    setArchivedTab(archived);
    (archived ? archivedBalances : activeBalances).setPage(1);
  };

  const doArchive = async (id: string) => { await archiveCounterparty(id); refetchAll(); };
  const doUnarchive = async (id: string) => { await unarchiveCounterparty(id); refetchAll(); };

  const columns: T2Column[] = [
    { label: config.columnLabel, fr: 2.2 },
    { label: 'Contact', fr: 2 },
    { label: 'Terms', fr: 1 },
    { label: 'Balance', align: 'right', fr: 1.2 },
    { label: 'Aging', fr: 1.4 },
    { label: 'Action', align: 'right', fr: 1 },
  ];

  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  const showPager = count > pageSize;

  // Full-set, filter-independent summary (identical on both queries per C4).
  const s = current.summary;

  return (
    <PageShell>
      <PageHeader title={config.title} subtitle={config.subtitle} />

      {/* Stat row (D-14C2-18a) */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label={config.totalLabel} value={fmtMoney(s.balance)} />
        <StatCard label="Current (0–30)" value={fmtMoney(s.aging.current)} tone="success" />
        <StatCard label="31–60 days" value={fmtMoney(s.aging.d31_60)} />
        <StatCard label="61–90 days" value={fmtMoney(s.aging.d61_90)} tone="warning" />
        <StatCard label="90+ days" value={fmtMoney(s.aging.d90_plus)} tone="danger" />
      </div>

      {/* Management card */}
      <div className="mt-6">
        <Card>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
            <FilterChip active={!archivedTab} onClick={() => selectTab(false)}>
              Active · {activeBalances.count}
            </FilterChip>
            <FilterChip active={archivedTab} onClick={() => selectTab(true)}>
              Archived · {archivedBalances.count}
            </FilterChip>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={`Search ${config.noun}s…`}
              className={`${inputCls} ml-auto w-56`}
            />
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              {config.addLabel}
            </button>
          </div>

          {showForm && (
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/60">
              <ClientCreateForm
                role={config.role}
                noun={config.noun}
                onCreated={() => { setShowForm(false); refetchAll(); }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {/* Persistent archived-tab explainer (F-S22-1; D-S22-1 amended): its
              own config copy — NOT the empty state, whose "No archived …" prefix
              reads wrong above rows. Shows whenever the Archived tab is active —
              with rows or without. */}
          {archivedTab && (
            <div className="flex items-start gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-[12.5px] text-gray-600">
              <svg
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={1.6} stroke="currentColor"
                className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span>{config.archivedExplainer}</span>
            </div>
          )}

          {error ? (
            <div className="px-4 py-6 text-sm text-red-600">{error}</div>
          ) : (
            <TableShell
              columns={columns}
              isEmpty={!isLoading && items.length === 0}
              empty={archivedTab ? config.emptyArchived : config.emptyActive}
            >
              {isLoading && items.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13.5px] text-gray-400">Loading…</div>
              ) : (
                items.map((row: CounterpartyBalanceRow) => (
                  <TableRow
                    key={row.id}
                    columns={columns}
                    cells={[
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarChip initials={initials(row.name)} tint={config.avatarTint} />
                        <div className="min-w-0">
                          <div className={`truncate font-medium ${row.archived ? 'text-gray-400' : 'text-gray-900'}`}>{row.name}</div>
                          {row.city && <div className="truncate text-[12px] text-gray-400">{row.city}</div>}
                        </div>
                      </div>,
                      <div className="min-w-0">
                        <div className="truncate text-gray-700">{row.contact_name || '—'}</div>
                        {row.email && <div className="truncate text-[12px] text-gray-400">{row.email}</div>}
                      </div>,
                      <span className="text-gray-600">{TERMS_LABEL[row.payment_terms] ?? '—'}</span>,
                      <span className="font-[var(--font-family-mono)] text-gray-900">{fmtMoney(row.balance)}</span>,
                      <AgingBar aging={row.aging} />,
                      row.archived ? (
                        <button type="button" onClick={() => doUnarchive(row.id)} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">Unarchive</button>
                      ) : (
                        <button type="button" onClick={() => doArchive(row.id)} className="text-[13px] font-medium text-gray-500 hover:text-gray-800 hover:underline">Archive</button>
                      ),
                    ]}
                  />
                ))
              )}
            </TableShell>
          )}

          {showPager && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{from}–{to} of {count}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">Previous</button>
                <button type="button" onClick={() => setPage(page + 1)} disabled={page * pageSize >= count} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">Next</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
};
