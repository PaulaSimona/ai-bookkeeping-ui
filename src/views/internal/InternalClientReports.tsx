// InternalClientReports (S69 E5-UI / E8, O-S69-9 / O-S69-15 / O-S69-16) — a
// client's Profit & Loss and Balance Sheet as seen by an assigned reviewer or
// super user. READ-ONLY, no impersonation: every read is the org-addressed
// staff endpoint (useStaffReports), the banner says so, and every drill link
// stays inside /internal. Composes the fence-1 shared presentational pieces
// (ReportTable, ExportBar with the staff exportUrl, PeriodControls) inside the
// internal console's own primitives. The section heading / total row and the
// net-profit band are mirrored from Reports.tsx (module-private there) with
// internal primitives.
import { type FC } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import {
  PageContainer,
  SectionCard,
  Pill,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  formatMoney,
} from '@/components/internal/ui';
import { ReportTable } from '@/components/reports/ReportTable';
import { ExportBar } from '@/views/accounting/reports/ExportBar';
import { PeriodControls } from '@/views/accounting/reports/PeriodControls';
import { type ReportPeriod, type ReportSection } from '@/hooks/useReports';
import { reportPeriodQueryString, useReportPeriod } from '@/hooks/useReportPeriod';
import { staffExportUrl, useStaffBalanceSheet, useStaffPnl } from '@/hooks/useStaffReports';
import { formatIsoDate } from '@/utils/dates';

const MONO = 'font-[var(--font-family-mono)] tabular-nums';

// Drill target stays inside /internal (O-S69-16): the staff account-ledger page
// for the SAME period, tagged with the report it came from — the owner
// ledgerHref shape with the internal prefix.
type FromReport = 'pnl' | 'balance_sheet';
const staffLedgerHref = (orgId: string, code: string, period: ReportPeriod, from: FromReport): string =>
  `/internal/clients/${orgId}/reports/account/${encodeURIComponent(code)}?${reportPeriodQueryString(period)}&from_report=${from}`;

const fmtDate = (iso: string | null): string =>
  iso === null ? '—' : formatIsoDate(iso, { year: 'numeric', month: 'long', day: 'numeric' });

// Short-id fallback, the house convention InternalClients renders (id.slice(0,8), mono).
export const orgLabel = (orgId: string, orgName: string | undefined): string =>
  orgName || orgId.slice(0, 8);

export const StaffBanner: FC<{ orgId: string; orgName?: string }> = ({ orgId, orgName }) => (
  <div className="flex items-center gap-2">
    <Pill tone="info">Viewing {orgLabel(orgId, orgName)} as staff — read-only</Pill>
    {!orgName && <span className="font-mono text-xs text-white/40">{orgId.slice(0, 8)}</span>}
  </div>
);

// Mirrors Reports.tsx `Section` (heading · rows · total row) with internal text
// tokens; the rows themselves are the shared ReportTable.
const StaffSection: FC<{
  title: string; section: ReportSection; totalLabel: string; linkTo: (code: string) => string;
}> = ({ title, section, totalLabel, linkTo }) => (
  <div>
    <div className="text-[11.5px] font-semibold uppercase tracking-wider text-white/40">{title}</div>
    <div className="mt-2 divide-y divide-gray-100 rounded-lg bg-white px-4">
      <ReportTable rows={section.rows} accountHref={linkTo} />
    </div>
    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
      <span className="text-[13px] font-medium text-white/60">{totalLabel}</span>
      <span className={`text-[14px] font-semibold text-white ${MONO}`}>{formatMoney(section.total)}</span>
    </div>
  </div>
);

// 404 from a staff hook (unassigned / unknown org) renders the internal
// empty state — never a redirect into the client app (O-S69-9).
const StaffReportState: FC<{ status: number | null; error: string | null; onRetry: () => void }> = ({
  status, error, onRetry,
}) =>
  status === 404
    ? <EmptyState title="Not found" description="This client is not assigned to you, or the organization does not exist." />
    : <ErrorBanner message={error ?? 'Failed to load report'} onRetry={onRetry} />;

export const InternalClientReports: FC = () => {
  const { orgId = '' } = useParams<{ orgId: string }>();
  const location = useLocation();
  const orgName = (location.state as { orgName?: string } | null)?.orgName;
  const [period, setPeriod] = useReportPeriod();          // URL-backed, unchanged

  const pnl = useStaffPnl(orgId, period);
  const bs = useStaffBalanceSheet(orgId, period);
  const exportUrl = staffExportUrl(orgId);
  const linkState = { orgName };

  return (
    <PageContainer
      title="Reports"
      subtitle={`Profit & loss and balance sheet for ${orgLabel(orgId, orgName)}, straight from their ledger.`}
      actions={<StaffBanner orgId={orgId} orgName={orgName} />}
    >
      <nav aria-label="Breadcrumb" className="text-[13px] text-white/50">
        <Link to="/internal/clients" className="hover:text-white">Assigned clients</Link>
        <span className="mx-1.5 text-white/20">›</span>
        <Link to={`/internal/clients/${orgId}/entries`} state={linkState} className="hover:text-white">
          {orgLabel(orgId, orgName)}
        </Link>
        <span className="mx-1.5 text-white/20">›</span>
        <span className="text-white/80">Reports</span>
      </nav>

      <SectionCard
        title="Profit & Loss"
        description={pnl.data?.period.label}
        actions={
          <div className="flex flex-col items-end gap-2">
            <ExportBar kind="pnl" period={period} exportUrl={exportUrl} />
            <PeriodControls period={period} setPeriod={setPeriod} />
          </div>
        }
      >
        {pnl.isLoading && <CenteredSpinner label="Loading…" />}
        {!pnl.isLoading && pnl.error && (
          <StaffReportState status={pnl.status} error={pnl.error} onRetry={pnl.refetch} />
        )}
        {!pnl.isLoading && pnl.data && !pnl.error && (
          <div className="space-y-5">
            <StaffSection
              title="Revenue" section={pnl.data.revenue} totalLabel="Total revenue"
              linkTo={(code) => staffLedgerHref(orgId, code, period, 'pnl')}
            />
            <StaffSection
              title="Expenses" section={pnl.data.expenses} totalLabel="Total expenses"
              linkTo={(code) => staffLedgerHref(orgId, code, period, 'pnl')}
            />
            {/* Net-profit band mirrored from Reports.tsx. */}
            <div className="flex items-center justify-between rounded-xl bg-[#0066FF]/20 px-4 py-3 text-white">
              <span className="text-[12px] font-semibold uppercase tracking-wider">Net profit</span>
              <span className={`text-[17px] font-semibold ${MONO}`}>{formatMoney(pnl.data.net)}</span>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Balance Sheet"
        description={bs.data ? `As of ${fmtDate(bs.data.as_of)}` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {bs.data && !bs.data.balances && <Pill tone="warning">Out of balance</Pill>}
            <ExportBar kind="balance_sheet" period={period} exportUrl={exportUrl} />
          </div>
        }
      >
        {bs.isLoading && <CenteredSpinner label="Loading…" />}
        {!bs.isLoading && bs.error && (
          <StaffReportState status={bs.status} error={bs.error} onRetry={bs.refetch} />
        )}
        {!bs.isLoading && bs.data && !bs.error && (
          <div className="space-y-5">
            {(['assets', 'liabilities', 'equity'] as const).map((key) => (
              <StaffSection
                key={key}
                title={key.charAt(0).toUpperCase() + key.slice(1)}
                section={bs.data![key]}
                totalLabel={`Total ${key}`}
                linkTo={(code) => staffLedgerHref(orgId, code, period, 'balance_sheet')}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
};
