// LedgerSummaryStrip (S69 E5-UI, O-S69-15) — the summary card at the top of an
// account ledger (account · period · opening · debits · credits · net · closing)
// lifted VERBATIM out of AccountLedgerPage. Pure/presentational: it reads
// exactly the seven payload fields it renders (typed as a Pick so it cannot
// reach anything else) and takes the export controls as a slot, so the owner
// page keeps passing its own ExportBar and a staff page can pass its own.
import { type FC, type ReactNode } from 'react';

import { Card } from '@/components/t2/Card';
import { formatIsoDate } from '@/utils/dates';
import { type AccountLedger } from '@/hooks/useReports';
import { fmtMoney, MONO } from '@/views/accounting/reports/format';

const fmtDate = (iso: string | null): string =>
  iso === null ? '—' : formatIsoDate(iso);

const Stat: FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
    <div className={`mt-0.5 text-[14px] text-gray-900 ${mono ? MONO : ''}`}>{value}</div>
  </div>
);

export type LedgerSummary = Pick<
  AccountLedger,
  'account' | 'period' | 'opening_balance' | 'total_debits' | 'total_credits' | 'net_change' | 'closing_balance'
>;

export const LedgerSummaryStrip: FC<{ data: LedgerSummary; exportSlot?: ReactNode }> = ({
  data, exportSlot = null,
}) => (
            <Card padding>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">Summary</span>
                {exportSlot}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                <Stat label="Account" value={`${data.account.code} · ${data.account.name}`} mono={false} />
                <Stat
                  label="Period"
                  value={`${fmtDate(data.period.start)} → ${fmtDate(data.period.end)}`}
                  mono={false}
                />
                <Stat label="Opening balance" value={data.opening_balance === null ? '—' : fmtMoney(data.opening_balance)} />
                <Stat label="Total debits" value={fmtMoney(data.total_debits)} />
                <Stat label="Total credits" value={fmtMoney(data.total_credits)} />
                <Stat label="Net change" value={fmtMoney(data.net_change)} />
                <Stat label="Closing balance" value={fmtMoney(data.closing_balance)} />
              </div>
            </Card>
);
