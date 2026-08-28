// Tier 2 Documents page (§14 14A-3) — the owner/accountant view of what the
// accounting agent has done with each uploaded document. Its OWN data layer
// (the /api/accounting/documents/status/ endpoint); shares only the design
// system with Tier 1's /documents page, never its hooks or routes
// (MASTER_T2 §14–§15).
//
// Wiring choice (D-14A3-6, A.7): usePaginatedList is LIFTED here rather than
// living inside DocumentStatusList, so the upload zone's onUploaded and the
// list share ONE refetch without a ref/imperative handle — that same refetch
// also drives the 30s freshness interval below. The list is presentational.
//
// Two-layer gating mirrors the other Tier 2 pages: the route is wrapped in
// <RequireStaffOrSuperuser> (interim), and this page redirects on the real
// org-role check — same structural pattern as AccountingReview.
// TODO: swap to Tier 2 subscription check when Advanced plan is live
import { type FC, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrgMe } from '@/hooks/useAccounts';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { PageLoader } from '@/components/Loader';
import { PageHeader } from '@/components/t2/PageHeader';
import { Card } from '@/components/t2/Card';
import { StatCard } from '@/components/t2/StatCard';
import { FilterChip } from '@/components/t2/FilterChip';
import { Tier2UploadZone } from './documents/Tier2UploadZone';
import { DocumentStatusList, type DocumentStatusRow } from './documents/DocumentStatusList';
import {
  useDocumentStatusCounts,
  type DocumentStatusCounts,
} from './documents/useDocumentStatusCounts';

// Static "how it works" copy for the right column — guidance, not data.
const STEPS: string[] = [
  'Drop in a receipt or invoice.',
  'The accounting agent reads and books it.',
  'Track each document’s status below.',
];

const FRESHNESS_MS = 30_000;

// The DocumentAccountingState statuses — chip set + tile order (14-C-4 U2, C2
// contract). "All" is the no-chip / no-param state (tap an active chip to clear),
// never a status value. O-S30-1/-2: not_source_document joins the set as the
// seventh status (its own tile + filter chip; the backend ?status= allow-list
// already accepts it post-0037).
const STATUS_CHIPS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'posted', label: 'Posted' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'not_source_document', label: 'Not source docs' },
];

const ZERO_COUNTS: DocumentStatusCounts = {
  pending: 0, processing: 0, posted: 0,
  needs_review: 0, failed: 0, rejected: 0, not_source_document: 0, total: 0,
};

// O-S30-2: a stat tile that is ALSO a filter CTA. Wraps the presentational
// StatCard (kept pure — no onClick on the shared t2 component) in a real button
// so it is keyboard-focusable; aria-pressed reflects the active filter, and the
// ring is the visible affordance (hover on inactive, solid on selected).
const TileButton: FC<{
  label: string; value: string; selected: boolean; onClick: () => void;
}> = ({ label, value, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`block w-full rounded-2xl text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
      selected ? 'ring-2 ring-[var(--color-primary)]' : 'hover:ring-1 hover:ring-gray-300'
    }`}
  >
    <StatCard label={label} value={value} />
  </button>
);

// Stat tiles as filter CTAs (O-S30-2). Tiles and chips share ONE filter state
// (`active`): a status tile toggles its filter (tap the active one → All, same
// as its chip); the Total tile clears to the unfiltered list. Counts are
// filter-independent (server-guaranteed) — the tile VALUES never move on a
// toggle. D2: lg:grid-cols-4 → two tidy rows of 4 on desktop (8 tiles never
// overflow); sm:grid-cols-4 already matches that rhythm.
const StatTiles: FC<{
  counts: DocumentStatusCounts;
  active: string | null;
  onToggle: (v: string) => void;
  onClear: () => void;
}> = ({ counts, active, onToggle, onClear }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
    <TileButton
      label="Total"
      value={String(counts.total)}
      selected={active === null}
      onClick={onClear}
    />
    {STATUS_CHIPS.map((s) => (
      <TileButton
        key={s.value}
        label={s.label}
        value={String(counts[s.value as keyof DocumentStatusCounts])}
        selected={active === s.value}
        onClick={() => onToggle(s.value)}
      />
    ))}
  </div>
);

