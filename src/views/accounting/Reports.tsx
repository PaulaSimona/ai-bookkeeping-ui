// Reports page (§14 14-C-3 B5, O-14C3-1/-2) — the Tier 2 owner's Profit & Loss
// and Balance Sheet, read straight from the ledger via the report endpoints
// (seams 31/32). Own data layer (useReports); presentational bits from
// src/components/t2 only. Tokens only — no hex, no gradients (O-14C-3). Rows
// render from the payload; the only JS on money strings is display formatting.
import { type FC, type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatIsoDate } from '@/utils/dates';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { FilterChip } from '@/components/t2/FilterChip';
import { StatusBadge } from '@/components/t2/StatusBadge';
import {
  usePnl,
  useBalanceSheet,
  type PnlPeriodKind,
  type ReportPeriod,
  type ReportRow,
  type ReportSection,
} from '@/hooks/useReports';
import {
  customRangeError,
  reportPeriodQueryString,
  useReportPeriod,
} from '@/hooks/useReportPeriod';

// Drill-down target for a coded row (O-S68-30): the account ledger for the SAME
// period, tagged with the report it came from. The computed Current-year-earnings
// row (code null) has no ledger and stays static.
type FromReport = 'pnl' | 'balance_sheet';
const ledgerHref = (code: string, period: ReportPeriod, from: FromReport): string =>
  `/accounting/reports/account/${encodeURIComponent(code)}?${reportPeriodQueryString(period)}&from_report=${from}`;

