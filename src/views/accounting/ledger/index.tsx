import { FC, Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  useLedgerEntries,
  attributeEntry,
  LEDGER_TABS,
  LedgerTab,
  LedgerEntryRow,
  LedgerEntryLine,
} from '@/hooks/useLedgerEntries';
import { useCounterparties } from '@/hooks/useCounterparties';
import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { FilterChip } from '@/components/t2/FilterChip';

// §14 14-C Tier 2 Ledger register (D-14C-3..5), restyled onto the t2/ language
// (s22 B3). Read-only: tab strip + filters over the org's journal entries, calm
// status badges, and a read-only line drill-down on row expand. NO row actions
// (edit/reverse live on the accountant/staff surfaces). Own data layer — nothing
// imported from the Tier 1 / react-bootstrap component set.

// Display-only money formatting: the backend two-decimal STRINGS are the source
// of truth; Number() only hands a numeric to Intl. Never arithmetic in JS.
const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const fmtMoney = (v: string | null): string => (v == null || v === '' ? '' : CAD.format(Number(v)));

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

const MONO = 'font-[var(--font-family-mono)]';

const inputCls =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'replaced', label: 'Replaced' },
];

const PageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
  </div>
);

// Status badge (D-14C-3): needs_review wins, then the entry status. Unknown
// status falls back to the calm "Draft" styling. Raw status text never leaks
// beyond this map. Local pill — t2/StatusBadge is edit-forbidden.
const badgeFor = (row: LedgerEntryRow): { label: string; cls: string } => {
  if (row.needs_review) {
    return { label: 'Needs review', cls: 'bg-amber-50 text-amber-700' };
  }
  switch (row.status) {
    case 'draft':
      return { label: 'Draft', cls: 'bg-gray-100 text-gray-600' };
    case 'posted':
      return { label: 'Posted', cls: 'bg-emerald-50 text-emerald-700' };
    case 'reversed':
      return { label: 'Reversed', cls: 'bg-blue-50 text-blue-700' };
    case 'replaced':
      return { label: 'Replaced', cls: 'bg-gray-100 text-gray-600' };
    default:
      return { label: 'Draft', cls: 'bg-gray-100 text-gray-600' };
  }
};

const StatusBadge: FC<{ row: LedgerEntryRow }> = ({ row }) => {
  const { label, cls } = badgeFor(row);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
};

