// InternalClientAccountLedger (S69 E5-UI / E8, O-S69-9 / O-S69-15 / O-S69-16)
// — one account's posted lines for a client, as seen by staff. READ-ONLY, no
// impersonation: the ledger and the drawer's entry detail both come from the
// org-addressed staff endpoints (useStaffReports); the shared LedgerSummaryStrip
// / LedgerTable render exactly what the owner sees; the ExportBar downloads via
// the staff exportUrl. `drawerActions` holds the staff writes — on the chain's
// LIVE entry only (D-S85-13).
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
import { isLiveEntry } from '@/utils/entryStatus';
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
  // "Open JE-xxxx" in the drawer's chain panel re-targets the open drawer: it
  // then shows that entry, read by id from the staff detail endpoint. Toggling
  // a row goes back to the row's own entry.
  const [targetId, setTargetId] = useState<string | null>(null);
  const { entry, refetch: refetchEntry } = useStaffEntryDetail(targetId ?? openEntryId);
  const toggleRow = (entryId: string | null) => { setOpenEntryId(entryId); setTargetId(null); };
  useEffect(() => { setOpenEntryId(null); setTargetId(null); }, [code, page, reportPeriodQueryString(period)]);

  const linkState = { orgName };
  const backHref = `/internal/clients/${orgId}/reports?${reportPeriodQueryString(period)}`;
  const title = data ? `${data.account.code} · ${data.account.name}` : code;

  const lines: LedgerLine[] = data?.lines.results ?? [];
  // The entry the drawer shows, once its DETAIL has loaded. The staff writes
  // act on it — never on the ledger LINE, which carries no status, chain or
  // linkage — and only while it is the chain's live entry (D-S85-13). Its
  // counterparty is the server's current value and refreshes with the detail
  // re-read after a save (no local mutation).
  const shown = entry?.kind === 'ready' ? entry.row : null;
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
            onRowToggle={toggleRow}
            entry={entry}
            onOpenEntry={(ref) => setTargetId(ref.id)}
            readOnly
            count={count}
            first={first}
            last={last}
            hasPrevious={!!data.lines.previous}
            hasNext={!!data.lines.next}
            onPrevious={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
            drawerActions={shown && isLiveEntry(shown) ? (
              <StaffEntryActions
                orgId={orgId}
                entry={{
                  id: shown.id,
                  entry_number: shown.entry_number ?? null,
                  counterparty: shown.counterparty ?? null,
                  entry_number_display: shown.entry_number_display,
                  reverses_entry_id: shown.reverses_entry_id ?? null,
                  reversed_by_entry_id: shown.reversed_by_entry_id ?? null,
                  corrects_entry_id: shown.corrects_entry_id ?? null,
                  reverses_entry_number_display: shown.reverses_entry_number_display ?? null,
                  reversed_by_entry_number_display: shown.reversed_by_entry_number_display ?? null,
                  corrects_entry_number_display: shown.corrects_entry_number_display ?? null,
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
