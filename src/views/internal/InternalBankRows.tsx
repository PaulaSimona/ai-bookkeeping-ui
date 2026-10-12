// InternalBankRows (S87 B2b U3, O-S87-8) — the staff bank-rows screen: every
// bank row waiting on staff, across the orgs the viewer may see
// (GET /api/accounting/review/bank/). The InternalQueue pattern: the list, and
// the open row in a pane beside it — the row and the row it may be a copy of,
// side by side.
//
// The screen shows what the server sent. Amounts are its strings, rendered
// untouched (never formatMoney). Bank text — counterparty and description — is
// plain text. A feed is named by its name and its last four digits, never more.
// A suggested match is shown by its entry: its line_debit / line_credit arrive
// as JSON numbers and are never rendered (F-S87-7).
//
// Filters (O-S87-3): ticket status, possible duplicates, a date range, and one
// feed. The feed is set from a row ("Only this feed") and shown as a chip — no
// endpoint lists the feeds a viewer may see. A filter that is not set is not
// sent (bankRowParams), and changing one goes back to the first page. The
// older ?org= and ?include_excluded= parameters are not offered.
//
// The org column shows only when the viewer's own org list (GET
// /api/accounting/orgs/: a reviewer's assigned orgs, every org for a super
// user) has more than one org. The pane always names the row's org.
import { type FC, type ReactNode, useState } from 'react';

import {
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  PageContainer,
  Pill,
  SecondaryButton,
  SectionCard,
  humanizeCode,
} from '@/components/internal/ui';
import { useOrgsList } from '@/hooks/useInternalAdmin';
import {
  BANK_ROW_TICKET_STATUSES,
  POSSIBLE_DUPLICATE_REASON,
  useStaffBankRows,
  type BankRow,
  type BankRowFilters,
  type BankRowSibling,
} from '@/hooks/useStaffBankRows';

const fieldCls =
  'rounded-lg bg-[#0A1628] border border-white/15 px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:ring-1 focus:ring-[#0066FF] [color-scheme:dark]';
const labelCls = 'text-[11px] uppercase tracking-wide text-white/30';
const pagerCls =
  'rounded-md border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/5 disabled:opacity-40';

// A feed as the screen names it: its name, then its last four digits — never
// more of a mask than four.
const feedLabel = (row: BankRow): string => {
  const name = row.bank_account_name ?? '—';
  const lastFour = row.feed_mask ? row.feed_mask.slice(-4) : '';
  return lastFour ? `${name} ····${lastFour}` : name;
};

// money_in / money_out in words; anything else as the server sent it.
const directionLabel = (direction: string): string => {
  if (direction === 'money_in') return 'Money in';
  if (direction === 'money_out') return 'Money out';
  return direction;
};

const SIBLING_RELATION: Record<BankRowSibling['relation'], string> = {
  flagged_against: 'Flagged against',
  merged_into: 'Merged into',
};

// An id on screen: its first eight characters, the whole id kept in the title.
const ShortId: FC<{ id: string }> = ({ id }) => (
  <span title={id} className="font-mono text-xs text-white/40">
    {id.slice(0, 8)}
  </span>
);

const Detail: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <dt className={labelCls}>{label}</dt>
    <dd className="text-white/80 break-words">{children}</dd>
  </div>
);

// What a row is flagged with: still pending at the bank, a possible copy of
// another row, out of the books.
const RowFlags: FC<{ row: BankRow }> = ({ row }) => {
  const possibleDuplicate = row.routing_reason === POSSIBLE_DUPLICATE_REASON;
  if (!row.pending && !possibleDuplicate && !row.excluded) return <>—</>;
  return (
    <span className="flex flex-wrap gap-1">
      {row.pending && <Pill tone="info">Pending at bank</Pill>}
      {possibleDuplicate && <Pill tone="warning">Possible duplicate</Pill>}
      {row.excluded && (
        <Pill tone="danger">
          {row.excluded_reason ? `Excluded: ${row.excluded_reason}` : 'Excluded'}
        </Pill>
      )}
    </span>
  );
};

