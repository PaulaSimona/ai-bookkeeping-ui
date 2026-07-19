import { FC } from 'react';
import { useDashboardSummary, DashboardSummary } from '@/hooks/useDashboardSummary';

// §14 14-B Tier 2 client dashboard (D-14B-5/6). Headline financial-profile
// cards on the shipped light convention (TaxProfile.tsx precedent). Tokens are
// replicated from the Tier 1 Dashboard as a design reference only — no Tier 1
// code or hooks are imported (separate-data-layer rule).

// Display-only money formatting. The backend two-decimal STRINGS are the source
// of truth; we never do arithmetic in JS floats — Number() is used solely to
// hand a numeric to Intl for locale currency rendering. Negatives render
// naturally (e.g. -$50.00); no red/green — sign does not imply status (calm).
const fmtMoney = (value: string, currency: string | null): string =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency ?? 'CAD',
  }).format(Number(value));

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

// Local, in-file stat card — deliberately NOT shared/exported (separate-data-
// layer rule). Calmer than the Tier 1 reference: no icon chip.
const StatCard: FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
  </div>
);

const PageShell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
  </div>
);

const TAX_SUBLINE: Record<string, string> = {
  ca_registered: 'Net GST/HST & PST collected minus credits',
  us: 'Sales tax collected',
};

const DashboardContent: FC<{ data: DashboardSummary }> = ({ data }) => {
  const currency = data.currency;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Your financial overview</p>
          {data.fiscal_year && (
            <p className="mt-1 text-sm text-gray-400">
              Fiscal year {fmtDate(data.fiscal_year.start)}–{fmtDate(data.fiscal_year.end)}
            </p>
          )}
        </div>
        <p className="text-sm text-gray-400 whitespace-nowrap">As of {fmtDate(data.as_of)}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <StatCard label="Cash on hand" value={fmtMoney(data.cash_on_hand, currency)} />
        <StatCard
          label="Money coming in"
          value={fmtMoney(data.receivables, currency)}
          sub="Accounts receivable"
        />
        <StatCard
          label="Money going out"
          value={fmtMoney(data.payables, currency)}
          sub="Accounts payable"
        />
        {/* Tax position card is ABSENT when tax_net is null (D-14B-3): calmer
            than a permanent $0.00 for an org that structurally owes no tax. */}
        {data.tax_net !== null && (
          <StatCard
            label="Tax position"
            value={fmtMoney(data.tax_net, currency)}
            sub={data.tax_mode ? TAX_SUBLINE[data.tax_mode] : undefined}
          />
        )}
        <StatCard
          label="Profit to date"
          value={fmtMoney(data.profit_to_date, currency)}
          sub={data.fiscal_year ? 'This fiscal year' : 'Since books start'}
        />
      </div>
    </>
  );
};

const LoadingSkeleton: FC = () => (
  <>
    <div className="h-8 w-40 bg-gray-100 rounded animate-pulse" />
    <div className="mt-2 h-4 w-56 bg-gray-100 rounded animate-pulse" />
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="mt-3 h-7 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="mt-2 h-3 w-28 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  </>
);

const ErrorState: FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-md">
    <p className="text-sm text-gray-700">{error}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
    >
      Try again
    </button>
  </div>
);

export const AccountingDashboard: FC = () => {
  const { data, isLoading, error, refetch } = useDashboardSummary();

  return (
    <PageShell>
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data ? (
        <DashboardContent data={data} />
      ) : null}
    </PageShell>
  );
};
