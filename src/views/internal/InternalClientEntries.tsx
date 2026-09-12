import { type FC, Fragment, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStaffOrgEntries } from '@/hooks/useStaffResolution';
import { type LedgerEntryRow } from '@/hooks/useLedgerEntries';
// S69 E8 fence 4a (F-S69-9): the expanded row's counterparty control is the
// shared StaffEntryActions panel (replace / clear / reason, confirm on clear,
// refetch on success) — the same implementation the staff account ledger uses.
import { StaffEntryActions } from '@/components/internal/StaffEntryActions';
import {
  PageContainer,
  SectionCard,
  Pill,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  formatMoney,
  humanizeCode,
} from '@/components/internal/ui';
import { entryDisplayStatus } from '@/utils/entryStatus';

const STATUS_FILTERS = ['', 'draft', 'posted', 'reversed', 'replaced'];

const statusTone = (s: string): 'success' | 'warning' | 'neutral' | 'danger' => {
  if (s === 'posted') return 'success';
  if (s === 'draft') return 'warning';
  if (s === 'reversed' || s === 'voided') return 'danger';
  return 'neutral';
};

const entryNo = (e: LedgerEntryRow): string =>
  e.entry_number_display || (e.entry_number != null ? String(e.entry_number) : '—');

export const InternalClientEntries: FC = () => {
  const { orgId = '' } = useParams();
  const [status, setStatus] = useState('');
  const [unattributed, setUnattributed] = useState(false);
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useStaffOrgEntries(
    orgId,
    { status: status || undefined, unattributed },
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <PageContainer
      title="Client entries"
      subtitle="Ledger entries for this organization (newest first)."
      actions={
        <Link
          to="/internal/clients"
          className="text-sm text-[#4DA6FF] hover:text-white underline underline-offset-2"
        >
          ← All clients
        </Link>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg bg-[#0A1628] border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#0066FF]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? humanizeCode(s) : 'All statuses'}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={unattributed}
            onChange={(e) => {
              setUnattributed(e.target.checked);
              setPage(1);
            }}
          />
          Only unassigned
        </label>
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {isLoading ? (
        <SectionCard>
          <CenteredSpinner label="Loading entries…" />
        </SectionCard>
      ) : items.length === 0 && !error ? (
        <SectionCard>
          <EmptyState title="No entries" description="No ledger entries match the current filters." />
        </SectionCard>
      ) : (
        <SectionCard className="overflow-hidden" title={`Entries (${count})`}>
          <div className="overflow-x-auto -m-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                  <th className="py-2 px-5 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Entry #</th>
                  <th className="py-2 px-3 font-medium">Description</th>
                  <th className="py-2 px-3 font-medium text-right">Debits</th>
                  <th className="py-2 px-3 font-medium text-right">Credits</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-5 font-medium">Counterparty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const expanded = expandedId === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        className="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors align-top"
                      >
                        <td className="py-2.5 px-5 text-white/70 whitespace-nowrap">{e.entry_date}</td>
                        <td className="py-2.5 px-3 text-white/60">{entryNo(e)}</td>
                        <td className="py-2.5 px-3 text-white/90 max-w-[16rem] truncate">
                          {e.description || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white/80">{formatMoney(e.total_debits)}</td>
                        <td className="py-2.5 px-3 text-right text-white/80">{formatMoney(e.total_credits)}</td>
                        <td className="py-2.5 px-3">
                          {/* F-S71-2 / O-S71-3: derived status — a reversed
                              original shows "Reversed", not "Posted". */}
                          <Pill tone={statusTone(entryDisplayStatus(e))}>
                            {humanizeCode(entryDisplayStatus(e))}
                          </Pill>
                        </td>
                        <td className="py-2.5 px-5">
                          {e.counterparty ? (
                            <span className="text-white/80">{e.counterparty.name}</span>
                          ) : (
                            <span className="text-white/40">Unassigned</span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="space-y-3">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/30">
                                      <th className="py-1 pr-3 font-medium">Code</th>
                                      <th className="py-1 pr-3 font-medium">Account</th>
                                      <th className="py-1 px-3 font-medium text-right">Debit</th>
                                      <th className="py-1 px-3 font-medium text-right">Credit</th>
                                      <th className="py-1 pl-3 font-medium">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {e.lines.map((l) => (
                                      <tr key={l.id} className="border-t border-white/5">
                                        <td className="py-1 pr-3 font-mono text-white/70">{l.account_code ?? '—'}</td>
                                        <td className="py-1 pr-3 text-white/70">{l.account_name ?? '—'}</td>
                                        <td className="py-1 px-3 text-right text-white/80">{formatMoney(l.debit)}</td>
                                        <td className="py-1 px-3 text-right text-white/80">{formatMoney(l.credit)}</td>
                                        <td className="py-1 pl-3 text-white/60">{l.description || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {/* Replace / clear on every expanded row, not only
                                  unassigned ones (F-S69-9). The row's own
                                  counterparty is the panel's "current"; a save
                                  refetches the page — no local mutation. */}
                              <StaffEntryActions orgId={orgId} entry={e} onChanged={refetch} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Pagination */}
      {count > pageSize && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-md border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
