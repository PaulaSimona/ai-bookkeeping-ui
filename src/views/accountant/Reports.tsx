// Accountant Reports (/accountant/reports, Session-25 Phase E, U3). A two-column
// card grid of the aggregate reports (P&L, Balance Sheet, GST/HST summary), read
// straight from the ledger via the accountant's OWN report hooks. Export chips
// are DELIBERATELY omitted: there is no backend export seam (W-S25-2, Option A),
// and no Excel chip either. Tokens only, no hex; money strings are display-only.
import { type FC, type ReactNode, useState } from 'react';
import { useOrgContext } from '@/context/OrgContext';
import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { FilterChip } from '@/components/t2/FilterChip';
import { StatusBadge } from '@/components/t2/StatusBadge';
import {
  useAccountantPnl,
  useAccountantBalanceSheet,
  useAccountantTax,
  type PnlPeriodKind,
  type ReportRow,
  type ReportSection,
} from './hooks/useAccountantReports';

const fmtMoney = (s: string): string => {
  const n = Number(s);
  if (Number.isNaN(n)) return `$${s}`;
  const abs = Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};
const fmtDate = (iso: string | null): string =>
  iso === null ? '—' : new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

const MONO = 'font-[var(--font-family-mono)] tabular-nums';

const StateNote: FC<{ children: ReactNode; tone?: 'muted' | 'error' }> = ({ children, tone = 'muted' }) => (
  <div className={`text-[13.5px] ${tone === 'error' ? 'text-red-600' : 'text-gray-400'}`}>{children}</div>
);

const Rows: FC<{ rows: ReportRow[] }> = ({ rows }) =>
  rows.length === 0 ? (
    <div className="py-2 text-[13px] text-gray-400">No activity in this period.</div>
  ) : (
    <>
      {rows.map((r) => (
        <div key={r.code ?? r.name} className="flex items-center justify-between py-1.5">
          <span className="text-[14px] text-gray-700">{r.name}</span>
          <span className={`text-[14px] text-gray-900 ${MONO}`}>{fmtMoney(r.amount)}</span>
        </div>
      ))}
    </>
  );

const Section: FC<{ title: string; section: ReportSection; totalLabel: string }> = ({ title, section, totalLabel }) => (
  <div>
    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">{title}</div>
    <div className="mt-2 divide-y divide-gray-100">
      <Rows rows={section.rows} />
    </div>
    <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
      <span className="text-[13px] font-medium text-gray-600">{totalLabel}</span>
      <span className={`text-[14px] font-semibold text-gray-900 ${MONO}`}>{fmtMoney(section.total)}</span>
    </div>
  </div>
);

const ProfitAndLossCard: FC = () => {
  const [period, setPeriod] = useState<PnlPeriodKind>('ytd');
  const { data, isLoading, error } = useAccountantPnl(period);
  return (
    <Card padding className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-gray-900">Profit &amp; Loss</h2>
          {data && <p className="mt-0.5 text-[13px] text-gray-500">{data.period.label}</p>}
        </div>
        <div className="flex gap-2">
          <FilterChip active={period === 'ytd'} onClick={() => setPeriod('ytd')}>Year to date</FilterChip>
          <FilterChip active={period === 'quarter'} onClick={() => setPeriod('quarter')}>This quarter</FilterChip>
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
  const { data, isLoading, error } = useAccountantBalanceSheet();
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

const TaxRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[14px] text-gray-700">{label}</span>
    <span className={`text-[14px] text-gray-900 ${MONO}`}>{fmtMoney(value)}</span>
  </div>
);

const TaxSummaryCard: FC = () => {
  const { data, isLoading, error } = useAccountantTax();
  return (
    <Card padding className="space-y-4">
      <h2 className="text-[17px] font-semibold text-gray-900">GST/HST summary</h2>
      {isLoading && <StateNote>Loading…</StateNote>}
      {error && <StateNote tone="error">{error}</StateNote>}
      {data && !error && !data.registered && (
        <StateNote>Not registered for GST/HST — nothing to file.</StateNote>
      )}
      {data && !error && data.registered && (
        <div className="space-y-4">
          {data.period && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-gray-500">{data.period.period_label}</span>
              {data.period.deadline && (
                <span className="text-[13px] text-gray-500">Due {fmtDate(data.period.deadline)}</span>
              )}
            </div>
          )}
          <div className="divide-y divide-gray-100">
            <TaxRow label="Collected" value={data.collected} />
            <TaxRow label="Input tax credits" value={data.itc} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[var(--color-navy)] px-4 py-3 text-white">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Net tax</span>
            <span className={`text-[17px] font-semibold ${MONO}`}>{fmtMoney(data.net)}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

const ReportsInner: FC = () => {
  const { activeOrg } = useOrgContext();
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Reports"
          subtitle={`${activeOrg?.org_name ?? 'This client'} · profit & loss, balance sheet, and GST/HST — straight from the ledger.`}
        />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProfitAndLossCard />
          <BalanceSheetCard />
          <TaxSummaryCard />
        </div>
      </div>
    </div>
  );
};

export const AccountantReports: FC = () => {
  const { activeOrgId, needsSelection } = useOrgContext();
  if (needsSelection) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <PageHeader title="Reports" subtitle="Choose a client from the sidebar to view their reports." />
        </div>
      </div>
    );
  }
  return <ReportsInner key={activeOrgId ?? 'none'} />;
};