// Single-select status chips; tapping the active chip clears to All (no param).
const StatusChips: FC<{ active: string | null; onToggle: (v: string) => void }> = ({
  active, onToggle,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    {STATUS_CHIPS.map((s) => (
      <FilterChip key={s.value} active={active === s.value} onClick={() => onToggle(s.value)}>
        {s.label}
      </FilterChip>
    ))}
  </div>
);

export const DocumentsPage: FC = () => {
  const navigate = useNavigate();
  const { role, isLoading: orgLoading } = useOrgMe();
  const canView = role === 'owner' || role === 'accountant';

  // Active status chip (null = All). Threaded into the SHARED usePaginatedList
  // via its existing optional `params` arg — no hook edit, so other callers are
  // untouched. Changing it re-fetches (the hook keys the effect on the params),
  // and refetch() below always carries the current status.
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Lifted list state (see header). Hooks run unconditionally, before the
  // early returns below — the route gate already restricts this page to
  // staff/superuser, so the extra GET during org-load is benign.
  const {
    items, count, page, setPage, pageSize, isLoading, error, refetch,
  } = usePaginatedList<DocumentStatusRow>(
    '/api/accounting/documents/status/',
    statusFilter ? { status: statusFilter } : undefined,
  );

  // Filter-independent status counts for the stat tiles — page-local (the shared
  // hook drops the response's `counts`); refreshed on the same triggers as the
  // list, so tiles stay live but never move when a chip toggles.
  const { counts, refetch: refetchCounts } = useDocumentStatusCounts();

  // ONE lifted refresh drives both the list and the counts — preserves the
  // lifted-refetch structure (shared by the 30s interval and the upload zone).
  const refresh = useCallback(() => {
    refetch();
    refetchCounts();
  }, [refetch, refetchCounts]);

  // Single-select toggle: tap the active chip/tile to clear to All. Reset to page 1.
  const toggleStatus = useCallback((value: string) => {
    setStatusFilter((cur) => (cur === value ? null : value));
    setPage(1);
  }, [setPage]);

  // O-S30-2: the Total tile clears the filter (unfiltered list). Reset to page 1.
  const clearStatus = useCallback(() => {
    setStatusFilter(null);
    setPage(1);
  }, [setPage]);

  // Human label of the active chip (drives the filtered empty-state copy).
  const activeChipLabel = STATUS_CHIPS.find((c) => c.value === statusFilter)?.label ?? null;

  // Redirect members without accounting access — same structural pattern as
  // AccountingReview, gated on org role (the backend enforces org membership
  // on /documents/status/, not is_staff).
  useEffect(() => {
    if (!orgLoading && !canView) {
      navigate('/dashboard', { replace: true });
    }
  }, [orgLoading, canView, navigate]);

  // Freshness (D-14A3-6): agent processing is asynchronous, so poll the status
  // list every 30s; cleared on unmount.
  useEffect(() => {
    const t = setInterval(refresh, FRESHNESS_MS);
    return () => clearInterval(t);
  }, [refresh]);

  if (orgLoading) return <PageLoader />;
  if (!canView) return null; // redirect in flight — don't flash the page

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">

        <PageHeader
          title="Documents"
          subtitle="Drop in a receipt or invoice — the accounting agent reads it, books it, and tracks it here."
        />

        {/* Top region: upload zone (left) + a static how-it-works helper (right,
            no data tiles). */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tier2UploadZone onUploaded={refresh} />
          </div>
          <Card padding className="lg:col-span-1">
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
              How it works
            </div>
            <ol className="mt-3 space-y-3">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-gray-600">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[11px] font-semibold text-[var(--color-primary)]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Stat tiles (Total + statuses) — filter-independent counts. */}
        <div className="mt-6">
          <StatTiles
            counts={counts ?? ZERO_COUNTS}
            active={statusFilter}
            onToggle={toggleStatus}
            onClear={clearStatus}
          />
        </div>

        {/* O-S30-1 / F-S30-7: when any bank/credit-card statement was refused on
            the document path, tell the owner where those transactions belong.
            Trigger is the org-wide, filter-independent count (D1) — not the
            current page's rows. OnboardingGate amber tokens. */}
        {(counts?.not_source_document ?? 0) > 0 && (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span className="flex-1">
              Bank statements aren't source documents — the agent doesn't book them.
              Connect your bank or add these transactions in Bank Transactions.
            </span>
            <Link
              to="/accounting/bank-connections"
              className="shrink-0 font-semibold text-amber-900 underline hover:text-amber-700"
            >
              Bank Transactions
            </Link>
          </div>
        )}

        {/* Status list + single-select filter chips. */}
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-gray-500">
              Document status
            </h2>
            <StatusChips active={statusFilter} onToggle={toggleStatus} />
          </div>
          <DocumentStatusList
            items={items}
            count={count}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            isLoading={isLoading}
            error={error}
            emptyMessage={
              activeChipLabel ? `No ${activeChipLabel.toLowerCase()} documents.` : undefined
            }
            onDeleted={refresh}
          />
        </section>

      </div>
    </div>
  );
};
