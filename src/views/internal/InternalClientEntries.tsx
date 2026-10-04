import { type FC, Fragment, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStaffOrgEntries } from '@/hooks/useStaffResolution';
import { useStaffEntryDetail } from '@/hooks/useStaffReports';
// S69 E8 fence 4a (F-S69-9): the expanded row's staff writes are the shared
// StaffEntryActions panel — the same implementation the staff account ledger
// uses. Offered on the chain's LIVE entry only (D-S85-13).
import { StaffEntryActions } from '@/components/internal/StaffEntryActions';
import { EntryChain } from '@/components/ledger/EntryChain';
import {
  PageContainer,
  SectionCard,
  Pill,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  formatMoney,
} from '@/components/internal/ui';
import {
  REGISTRY_STATUS_OPTIONS,
  entryDisplayStatus,
  entryStatusLabel,
  formatEntryNumber,
  isLiveEntry,
  nonLiveNote,
  type EntryLinkSource,
  type EntryRef,
} from '@/utils/entryStatus';

// The list is posted entries only (D-S84-4): Posted, Corrected, Reversed or
// Reversal — never a draft, a replaced draft or a review flag.
const statusTone = (s: string): 'success' | 'warning' | 'neutral' | 'danger' => {
  if (s === 'posted') return 'success';
  if (s === 'reversed') return 'danger';
  return 'neutral';
};

const entryNo = (e: { entry_number_display?: string | null; entry_number?: number | null }): string =>
  e.entry_number_display || formatEntryNumber(e.entry_number) || '—';

// What the expanded panel renders from: a list row, or — after "Open JE-xxxx"
// in the chain panel — the entry read by id from the staff detail endpoint.
// Both shapes satisfy it.
interface PanelLine {
  id: string;
  account_code: string | null;
  account_name: string | null;
  debit: string | null;
  credit: string | null;
  description?: string;
}

interface PanelEntry extends EntryLinkSource {
  status: string;
  entry_number?: number | null;
  entry_number_display?: string | null;
  counterparty?: { id: string; name: string } | null;
  reverses_entry_id?: string | null;
  reversed_by_entry_id?: string | null;
  corrects_entry_id?: string | null;
  corrects_entry_number_display?: string | null;
  lines: PanelLine[];
}

// The expanded panel of one entry (O-S84-1, D-S85-13): its lines, its chain
// with "Open JE-xxxx" for the live entry, and — on the chain's LIVE entry only
// — the staff writes. Any other entry says how it is linked and where changes
// are made instead.
const EntryPanel: FC<{
  orgId: string;
  entry: PanelEntry;
  onChanged: () => void;
  onOpenEntry: (ref: EntryRef) => void;
}> = ({ orgId, entry, onChanged, onOpenEntry }) => {
  const note = nonLiveNote(entry);
  return (
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
            {entry.lines.map((l) => (
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

      <EntryChain
        tone="dark"
        chain={entry.chain}
        currentId={entry.id}
        liveEntry={entry.live_entry}
        truncated={entry.chain_truncated}
        onOpenEntry={onOpenEntry}
      />

      {isLiveEntry(entry) ? (
        // Replace / clear the counterparty and correct the entry. The panel's
        // own counterparty is the "current"; a save refetches — no local
        // mutation.
        <StaffEntryActions
          orgId={orgId}
          entry={{
            id: entry.id,
            entry_number: entry.entry_number ?? null,
            counterparty: entry.counterparty ?? null,
            entry_number_display: entry.entry_number_display ?? null,
            reverses_entry_id: entry.reverses_entry_id ?? null,
            reversed_by_entry_id: entry.reversed_by_entry_id ?? null,
            corrects_entry_id: entry.corrects_entry_id ?? null,
            reverses_entry_number_display: entry.reverses_entry_number_display ?? null,
            reversed_by_entry_number_display: entry.reversed_by_entry_number_display ?? null,
            corrects_entry_number_display: entry.corrects_entry_number_display ?? null,
          }}
          onChanged={onChanged}
        />
      ) : (
        note && <p className="text-xs text-amber-200/80">{note}</p>
      )}
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
  const [expandedId, setExpandedRowId] = useState<string | null>(null);
  // "Open JE-xxxx" in the chain panel re-targets the expanded panel: it then
  // shows that entry, read by id from the staff detail endpoint (O-S84-1).
  // Expanding or collapsing a row goes back to the row's own entry.
  const [targetId, setTargetId] = useState<string | null>(null);
  const { entry: target, refetch: refetchTarget } = useStaffEntryDetail(targetId);
  const setExpandedId = (id: string | null) => { setExpandedRowId(id); setTargetId(null); };
  // Immediate reflection: a staff write re-reads the page and the open entry.
  const onEntryChanged = () => { refetch(); refetchTarget(); };

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
            setExpandedId(null);
          }}
          aria-label="Filter by status"
          className="rounded-lg bg-[#0A1628] border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#0066FF]"
        >
          {/* The shared registry options (D-S84-4). "Posted" is the list's
              default and sends no status. */}
          {REGISTRY_STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'posted'} value={o.value}>
              {o.label}
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
                          {/* The registry's display status (D-S84-4): Posted,
                              Corrected, Reversed or Reversal. */}
                          <Pill tone={statusTone(entryDisplayStatus(e))}>
                            {entryStatusLabel(e)}
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
                            {targetId === null ? (
                              <EntryPanel
                                orgId={orgId}
                                entry={e}
                                onChanged={onEntryChanged}
                                onOpenEntry={(ref) => setTargetId(ref.id)}
                              />
                            ) : (
                              <div className="space-y-3">
                                {/* Re-targeted: the panel shows another entry
                                    of this row's chain. */}
                                <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                                  {target?.kind === 'ready' && target.row.id === targetId ? (
                                    <>
                                      <span className="font-mono font-semibold text-white/90">
                                        {entryNo(target.row)}
                                      </span>
                                      <span>{target.row.entry_date}</span>
                                      <Pill tone={statusTone(entryDisplayStatus(target.row))}>
                                        {entryStatusLabel(target.row)}
                                      </Pill>
                                    </>
                                  ) : target?.kind === 'error' ? (
                                    <span className="text-red-300">{target.message}</span>
                                  ) : (
                                    <span className="text-white/40">Loading entry…</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setTargetId(null)}
                                    className="text-[#4DA6FF] underline underline-offset-2 hover:text-white"
                                  >
                                    Back to {entryNo(e)}
                                  </button>
                                </div>
                                {target?.kind === 'ready' && target.row.id === targetId && (
                                  <EntryPanel
                                    orgId={orgId}
                                    entry={target.row}
                                    onChanged={onEntryChanged}
                                    onOpenEntry={(ref) => setTargetId(ref.id)}
                                  />
                                )}
                              </div>
                            )}
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
