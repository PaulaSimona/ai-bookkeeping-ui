// LedgerTable (S69 E5-UI, O-S69-15) — the account-ledger lines table lifted
// VERBATIM out of AccountLedgerPage: the overflow-x-auto wrapper, the
// table-fixed column allocation (O-S69-13/13a), the expandable row that hosts
// the shared EntryDrawer, and the pagination footer. Pure/presentational: no
// hook, no route, no api call — the page owns the data, the expanded id and the
// page number and passes them in. `drawerActions` is a slot rendered inside the
// expanded row, below the drawer; the owner passes nothing (fence 3 uses it).
import { type FC, Fragment, type ReactNode } from 'react';

import { Card } from '@/components/t2/Card';
import { EntryDrawer } from '@/components/ledger/EntryDrawer';
import { type AccountantLedgerRow } from '@/views/accountant/hooks/useAccountantLedger';
import { Spinner } from '@/views/settings/ui';
import { formatIsoDate } from '@/utils/dates';
import { type LedgerLine } from '@/hooks/useReports';
import { fmtMoney, MONO } from '@/views/accounting/reports/format';

export const humanize = (s: string): string => {
  const t = s.replace(/_/g, ' ').trim();
  return t.length === 0 ? '—' : t.charAt(0).toUpperCase() + t.slice(1);
};

// The drawer renders from a full row (JournalEntrySerializer shape). The page
// fetches it ON CLICK and hands the state down.
export type EntryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; row: AccountantLedgerRow };

const cellCls = 'whitespace-nowrap px-4 py-3 text-gray-700';
const moneyCls = `whitespace-nowrap px-4 py-3 text-right text-gray-900 ${MONO}`;

export interface LedgerTableProps {
  lines: LedgerLine[];
  expandedId: string | null;
  onRowToggle: (entryId: string | null) => void;
  entry: EntryState | null;
  readOnly: boolean;
  count: number;
  first: number;
  last: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  drawerActions?: ReactNode;
}

export const LedgerTable: FC<LedgerTableProps> = ({
  lines,
  expandedId: openEntryId,
  onRowToggle: setOpenEntryId,
  entry,
  readOnly,
  count,
  first,
  last,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  drawerActions = null,
}) => (
            <Card>
              {lines.length === 0 ? (
                <div className="px-6 py-10 text-center text-[13px] text-gray-400">
                  No posted transactions in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed min-w-[64rem] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        <th className="w-28 px-4 py-2 text-left">Date</th>
                        <th className="w-20 px-4 py-2 text-left">Entry</th>
                        {/* Description carries no width: table-fixed gives it
                            every remaining pixel as the page widens (O-S69-13). */}
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="w-44 px-4 py-2 text-left">Counterparty</th>
                        <th className="w-40 px-4 py-2 text-left">Source</th>
                        <th className="w-32 px-4 py-2 text-right">Debit</th>
                        <th className="w-32 px-4 py-2 text-right">Credit</th>
                        <th className="w-32 px-4 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lines.map((l, i) => {
                        const open = openEntryId === l.entry_id;
                        return (
                          <Fragment key={`${l.entry_id}-${i}`}>
                            <tr
                              className={`cursor-pointer transition-colors hover:bg-gray-50 ${open ? 'bg-gray-50' : ''}`}
                              onClick={() => setOpenEntryId(open ? null : l.entry_id)}
                            >
                              <td className={cellCls}>{formatIsoDate(l.entry_date)}</td>
                              <td className={`${cellCls} ${MONO}`}>{l.entry_number != null ? `#${l.entry_number}` : '—'}</td>
                              <td className="truncate px-4 py-3 text-gray-700" title={l.description}>{l.description || '—'}</td>
                              <td className={`${cellCls} truncate`} title={l.counterparty?.name ?? '—'}>{l.counterparty?.name ?? '—'}</td>
                              <td className={`${cellCls} truncate`} title={humanize(l.source)}>{humanize(l.source)}</td>
                              <td className={moneyCls}>{fmtMoney(l.debit)}</td>
                              <td className={moneyCls}>{fmtMoney(l.credit)}</td>
                              <td className={`${moneyCls} font-semibold`}>{fmtMoney(l.running_balance)}</td>
                            </tr>
                            {open && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  {entry?.kind === 'loading' && (
                                    <div className="flex h-16 items-center justify-center bg-gray-50"><Spinner /></div>
                                  )}
                                  {entry?.kind === 'error' && (
                                    <div className="bg-gray-50 px-5 py-3 text-[13px] text-red-600">{entry.message}</div>
                                  )}
                                  {entry?.kind === 'ready' && (
                                    <EntryDrawer
                                      row={entry.row}
                                      readOnly={readOnly}
                                      adjustOpen={false}
                                      onToggleAdjust={() => undefined}
                                      onPosted={() => undefined}
                                    />
                                  )}
                                  {drawerActions}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {count > 0 && (
                <div className="no-print flex items-center justify-between border-t border-gray-100 px-4 py-3 text-[13px] text-gray-500">
                  <span>{first}–{last} of {count}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!hasPrevious}
                      onClick={onPrevious}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={!hasNext}
                      onClick={onNext}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </Card>
);