// Display-only formatting — the backend two-decimal STRINGS stay the source of
// truth; Number() only hands a numeric to the locale formatter. Negatives read
// naturally (-$50.00); no red/green — sign does not imply status (calm).
const fmtMoney = (s: string): string => {
  const n = Number(s);
  if (Number.isNaN(n)) return `$${s}`;
  const abs = Math.abs(n).toLocaleString('en-CA', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

// as_of / period bounds are calendar DATES — parsed locally (O-S68-21).
const fmtDate = (iso: string | null): string =>
  iso === null ? '—' : formatIsoDate(iso, { year: 'numeric', month: 'long', day: 'numeric' });

const MONO = 'font-[var(--font-family-mono)] tabular-nums';

const StateNote: FC<{ children: ReactNode; tone?: 'muted' | 'error' }> = ({
  children, tone = 'muted',
}) => (
  <div className={`text-[13.5px] ${tone === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
    {children}
  </div>
);

const Chevron: FC = () => (
  <svg
    className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const Rows: FC<{ rows: ReportRow[]; linkTo?: (code: string) => string }> = ({ rows, linkTo }) =>
  rows.length === 0 ? (
    <div className="py-2 text-[13px] text-gray-400">No activity in this period.</div>
  ) : (
    <>
      {rows.map((r) =>
        // Coded rows drill into the account ledger (O-S68-30); the computed
        // Current-year-earnings row has code=null → name only, static.
        r.code !== null && linkTo ? (
          <Link
            key={r.code}
            to={linkTo(r.code)}
            className="group flex cursor-pointer items-center justify-between py-1.5"
          >
            <span className="text-[14px] text-gray-700">{r.name}</span>
            <span className="flex items-center gap-2">
              <span className={`text-[14px] text-gray-900 ${MONO}`}>{fmtMoney(r.amount)}</span>
              <Chevron />
            </span>
          </Link>
        ) : (
          <div key={r.code ?? r.name} className="flex items-center justify-between py-1.5">
            <span className="text-[14px] text-gray-700">{r.name}</span>
            <span className={`text-[14px] text-gray-900 ${MONO}`}>{fmtMoney(r.amount)}</span>
          </div>
        ),
      )}
    </>
  );

const Section: FC<{
  title: string; section: ReportSection; totalLabel: string; linkTo?: (code: string) => string;
}> = ({
  title, section, totalLabel, linkTo,
}) => (
  <div>
    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
      {title}
    </div>
    <div className="mt-2 divide-y divide-gray-100">
      <Rows rows={section.rows} linkTo={linkTo} />
    </div>
    <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
      <span className="text-[13px] font-medium text-gray-600">{totalLabel}</span>
      <span className={`text-[14px] font-semibold text-gray-900 ${MONO}`}>
        {fmtMoney(section.total)}
      </span>
    </div>
  </div>
);

const PERIOD_CHIPS: { kind: PnlPeriodKind; label: string }[] = [
  { kind: 'ytd', label: 'Year to date' },
  { kind: 'quarter', label: 'This quarter' },
  { kind: 'month', label: 'This month' },
  { kind: 'custom', label: 'Custom' },
];

const dateInputCls =
  'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

// Period controls (O-S68-29): chips write the URL directly; custom keeps a local
// draft of the two bounds and writes the URL only once both are valid — no
// request ever carries a half-formed window. Invalid drafts show inline text.
const PeriodControls: FC<{ period: ReportPeriod; setPeriod: (p: ReportPeriod) => void }> = ({
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
    <div className="flex flex-col items-end gap-2">
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

const ProfitAndLossCard: FC<{ period: ReportPeriod; setPeriod: (p: ReportPeriod) => void }> = ({
  period, setPeriod,
}) => {
  const { data, isLoading, error } = usePnl(period); // refetches on period switch
  const linkTo = (code: string) => ledgerHref(code, period, 'pnl');

  return (
    <Card padding className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-gray-900">Profit &amp; Loss</h2>
          {data && <p className="mt-0.5 text-[13px] text-gray-500">{data.period.label}</p>}
        </div>
        <PeriodControls period={period} setPeriod={setPeriod} />
      </div>

      {isLoading && <StateNote>Loading…</StateNote>}
      {error && <StateNote tone="error">{error}</StateNote>}
      {data && !error && (
        <div className="space-y-5">
          <Section title="Revenue" section={data.revenue} totalLabel="Total revenue" linkTo={linkTo} />
          <Section title="Expenses" section={data.expenses} totalLabel="Total expenses" linkTo={linkTo} />
          <div className="flex items-center justify-between rounded-xl bg-[var(--color-navy)] px-4 py-3 text-white">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Net profit</span>
            <span className={`text-[17px] font-semibold ${MONO}`}>{fmtMoney(data.net)}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

const BalanceSheetCard: FC<{ period: ReportPeriod }> = ({ period }) => {
  const { data, isLoading, error } = useBalanceSheet(period); // as_of = min(window end, today)
  const linkTo = (code: string) => ledgerHref(code, period, 'balance_sheet');

  return (
    <Card padding className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-gray-900">Balance Sheet</h2>
        {data && (
          <div className="flex items-center gap-2">
            {!data.balances && <StatusBadge variant="warning">Out of balance</StatusBadge>}
            <span className="text-[13px] text-gray-500">As of {fmtDate(data.as_of)}</span>
          </div>
        )}
      </div>

      {isLoading && <StateNote>Loading…</StateNote>}
      {error && <StateNote tone="error">{error}</StateNote>}
      {data && !error && (
        <div className="space-y-5">
          <Section title="Assets" section={data.assets} totalLabel="Total assets" linkTo={linkTo} />
          <Section title="Liabilities" section={data.liabilities} totalLabel="Total liabilities" linkTo={linkTo} />
          <Section title="Equity" section={data.equity} totalLabel="Total equity" linkTo={linkTo} />
        </div>
      )}
    </Card>
  );
};

export const Reports: FC = () => {
  // One URL-backed period for the whole page (O-S68-29): both cards and every
  // drill-down link read the same window.
  const [period, setPeriod] = useReportPeriod();

  return (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <PageHeader
        title="Reports"
        subtitle="Your profit & loss and balance sheet, straight from the ledger."
      />
      <ProfitAndLossCard period={period} setPeriod={setPeriod} />
      <BalanceSheetCard period={period} />
      <Link to="/accounting/taxes" className="block">
        <Card padding className="flex items-center justify-between transition hover:shadow-md">
          <div>
            <div className="text-[15px] font-semibold text-gray-900">GST/HST summary</div>
            <div className="mt-0.5 text-[13px] text-gray-500">
              What you've collected, what you can claim, and when it's due.
            </div>
          </div>
          <span className="text-[13px] font-medium text-[var(--color-primary)]">View taxes →</span>
        </Card>
      </Link>
    </div>
  </div>
  );
};
