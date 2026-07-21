// Reports page (§14 14-C-3 B5, O-14C3-1/-2) — the Tier 2 owner's Profit & Loss
// and Balance Sheet, read straight from the ledger via the report endpoints
// (seams 31/32). Own data layer (useReports); presentational bits from
// src/components/t2 only. Tokens only — no hex, no gradients (O-14C-3). Rows
// render from the payload; the only JS on money strings is display formatting.
import { type FC, type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { FilterChip } from '@/components/t2/FilterChip';
import { StatusBadge } from '@/components/t2/StatusBadge';
import {
  usePnl,
  useBalanceSheet,
  type PnlPeriodKind,
  type ReportRow,
  type ReportSection,
} from '@/hooks/useReports';

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

const fmtDate = (iso: string | null): string =>
  iso === null
    ? '—'
    : new Date(iso).toLocaleDateString('en-CA', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

const MONO = 'font-[var(--font-family-mono)] tabular-nums';

const StateNote: FC<{ children: ReactNode; tone?: 'muted' | 'error' }> = ({
  children, tone = 'muted',
}) => (
  <div className={`text-[13.5px] ${tone === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
    {children}
  </div>
);

const Rows: FC<{ rows: ReportRow[] }> = ({ rows }) =>
  rows.length === 0 ? (
    <div className="py-2 text-[13px] text-gray-400">No activity in this period.</div>
  ) : (
    <>
      {rows.map((r) => (
        // The computed Current-year-earnings row has code=null → name only.
        <div key={r.code ?? r.name} className="flex items-center justify-between py-1.5">
          <span className="text-[14px] text-gray-700">{r.name}</span>
          <span className={`text-[14px] text-gray-900 ${MONO}`}>{fmtMoney(r.amount)}</span>
        </div>
      ))}
    </>
  );

const Section: FC<{ title: string; section: ReportSection; totalLabel: string }> = ({
  title, section, totalLabel,
}) => (
  <div>
    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
      {title}
    </div>
    <div className="mt-2 divide-y divide-gray-100">
      <Rows rows={section.rows} />
    </div>
    <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
      <span className="text-[13px] font-medium text-gray-600">{totalLabel}</span>
      <span className={`text-[14px] font-semibold text-gray-900 ${MONO}`}>
        {fmtMoney(section.total)}
      </span>
    </div>
  </div>
);

const ProfitAndLossCard: FC = () => {
  const [period, setPeriod] = useState<PnlPeriodKind>('ytd');
  const { data, isLoading, error } = usePnl(period); // refetches on period switch

  return (
    <Card padding className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-gray-900">Profit &amp; Loss</h2>
          {data && <p className="mt-0.5 text-[13px] text-gray-500">{data.period.label}</p>}
        </div>
        <div className="flex gap-2">
          <FilterChip active={period === 'ytd'} onClick={() => setPeriod('ytd')}>
            Year to date
          </FilterChip>
          <FilterChip active={period === 'quarter'} onClick={() => setPeriod('quarter')}>
            This quarter
          </FilterChip>
        </div>
      </div>

      {isLoading && <StateNote>Loading…</StateNote>}
      {error && <StateNote tone="error">{error}</StateNote>}
      {data && !error && (
        <div className="space-y-5">
          <Section title="Revenue" section={data.revenue} totalLabel="Total revenue" />
          <Section title="Expenses" section={data.expenses} totalLabel="Total expenses" />
          <div className="flex items-center justify-between rounded-xl bg-[var(--color-navy)] px-4 py-3 text-white">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Net profit</span>
            <span className={`text-[17px] font-semibold ${MONO}`}>{fmtMoney(data.net)}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

const BalanceSheetCard: FC = () => {
  const { data, isLoading, error } = useBalanceSheet();

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
          <Section title="Assets" section={data.assets} totalLabel="Total assets" />
          <Section title="Liabilities" section={data.liabilities} totalLabel="Total liabilities" />
          <Section title="Equity" section={data.equity} totalLabel="Total equity" />
        </div>
      )}
    </Card>
  );
};

export const Reports: FC = () => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <PageHeader
        title="Reports"
        subtitle="Your profit & loss and balance sheet, straight from the ledger."
      />
      <ProfitAndLossCard />
      <BalanceSheetCard />
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
