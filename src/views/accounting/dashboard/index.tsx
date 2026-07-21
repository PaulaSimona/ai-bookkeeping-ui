import { type FC, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { useDashboardSummary, DashboardSummary } from '@/hooks/useDashboardSummary';
import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { HeroStatCard } from '@/components/t2/HeroStatCard';

// §14 14-B Tier 2 client dashboard (D-14B-5/6), restyled onto the t2/ visual
// language (s22 B1). Own data layer (useDashboardSummary) — no Tier 1 hook. Only
// data-backed cards render; the sparkline / cash-flow chart / needs-attention /
// activity feed / Export of the prototype are OMITTED (no data — 14-C-4), never
// mocked. Tokens + Tailwind neutrals only; zero hex.

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

const MONO = 'font-[var(--font-family-mono)]';

// White metric card (label · mono figure · optional sub) on the t2/Card surface.
// Page-local: the shipped t2/StatCard has no sub slot and must not be edited
// (D-S22-4), so the sub-carrying variant lives here.
const MetricCard: FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <Card padding>
    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
    <div className={`mt-2 text-[22px] font-semibold text-gray-900 ${MONO}`}>{value}</div>
    {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
  </Card>
);

// Flow card with a colored-dot label. The dot is a calm categorical marker
// (in / out), NOT a sign/status indicator.
const FlowCard: FC<{ label: string; value: string; sub?: string; dot: string }> = ({
  label, value, sub, dot,
}) => (
  <Card padding>
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <span className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
    </div>
    <div className={`mt-2 text-[22px] font-semibold text-gray-900 ${MONO}`}>{value}</div>
    {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
  </Card>
);

const PageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
  </div>
);

const TAX_SUBLINE: Record<string, string> = {
  ca_registered: 'Net GST/HST & PST collected minus credits',
  us: 'Sales tax collected',
};

const greeting = (hour: number): string =>
  hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

const DashboardContent: FC<{ data: DashboardSummary; name: string }> = ({ data, name }) => {
  const currency = data.currency;
  const fy = data.fiscal_year;
  const title = `${greeting(new Date().getHours())}${name ? `, ${name}` : ''}`;
  const subtitle = fy
    ? `Fiscal year ${fmtDate(fy.start)} – ${fmtDate(fy.end)}`
    : 'Your financial overview';

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        right={
          <span className="whitespace-nowrap text-[13px] text-gray-400">
            As of {fmtDate(data.as_of)}
          </span>
        }
      />

      {/* Headline row (3-up): navy cash hero, profit, and — only when the org
          has a tax position — the tax card. Tax card is ABSENT when tax_net is
          null (D-14B-3): never a permanent $0.00. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HeroStatCard label="Cash on hand" value={fmtMoney(data.cash_on_hand, currency)} />
        <MetricCard
          label="Profit · YTD"
          value={fmtMoney(data.profit_to_date, currency)}
          sub={fy ? 'This fiscal year' : 'Since books start'}
        />
        {data.tax_net !== null && (
          <MetricCard
            label="Tax set aside"
            value={fmtMoney(data.tax_net, currency)}
            sub={data.tax_mode ? TAX_SUBLINE[data.tax_mode] : undefined}
          />
        )}
      </div>

      {/* Flow row (2-up): money in / money out, colored-dot labels. */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FlowCard
          label="Money coming in"
          value={fmtMoney(data.receivables, currency)}
          sub="Accounts receivable"
          dot="bg-emerald-500"
        />
        <FlowCard
          label="Money going out"
          value={fmtMoney(data.payables, currency)}
          sub="Accounts payable"
          dot="bg-amber-500"
        />
      </div>
    </>
  );
};

const LoadingSkeleton: FC = () => (
  <>
    <div className="h-8 w-40 animate-pulse rounded bg-gray-100" />
    <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-100" />
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="mt-3 h-7 w-32 animate-pulse rounded bg-gray-100" />
          <div className="mt-2 h-3 w-28 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  </>
);

const ErrorState: FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
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
  // Greeting name from existing auth state (no new endpoint) — nested MeUser or
  // flat, mirroring the Sidebar's defensive read; empty string if unavailable.
  const auth = useSelector((s: RootState) => s.auth);
  const name = auth.user?.user?.first_name ?? auth.user?.first_name ?? '';

  return (
    <PageShell>
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data ? (
        <DashboardContent data={data} name={name} />
      ) : null}
    </PageShell>
  );
};
