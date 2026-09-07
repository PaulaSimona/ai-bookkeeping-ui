// InternalClientAccountLedger (S69 E5-UI / E8, O-S69-9 / O-S69-15 / O-S69-16)
// — one account's posted lines for a client, as seen by staff. READ-ONLY, no
// impersonation: the ledger and the drawer's entry detail both come from the
// org-addressed staff endpoints (useStaffReports); the shared LedgerSummaryStrip
// / LedgerTable render exactly what the owner sees; the ExportBar downloads via
// the staff exportUrl. `drawerActions` is left null here — fence 3 fills it.
import { type FC, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import {
  PageContainer,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
} from '@/components/internal/ui';
import { LedgerSummaryStrip } from '@/components/ledger/LedgerSummaryStrip';
import { LedgerTable, humanize } from '@/components/ledger/LedgerTable';
import { ExportBar } from '@/views/accounting/reports/ExportBar';
import { PeriodControls } from '@/views/accounting/reports/PeriodControls';
import { type LedgerLine, type ReportPeriod } from '@/hooks/useReports';
import { reportPeriodQueryString, useReportPeriod } from '@/hooks/useReportPeriod';
import { staffExportUrl, useStaffAccountLedger, useStaffEntryDetail } from '@/hooks/useStaffReports';
import { StaffEntryActions } from '@/components/internal/StaffEntryActions';
import { StaffBanner, orgLabel } from './InternalClientReports';

const PAGE_SIZE = 100;
const MONO = 'font-[var(--font-family-mono)] tabular-nums';

export const InternalClientAccountLedger: FC = () => {
  const { orgId = '', code = '' } = useParams<{ orgId: string; code: string }>();
  const location = useLocation();
  const orgName = (location.state as { orgName?: string } | null)?.orgName;
  const [period] = useReportPeriod();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  // Period changes reset the page; both live in the URL (replace, other params kept).
  const setPeriodAndResetPage = (p: ReportPeriod) => {
    const next = new URLSearchParams(params);
    next.set('period', p.period);
    if (p.period === 'custom' && p.date_from && p.date_to) {
      next.set('from', p.date_from);
      next.set('to', p.date_to);
    } else {
      next.delete('from');
      next.delete('to');
    }
    next.delete('page');
    setParams(next, { replace: true });
  };
  const setPage = (n: number) => {
    const next = new URLSearchParams(params);
    if (n <= 1) next.delete('page'); else next.set('page', String(n));
    setParams(next, { replace: true });
  };

  const { data, isLoading, error, status, refetch } =
    useStaffAccountLedger(orgId, code, period, page, PAGE_SIZE);

  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const { entry, refetch: refetchEntry } = useStaffEntryDetail(openEntryId);
  useEffect(() => { setOpenEntryId(null); }, [code, page, reportPeriodQueryString(period)]);

  const linkState = { orgName };
  const backHref = `/internal/clients/${orgId}/reports?${reportPeriodQueryString(period)}`;
  const title = data ? `${data.account.code} · ${data.account.name}` : code;

  const lines: LedgerLine[] = data?.lines.results ?? [];
  // The line the drawer is open on: its counterparty is the server's current
  // value and refreshes with the ledger refetch after a save (no local mutation).
  const openLine = openEntryId ? lines.find((l) => l.entry_id === openEntryId) ?? null : null;
  // Immediate reflection (S69 E8): re-read the ledger page AND the open entry.
  const onEntryChanged = () => { refetch(); refetchEntry(); };
  const count = data?.lines.count ?? 0;
  const first = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = count === 0 ? 0 : first + lines.length - 1;

  return (
    <PageContainer
      title={title}
      subtitle={data ? `${humanize(data.account.type)} · ${data.period.label}` : 'Account ledger'}
      actions={<StaffBanner orgId={orgId} orgName={orgName} />}
    >
      <nav aria-label="Breadcrumb" className="text-[13px] text-white/50">
        <Link to="/internal/clients" className="hover:text-white">Assigned clients</Link>
        <span className="mx-1.5 text-white/20">›</span>
        <Link to={`/internal/clients/${orgId}/entries`} state={linkState} className="hover:text-white">
          {orgLabel(orgId, orgName)}
        </Link>
        <span className="mx-1.5 text-white/20">›</span>
        <Link to={backHref} state={linkState} className="hover:text-white">Reports</Link>
        <span className="mx-1.5 text-white/20">›</span>
        <span className={`text-white/80 ${MONO}`}>{title}</span>
      </nav>

      <div className="flex justify-end">
        <PeriodControls period={period} setPeriod={setPeriodAndResetPage} />
      </div>

      {isLoading && <CenteredSpinner label="Loading…" />}

      {!isLoading && status === 404 && (
        <EmptyState
          title="Account not found"
          description="This account does not exist for this client, or the client is not assigned to you."
        >
          <Link to={backHref} state={linkState} className="text-xs text-[#4DA6FF] hover:underline">
            ← Back to reports
          </Link>
        </EmptyState>
      )}

      {!isLoading && error && status !== 404 && (
        <ErrorBanner message={error} onRetry={refetch} />
      )}

      {!isLoading && data && !error && (
        <>
          <LedgerSummaryStrip
            data={data}
            exportSlot={
              <ExportBar kind="account" code={data.account.code} period={period} exportUrl={staffExportUrl(orgId)} />
            }
          />

          <LedgerTable
            lines={lines}
            expandedId={openEntryId}
            onRowToggle={setOpenEntryId}
            entry={entry}
            readOnly
            count={count}
            first={first}
            last={last}
            hasPrevious={!!data.lines.previous}
            hasNext={!!data.lines.next}
            onPrevious={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
            drawerActions={openLine ? (
              <StaffEntryActions
                orgId={orgId}
                entry={{
                  id: openLine.entry_id,
                  entry_number: openLine.entry_number,
                  counterparty: openLine.counterparty,
                }}
                onChanged={onEntryChanged}
              />
            ) : null}
            documentUrl={() => null}   // O-S69-17: no owner-lane call from the staff drawer
          />

          <Link to={backHref} state={linkState} className="inline-block text-[13px] font-medium text-[#4DA6FF] hover:underline">
            ← Back to reports
          </Link>
        </>
      )}
    </PageContainer>
  );
};