// What the bank said of a row — the fields a row and its sibling share.
type RowSide = Pick<
  BankRow,
  | 'id'
  | 'date'
  | 'direction'
  | 'amount'
  | 'currency'
  | 'counterparty_name'
  | 'description'
  | 'pending'
  | 'excluded'
>;

// One half of the pane: the open row, or the row it may be a copy of.
const RowCard: FC<{ label: string; heading: string; row: RowSide }> = ({ label, heading, row }) => (
  <section aria-label={label} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-white">{heading}</h3>
      <ShortId id={row.id} />
    </div>
    <dl className="mt-2 space-y-2 text-sm">
      <Detail label="Date">{row.date}</Detail>
      <Detail label="Amount">
        {directionLabel(row.direction)} {row.amount} {row.currency}
      </Detail>
      <Detail label="Counterparty">{row.counterparty_name || '—'}</Detail>
      <Detail label="Bank text">{row.description || '—'}</Detail>
      <Detail label="Pending at bank">{row.pending ? 'Yes' : 'No'}</Detail>
      <Detail label="Excluded">{row.excluded ? 'Yes' : 'No'}</Detail>
    </dl>
  </section>
);

const DetailPane: FC<{
  row: BankRow;
  // The list is already narrowed to this row's feed.
  feedIsFilter: boolean;
  onOnlyThisFeed: () => void;
  onClose: () => void;
}> = ({ row, feedIsFilter, onOnlyThisFeed, onClose }) => {
  const sibling = row.duplicate_sibling;
  const match = row.suggested_match;
  return (
    <section aria-label="Bank row detail">
      <SectionCard
        title={`${row.date} · ${directionLabel(row.direction)} ${row.amount} ${row.currency}`}
        description={feedLabel(row)}
        actions={
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm" title="Close">
            ✕
          </button>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RowCard label="This row" heading="This row" row={row} />
            {sibling ? (
              <RowCard label="Sibling" heading={SIBLING_RELATION[sibling.relation]} row={sibling} />
            ) : (
              <p className="text-sm text-white/50">No duplicate sibling.</p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Org">
              {row.org_name ?? '—'} {row.org_id && <ShortId id={row.org_id} />}
            </Detail>
            <Detail label="Feed">{feedLabel(row)}</Detail>
            <Detail label="Feed account">{row.feed_account_code ?? '—'}</Detail>
            <Detail label="Source">{humanizeCode(row.source)}</Detail>
            <Detail label="Ticket">{humanizeCode(row.ticket_status)}</Detail>
            <Detail label="Routing reason">{humanizeCode(row.routing_reason)}</Detail>
          </dl>

          {match && (
            <div>
              <div className={`${labelCls} mb-1`}>Suggested match</div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="State">{humanizeCode(match.state)}</Detail>
                <Detail label="Entry date">{match.entry_date ?? '—'}</Detail>
                <Detail label="Entry">{match.entry_description || '—'}</Detail>
                <Detail label="Account">{match.account_code ?? '—'}</Detail>
              </dl>
            </div>
          )}

          {!feedIsFilter && (
            <div>
              <SecondaryButton onClick={onOnlyThisFeed}>Only this feed</SecondaryButton>
            </div>
          )}
        </div>
      </SectionCard>
    </section>
  );
};

export const InternalBankRows: FC = () => {
  const [filters, setFilters] = useState<Omit<BankRowFilters, 'bankAccountId'>>({});
  // The one feed the list is narrowed to, named as the row it was set from
  // named it.
  const [feed, setFeed] = useState<{ id: string; label: string } | null>(null);
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useStaffBankRows({
    ...filters,
    bankAccountId: feed?.id,
  });
  const { data: orgs } = useOrgsList();
  const spansOrgs = orgs.length > 1;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((row) => row.id === selectedId) ?? null;

  // A change of filter starts again from the first page, with no row open.
  const restart = () => {
    setPage(1);
    setSelectedId(null);
  };
  const change = (patch: Omit<BankRowFilters, 'bankAccountId'>) => {
    setFilters((current) => ({ ...current, ...patch }));
    restart();
  };
  const changeFeed = (next: { id: string; label: string } | null) => {
    setFeed(next);
    restart();
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <PageContainer
      title="Bank rows"
      subtitle={
        isLoading
          ? 'Loading…'
          : `${count} ${count === 1 ? 'row' : 'rows'} waiting on staff (oldest first).`
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={filters.ticketStatus ?? ''}
          onChange={(e) => change({ ticketStatus: e.target.value || undefined })}
          aria-label="Ticket status"
          className={fieldCls}
        >
          <option value="">Any ticket status</option>
          {/* The server's own seven (BANK_ROW_TICKET_STATUSES). */}
          {BANK_ROW_TICKET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanizeCode(status)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={filters.possibleDuplicate ?? false}
            onChange={(e) => change({ possibleDuplicate: e.target.checked || undefined })}
          />
          Possible duplicates only
        </label>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <span>From</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => change({ dateFrom: e.target.value || undefined })}
            aria-label="From date"
            className={fieldCls}
          />
          <span>to</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => change({ dateTo: e.target.value || undefined })}
            aria-label="To date"
            className={fieldCls}
          />
        </div>
        {feed && (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#0066FF]/20 px-3 py-1 text-xs font-medium text-[#4DA6FF]">
            <span>Feed: {feed.label}</span>
            <button
              type="button"
              onClick={() => changeFeed(null)}
              aria-label="Remove feed filter"
              className="hover:text-white"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {isLoading ? (
        <SectionCard>
          <CenteredSpinner label="Loading bank rows…" />
        </SectionCard>
      ) : items.length === 0 ? (
        !error && (
          <SectionCard>
            <EmptyState title="No bank rows" description="No bank rows match the current filters." />
          </SectionCard>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* List */}
          <div className={selected ? 'lg:col-span-2' : 'lg:col-span-5'}>
            <SectionCard className="overflow-hidden" title={`Bank rows (${count})`}>
              <div className="overflow-x-auto -m-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                      <th className="py-2 px-5 font-medium">Date</th>
                      {spansOrgs && <th className="py-2 px-3 font-medium">Org</th>}
                      <th className="py-2 px-3 font-medium">Feed</th>
                      <th className="py-2 px-3 font-medium text-right">Amount</th>
                      <th className="py-2 px-3 font-medium">Bank text</th>
                      <th className="py-2 px-3 font-medium">Ticket</th>
                      <th className="py-2 px-3 font-medium">Flags</th>
                      <th className="py-2 px-5 font-medium">Routing reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${
                          row.id === selectedId ? 'bg-[#0066FF]/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="py-2.5 px-5 text-white/70 whitespace-nowrap">{row.date}</td>
                        {spansOrgs && (
                          <td className="py-2.5 px-3 text-white/70 truncate max-w-[10rem]">
                            {row.org_name ?? '—'}
                            {/* O-S43-3: short org-id disambiguator (id.slice(0,8) + font-mono). */}
                            {row.org_id && (
                              <span className="ml-2 font-mono text-xs text-white/40">
                                {row.org_id.slice(0, 8)}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-white/70 whitespace-nowrap">{feedLabel(row)}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className="text-xs text-white/40">{directionLabel(row.direction)}</span>{' '}
                          <span className="text-white/90 tabular-nums">{`${row.amount} ${row.currency}`}</span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[18rem]">
                          {row.counterparty_name && (
                            <div className="text-white/90 truncate">{row.counterparty_name}</div>
                          )}
                          <div className="text-white/50 truncate">{row.description || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {row.ticket_status ? <Pill>{humanizeCode(row.ticket_status)}</Pill> : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <RowFlags row={row} />
                        </td>
                        <td className="py-2.5 px-5 text-white/70">{humanizeCode(row.routing_reason)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Detail pane */}
          {selected && (
            <div className="lg:col-span-3">
              <DetailPane
                key={selected.id}
                row={selected}
                feedIsFilter={feed?.id === selected.bank_account_id}
                onOnlyThisFeed={() =>
                  changeFeed({ id: selected.bank_account_id, label: feedLabel(selected) })
                }
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
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
              className={pagerCls}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className={pagerCls}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
