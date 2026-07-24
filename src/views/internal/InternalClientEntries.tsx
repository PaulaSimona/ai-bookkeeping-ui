import { type FC, Fragment, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStaffOrgEntries, attributeStaffEntry } from '@/hooks/useStaffResolution';
import { type LedgerEntryRow } from '@/hooks/useLedgerEntries';
import { CounterpartyPicker } from '@/components/internal/CounterpartyPicker';
import {
  PageContainer,
  SectionCard,
  Pill,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  Toast,
  useToast,
  formatMoney,
  humanizeCode,
} from '@/components/internal/ui';

const STATUS_FILTERS = ['', 'draft', 'posted', 'reversed', 'replaced'];

const statusTone = (s: string): 'success' | 'warning' | 'neutral' | 'danger' => {
  if (s === 'posted') return 'success';
  if (s === 'draft') return 'warning';
  if (s === 'reversed' || s === 'voided') return 'danger';
  return 'neutral';
};

const entryNo = (e: LedgerEntryRow): string =>
  e.entry_number_display || (e.entry_number != null ? String(e.entry_number) : '—');

const AssignPanel: FC<{
  orgId: string;
  entryId: string;
  onDone: () => void;
  notify: (m: string, t: 'success' | 'error') => void;
}> = ({ orgId, entryId, onDone, notify }) => {
  const [cpId, setCpId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const assign = async () => {
    if (!cpId || submitting) return;
    setSubmitting(true);
    const res = await attributeStaffEntry(entryId, cpId);
    setSubmitting(false);
    if (res.ok) {
      notify('Counterparty assigned.', 'success');
      onDone(); // optimistic refresh
    } else if (res.status === 409) {
      notify('Already attributed.', 'error');
      onDone(); // refresh to show the current attribution
    } else {
      notify(res.errorDetail ?? 'Assignment failed.', 'error');
    }
  };

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2 max-w-md">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Assign counterparty
      </div>
      <CounterpartyPicker orgId={orgId} value={cpId} onChange={setCpId} disabled={submitting} />
      <button
        type="button"
        onClick={assign}
        disabled={!cpId || submitting}
        className="rounded-md bg-[#0066FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0052cc] disabled:opacity-50"
      >
        {submitting ? 'Assigning…' : 'Assign'}
      </button>
    </div>
  );
};

export const InternalClientEntries: FC = () => {
  const { orgId = '' } = useParams();
  const [status, setStatus] = useState('');
  const [unattributed, setUnattributed] = useState(false);
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useStaffOrgEntries(
    orgId,
    { status: status || undefined, unattributed },
  );
  const { toast, showToast } = useToast();
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
      <Toast toast={toast} />

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
                          <Pill tone={statusTone(e.status)}>{humanizeCode(e.status)}</Pill>
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
                              {!e.counterparty && (
                                <AssignPanel
                                  orgId={orgId}
                                  entryId={e.id}
                                  onDone={refetch}
                                  notify={showToast}
                                />
                              )}
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