const Chevron: FC<{ open: boolean }> = ({ open }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={2} stroke="currentColor"
    className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// Nested debit/credit sub-table (ACCT · ACCOUNT · DEBIT · CREDIT header band,
// mono figures). Presentational; ordering by line_order preserved.
const LineDetail: FC<{ lines: LedgerEntryLine[] }> = ({ lines }) => {
  const ordered = [...lines].sort((a, b) => a.line_order - b.line_order);
  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <th className="py-1 pr-3 text-left">Acct</th>
            <th className="py-1 pr-3 text-left">Account</th>
            <th className="py-1 pl-3 text-right">Debit</th>
            <th className="py-1 pl-3 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((l) => (
            <tr key={l.id} className="text-gray-600">
              <td className={`whitespace-nowrap py-1 pr-3 text-gray-500 ${MONO}`}>{l.account_code ?? ''}</td>
              <td className="py-1 pr-3">{l.account_name ?? ''}</td>
              <td className={`whitespace-nowrap py-1 pl-3 text-right tabular-nums ${MONO}`}>{fmtMoney(l.debit)}</td>
              <td className={`whitespace-nowrap py-1 pl-3 text-right tabular-nums ${MONO}`}>{fmtMoney(l.credit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Counterparty chip (14-C-2b) — read-only neutral pill. Page-local; not the
// t2/ redesign component.
const CounterpartyChip: FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
    {name}
  </span>
);

// Assign control (D-14C2-6/-16): shown in the drill-down of an UNATTRIBUTED
// entry only. Picker is ACTIVE counterparties only (archived excluded per
// D-14C2-9/-17). Assign POSTs the attribution action; success refetches, and
// 409/400/404 detail messages surface verbatim. Page-local.
const AssignCounterpartyControl: FC<{ entryId: string; onAssigned: () => void }> = ({
  entryId, onAssigned,
}) => {
  const cp = useCounterparties({ archived: false });
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load all active counterparties for the picker (server clamps at 200).
  useEffect(() => {
    cp.setPageSize(200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assign = async () => {
    if (!selected) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await attributeEntry(entryId, selected);
      if (res?.status === 200) {
        onAssigned();
      } else {
        setErr(res?.data?.detail ?? 'Could not assign counterparty.');
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Could not assign counterparty.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">Assign counterparty</span>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={`${inputCls} py-1.5`}
        aria-label="Select counterparty"
      >
        <option value="">Select…</option>
        {cp.items.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || submitting}
        onClick={assign}
        className="rounded-lg bg-[var(--color-navy)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? 'Assigning…' : 'Assign'}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
};

const LoadingSkeleton: FC = () => (
  <>
    <div className="h-8 w-40 animate-pulse rounded bg-gray-100" />
    <div className="mt-4 flex gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-gray-100" />
      ))}
    </div>
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  </>
);

const ErrorState: FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
    <p className="text-sm text-gray-700">{error}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
    >
      Try again
    </button>
  </div>
);

const EmptyState: FC<{ filtered: boolean; onClear: () => void }> = ({ filtered, onClear }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
    <p className="text-sm text-gray-500">
      {filtered ? 'No entries match these filters.' : 'No entries yet.'}
    </p>
    {filtered && (
      <button
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        Clear filters
      </button>
    )}
  </div>
);

export const LedgerRegister: FC = () => {
  const [activeTab, setActiveTab] = useState<LedgerTab | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [unattributed, setUnattributed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Column sort (O-S30-2). null = the server's default order (date-desc),
  // rendered byte-unchanged from today.
  const [sort, setSort] = useState<{ key: 'date' | 'entry_number'; dir: 'asc' | 'desc' } | null>(null);

  const { items, count, page, setPage, pageSize, isLoading, error, refetch } =
    useLedgerEntries({
      tab: activeTab ?? undefined,
      status: statusFilter ?? undefined,
      date_from: dateFrom ?? undefined,
      date_to: dateTo ?? undefined,
      unattributed,
    });

  const anyFilterSet =
    activeTab !== null || statusFilter !== null || !!dateFrom || !!dateTo || unattributed;

  // The hook does not auto-reset page when params change — every filter change
  // resets to page 1 (and collapses any open drill-down) so results stay truthful.
  const selectTab = (tab: LedgerTab | null) => { setActiveTab(tab); setPage(1); setExpandedId(null); };
  const changeStatus = (v: string) => { setStatusFilter(v || null); setPage(1); setExpandedId(null); };
  const changeFrom = (v: string) => { setDateFrom(v || null); setPage(1); setExpandedId(null); };
  const changeTo = (v: string) => { setDateTo(v || null); setPage(1); setExpandedId(null); };
  const toggleUnattributed = () => { setUnattributed((v) => !v); setPage(1); setExpandedId(null); };
  const clearFilters = () => {
    setActiveTab(null); setStatusFilter(null); setDateFrom(null); setDateTo(null);
    setUnattributed(false); setPage(1); setExpandedId(null);
  };

  // Sortable Date / Entry # (O-S30-2). The header caret reflects this even when
  // no explicit sort is set — the default view IS date-desc.
  const effectiveSort = sort ?? { key: 'date' as const, dir: 'desc' as const };

  // R-S30-B: CLIENT-SIDE sort of the FETCHED PAGE ONLY. For a multi-page org
  // this reorders just the current page, not the whole ledger — the future
  // backend `ordering` query param (R-S30-B) will make it whole-dataset. Until
  // then, `sort === null` renders the server order (date-desc) unchanged; the
  // sort runs only once the user picks a column. Entry # sorts NUMERICALLY;
  // null entry numbers sort last in both directions.
  const rows = useMemo(() => {
    if (sort === null) return items;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sort.key === 'entry_number') {
        const na = a.entry_number;
        const nb = b.entry_number;
        if (na === null && nb === null) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return (na - nb) * dir;
      }
      const cmp = a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0;
      return cmp * dir;
    });
  }, [items, sort]);

  const toggleSort = (key: 'date' | 'entry_number') => {
    setExpandedId(null);
    setSort((cur) => {
      const base = cur ?? { key: 'date' as const, dir: 'desc' as const };
      if (base.key === key) {
        return { key, dir: base.dir === 'asc' ? 'desc' : 'asc' };
      }
      // First explicit click on a column: date defaults desc (matches today),
      // entry # defaults ascending (natural numeric order).
      return { key, dir: key === 'date' ? 'desc' : 'asc' };
    });
  };

  const ariaSort = (key: 'date' | 'entry_number'): 'ascending' | 'descending' | 'none' =>
    effectiveSort.key === key ? (effectiveSort.dir === 'asc' ? 'ascending' : 'descending') : 'none';

  const showPager = count > pageSize;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <PageShell>
      <PageHeader
        title="Ledger"
        subtitle="Every transaction, posted by the AI bookkeeper. Read-only — corrections post as new entries."
      />

      {/* Tab strip */}
      <div className="mt-5 flex flex-wrap gap-2">
        <FilterChip active={activeTab === null} onClick={() => selectTab(null)}>All</FilterChip>
        {LEDGER_TABS.map((t) => (
          <FilterChip
            key={t.value}
            active={activeTab === t.value}
            onClick={() => selectTab(t.value)}
          >
            {t.label}
          </FilterChip>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter ?? ''}
          onChange={(e) => changeStatus(e.target.value)}
          className={inputCls}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          From
          <input type="date" value={dateFrom ?? ''} onChange={(e) => changeFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          To
          <input type="date" value={dateTo ?? ''} onChange={(e) => changeTo(e.target.value)} className={inputCls} />
        </label>
        {/* 14-C-2b (D-14C2-21): unattributed-only toggle. */}
        <FilterChip active={unattributed} onClick={toggleUnattributed}>Unassigned</FilterChip>
        {anyFilterSet && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : count === 0 ? (
          <EmptyState filtered={anyFilterSet} onClear={clearFilters} />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="w-6 px-4 py-3" />
                    <th className="px-4 py-3" aria-sort={ariaSort('date')}>
                      <button
                        type="button"
                        onClick={() => toggleSort('date')}
                        className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-gray-700"
                      >
                        Date
                        {effectiveSort.key === 'date' && (
                          <span aria-hidden="true">{effectiveSort.dir === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3" aria-sort={ariaSort('entry_number')}>
                      <button
                        type="button"
                        onClick={() => toggleSort('entry_number')}
                        className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-gray-700"
                      >
                        Entry #
                        {effectiveSort.key === 'entry_number' && (
                          <span aria-hidden="true">{effectiveSort.dir === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Debits</th>
                    <th className="px-4 py-3 text-right">Credits</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const open = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => setExpandedId(open ? null : row.id)}
                          className="cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/60"
                        >
                          <td className="px-4 py-3"><Chevron open={open} /></td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(row.entry_date)}</td>
                          <td className={`whitespace-nowrap px-4 py-3 text-xs text-gray-500 ${MONO}`}>{row.entry_number_display ?? ''}</td>
                          <td className="px-4 py-3 text-gray-900">
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span>{row.description}</span>
                              {/* Attributed → read-only name chip; unattributed → nothing. */}
                              {row.counterparty && <CounterpartyChip name={row.counterparty.name} />}
                            </span>
                          </td>
                          <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 ${MONO}`}>{fmtMoney(row.total_debits)}</td>
                          <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 ${MONO}`}>{fmtMoney(row.total_credits)}</td>
                          <td className="px-4 py-3"><StatusBadge row={row} /></td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              {/* Counterparty section (D-14C2-16: set-only-when-null v1).
                                  Attributed → read-only chip, no edit/clear. Unattributed
                                  → Assign control. */}
                              <div className="bg-gray-50 px-4 py-3">
                                {row.counterparty ? (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-gray-500">Counterparty</span>
                                    <CounterpartyChip name={row.counterparty.name} />
                                  </div>
                                ) : (
                                  <AssignCounterpartyControl
                                    entryId={row.id}
                                    onAssigned={() => { setExpandedId(null); refetch(); }}
                                  />
                                )}
                              </div>
                              <LineDetail lines={row.lines} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {showPager && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
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
      </div>
    </PageShell>
  );
};
