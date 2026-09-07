// Period controls (S68 E3, O-S68-29) — shared by the Reports page and the
// account-ledger drill-down. Chips write the URL-backed period directly; custom
// keeps a local draft of the two bounds and writes only once both are valid —
// no request ever carries a half-formed window. Invalid drafts show inline text.
import { type FC, useState } from 'react';
import { FilterChip } from '@/components/t2/FilterChip';
import { type PnlPeriodKind, type ReportPeriod } from '@/hooks/useReports';
import { customRangeError } from '@/hooks/useReportPeriod';

const PERIOD_CHIPS: { kind: PnlPeriodKind; label: string }[] = [
  { kind: 'ytd', label: 'Year to date' },
  { kind: 'quarter', label: 'This quarter' },
  { kind: 'month', label: 'This month' },
  { kind: 'custom', label: 'Custom' },
];

const dateInputCls =
  'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

export const PeriodControls: FC<{ period: ReportPeriod; setPeriod: (p: ReportPeriod) => void }> = ({
  period, setPeriod,
}) => {
  const [customOpen, setCustomOpen] = useState(period.period === 'custom');
  const [from, setFrom] = useState(period.date_from ?? '');
  const [to, setTo] = useState(period.date_to ?? '');
  const draftError = customRangeError(from || undefined, to || undefined);

  const pick = (kind: PnlPeriodKind) => {
    if (kind === 'custom') {
      setCustomOpen(true);
      if (draftError === null) setPeriod({ period: 'custom', date_from: from, date_to: to });
      return;
    }
    setCustomOpen(false);
    setPeriod({ period: kind });
  };

  const onBound = (which: 'from' | 'to', value: string) => {
    const nextFrom = which === 'from' ? value : from;
    const nextTo = which === 'to' ? value : to;
    if (which === 'from') setFrom(value); else setTo(value);
    if (customRangeError(nextFrom || undefined, nextTo || undefined) === null) {
      setPeriod({ period: 'custom', date_from: nextFrom, date_to: nextTo });
    }
  };

  const customActive = period.period === 'custom' || customOpen;

  return (
    <div className="no-print flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {PERIOD_CHIPS.map(({ kind, label }) => (
          <FilterChip
            key={kind}
            active={kind === 'custom' ? customActive : period.period === kind && !customOpen}
            onClick={() => pick(kind)}
          >
            {label}
          </FilterChip>
        ))}
      </div>
      {customActive && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="text-[12px] text-gray-500">
            From{' '}
            <input type="date" value={from} onChange={(e) => onBound('from', e.target.value)} className={dateInputCls} />
          </label>
          <label className="text-[12px] text-gray-500">
            To{' '}
            <input type="date" value={to} onChange={(e) => onBound('to', e.target.value)} className={dateInputCls} />
          </label>
          {draftError && (from || to) && (
            <span className="text-[12px] text-red-600">{draftError}</span>
          )}
        </div>
      )}
    </div>
  );
};
