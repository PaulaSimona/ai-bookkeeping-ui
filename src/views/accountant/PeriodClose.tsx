// Period close (/accountant/close, Session-25 Phase E, U3). Renders ONLY the
// year-end-close GET shapes — {closable, fiscal_year, blockers} — then confirms
// the close via POST with calm error mapping. No draft closing-entry panel and
// no invented figures (the endpoint returns none — Phase E owner ruling). The
// 90-day auto-close sentence is static info copy (the auto-close cron is real).
// Own data layer; tokens only, no hex.
import { type FC, type ReactNode, useState } from 'react';
import { useOrgContext } from '@/context/OrgContext';
import { useToast } from '@/hooks/useToast';
import { PageHeader } from '@/components/t2/PageHeader';
import { Card } from '@/components/t2/Card';
import { StatusBadge } from '@/components/t2/StatusBadge';
import { PageLoader } from '@/components/Loader';
import { useYearEndClose, postYearEndClose, type Blocker } from './hooks/useYearEndClose';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

const PageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-3xl px-6 py-8">{children}</div>
  </div>
);

// One precondition row. `detail` is the human-readable blocker text; the raw
// code/count are not shown.
const BlockerRow: FC<{ detail: string }> = ({ detail }) => (
  <li className="flex items-start gap-2.5 text-[13.5px] text-gray-700">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
    {detail}
  </li>
);

const CloseInner: FC = () => {
  const { activeOrg } = useOrgContext();
  const { showToast } = useToast();
  const { status, isLoading, error, refetch } = useYearEndClose();

  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [liveBlockers, setLiveBlockers] = useState<Blocker[] | null>(null);

  if (isLoading) return <PageLoader />;

  const header = (
    <PageHeader
      title="Period close"
      subtitle={`${activeOrg?.org_name ?? 'This client'} · close the oldest open fiscal year.`}
    />
  );

  if (error) {
    return (
      <PageShell>
        {header}
        <Card padding className="mt-6"><p className="text-sm text-red-600">{error}</p></Card>
      </PageShell>
    );
  }

  const fy = status?.fiscal_year ?? null;
  const blockers = liveBlockers ?? status?.blockers ?? [];
  const closable = !!status?.closable && blockers.length === 0;
  const yearLabel = fy ? fy.end.slice(0, 4) : '';

  const doClose = async () => {
    if (!fy) return;
    setPosting(true);
    setPostError(null);
    setLiveBlockers(null);
    try {
      const res = await postYearEndClose(fy.end);
      if (res?.status === 201) {
        showToast({
          title: 'Fiscal year closed',
          message: 'The closing entry is posted and the year is locked.',
          variant: 'success',
        });
        refetch();
      } else if (res?.status === 422) {
        setLiveBlockers(res.data?.blockers ?? []);
        setPostError('This year can’t be closed yet — see the checklist.');
      } else if (res?.status === 409) {
        // already_closed / stale_close_request — the state moved; refresh.
        setPostError(res.data?.detail ?? 'This year’s close state changed — refreshing.');
        refetch();
      } else {
        setPostError(res?.data?.detail ?? 'The year could not be closed.');
      }
    } catch (e: any) {
      setPostError(e?.response?.data?.detail ?? 'The year could not be closed.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <PageShell>
      {header}

      {!fy ? (
        <Card padding className="mt-6">
          <p className="text-sm text-gray-500">No fiscal year is open to close right now.</p>
        </Card>
      ) : (
        <Card padding className="mt-6 space-y-5">
          {/* Closable year card */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
                Oldest open fiscal year
              </div>
              <div className="mt-1 text-[18px] font-semibold text-gray-900">
                {fmtDate(fy.start)} – {fmtDate(fy.end)}
              </div>
            </div>
            {closable
              ? <StatusBadge variant="success">Ready to close</StatusBadge>
              : <StatusBadge variant="warning">Not ready</StatusBadge>}
          </div>

          {/* Precondition checklist */}
          {closable ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-[13.5px] text-emerald-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              All preconditions met — this year is ready to close.
            </div>
          ) : (
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
                Before closing
              </div>
              <ul className="mt-2 space-y-2">
                {blockers.map((b) => <BlockerRow key={b.code} detail={b.detail} />)}
              </ul>
            </div>
          )}

          {postError && <p className="text-sm text-red-600">{postError}</p>}

          {/* Confirm step */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-5">
            <p className="text-[12.5px] text-gray-400">Closing posts a locking entry — it can’t be undone.</p>
            <button
              type="button"
              onClick={doClose}
              disabled={!closable || posting}
              className="rounded-lg bg-[var(--color-navy)] px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {posting ? 'Closing…' : `Close fiscal year ${yearLabel}`}
            </button>
          </div>
        </Card>
      )}

      {/* Static info panel — next-year unlock + 90-day auto-close (the cron is real). */}
      <Card padding className="mt-4 bg-gray-50">
        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">How closing works</div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600">
          Closing locks this fiscal year — new entries post to the next year, which opens automatically.
          Any fiscal year left open is closed automatically 90 days after it ends.
        </p>
      </Card>
    </PageShell>
  );
};

export const PeriodClose: FC = () => {
  const { activeOrgId, needsSelection } = useOrgContext();
  if (needsSelection) {
    return (
      <PageShell>
        <PageHeader title="Period close" subtitle="Choose a client from the sidebar first." />
      </PageShell>
    );
  }
  return <CloseInner key={activeOrgId ?? 'none'} />;
};
