// Tier 2 Documents page (§14 14A-3) — the owner/accountant view of what the
// accounting agent has done with each uploaded document. Its OWN data layer
// (the /api/accounting/documents/status/ endpoint); shares only the design
// system with Tier 1's /documents page, never its hooks or routes
// (MASTER_T2 §14–§15).
//
// Release E2 (O-S89-E7): the page takes the whole content width, and from
// the status heading down it is a flex column — the table's frame takes the
// remaining height and is the one thing that scrolls (both ways). The list's
// filters, page and open row live in the URL (useDocumentListState), so a
// round trip to another page and Back restores them.
//
// Wiring choice (D-14A3-6, A.7): usePaginatedList is LIFTED here rather than
// living inside DocumentStatusList, so the upload zone's onUploaded and the
// list share ONE refetch without a ref/imperative handle — that same refetch
// also drives the 30s freshness interval below. The list is presentational;
// its page follows the URL, and a page turn writes the URL.
//
// Two-layer gating mirrors the other Tier 2 pages: the route is wrapped in
// <RequireTier2> (§21 gate swap, D-21-4), and this page redirects on the real
// org-role check — same structural pattern as CardsPage.
import { type FC, type ReactNode, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrgMe } from '@/hooks/useAccounts';
import { documentTypeLabel, useDocumentList, useDocumentListState, type DocumentRow } from '@/hooks/useDocumentList';
import api from '@/utils/api';
import { useToast } from '@/hooks/useToast';
import { useCounterparties } from '@/hooks/useCounterparties';
import { PageLoader } from '@/components/Loader';
import { PageHeader } from '@/components/t2/PageHeader';
import { Card } from '@/components/t2/Card';
import { StatCard } from '@/components/t2/StatCard';
import { FilterChip } from '@/components/t2/FilterChip';
import { Tier2UploadZone } from './documents/Tier2UploadZone';
import { DocumentStatusList, badgeFor } from './documents/DocumentStatusList';
import { DocumentFilters } from './documents/DocumentFilters';
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
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
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

// A labelled field of the drawer: the term and, beside it, its value.
const Detail: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
    <dd className="break-words text-sm text-gray-900">{children}</dd>
  </div>
);

// The open row (O-S89-E7): a drawer over the right edge of the page with the
// document's fields as the server sent them, the document it duplicates (a
// way to open that one instead), and Open file (the signed URL, fetched on
// click only). Closing it takes the open row out of the URL.
const DocumentDrawer: FC<{
  row: DocumentRow;
  onOpen: (documentId: number | null) => void;
}> = ({ row, onOpen }) => {
  const { showToast } = useToast();
  const openFile = async () => {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const res = await api.get(`/api/accounting/documents/${row.document_id}/file-url/`);
      const url = res?.status === 200 ? res.data?.url : null;
      if (url) {
        if (tab) tab.location.href = url;
        else window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        if (tab) tab.close();
        showToast({ title: 'Could not open document', message: res?.data?.detail ?? 'Please try again in a moment.', variant: 'danger' });
      }
    } catch (e: any) {
      if (tab) tab.close();
      showToast({ title: 'Could not open document', message: e?.response?.data?.detail ?? 'Please try again in a moment.', variant: 'danger' });
    }
  };
  const duplicateWording = row.accounting_status === 'rejected' ? 'Already uploaded as' : 'Possible duplicate of';
  return (
    <section
      aria-label="Document detail"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white p-6 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold text-gray-900" title={row.display_name}>
          {row.display_name}
        </h3>
        <button type="button" onClick={() => onOpen(null)} aria-label="Close" className="text-gray-400 hover:text-gray-900">
          ✕
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3">
        <Detail label="Name">{row.display_name}</Detail>
        <Detail label="Filename">{row.name}</Detail>
        {row.counterparty && <Detail label="Supplier">{row.counterparty.name}</Detail>}
        {row.read_as && <Detail label="Read as">{row.read_as}</Detail>}
        <Detail label="Document date">{row.document_date ?? '—'}</Detail>
        <Detail label="Uploaded">{row.uploaded_at.slice(0, 10)}</Detail>
        <Detail label="Type">{documentTypeLabel(row.document_type)}</Detail>
        <Detail label="Total">{row.total != null ? `${row.total} ${row.currency ?? ''}`.trim() : '—'}</Detail>
        <Detail label="Status">{badgeFor(row).label}</Detail>
        {row.duplicate_of && (
          <Detail label="Duplicate of">
            {duplicateWording}{' '}
            <button
              type="button"
              onClick={() => onOpen(row.duplicate_of!.id)}
              className="font-semibold text-[var(--color-primary)] underline underline-offset-2"
            >
              {row.duplicate_of.name}
            </button>
          </Detail>
        )}
      </dl>
      <div className="mt-6">
        <button
          type="button"
          onClick={() => void openFile()}
          className="h-9 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:opacity-90"
        >
          Open file
        </button>
      </div>
    </section>
  );
};

export const DocumentsPage: FC = () => {
  const navigate = useNavigate();
  const { role, isLoading: orgLoading } = useOrgMe();
  const canView = role === 'owner' || role === 'accountant';

  // The list's state — filters, page, open row — lives in the URL (O-S89-E7).
  const { state, update, clear } = useDocumentListState();
  const statusFilter = state.status ?? null;

  // Lifted list state (see header). Hooks run unconditionally, before the
  // early returns below — the route gate already restricts this page to
  // staff/superuser, so the extra GET during org-load is benign.
  const {
    items, count, page, setPage, pageSize, isLoading, error, refetch,
  } = useDocumentList(state);

  // The list's page follows the URL; a page turn writes the URL (below).
  useEffect(() => {
    if (page !== state.page) setPage(state.page);
  }, [page, state.page, setPage]);

  // Filter-independent status counts for the stat tiles — page-local (the shared
  // hook drops the response's `counts`); refreshed on the same triggers as the
  // list, so tiles stay live but never move when a chip toggles.
  const { counts, refetch: refetchCounts } = useDocumentStatusCounts();

  // The supplier filter's options: the org's ACTIVE suppliers, every page of
  // them (the same list the Suppliers page manages).
  const suppliersList = useCounterparties({ role: 'supplier', archived: false });
  useEffect(() => {
    suppliersList.setPageSize(200);
  }, [suppliersList.setPageSize]);
  const suppliers = suppliersList.items.map((s) => ({ id: s.id, name: s.name }));

  // ONE lifted refresh drives both the list and the counts — preserves the
  // lifted-refetch structure (shared by the 30s interval and the upload zone).
  const refresh = useCallback(() => {
    refetch();
    refetchCounts();
  }, [refetch, refetchCounts]);

  // Single-select toggle: tap the active chip/tile to clear to All. A change
  // of filter goes back to page one (useDocumentListState).
  const toggleStatus = useCallback((value: string) => {
    update({ status: statusFilter === value ? undefined : value });
  }, [statusFilter, update]);

  // O-S30-2: the Total tile clears the status filter (unfiltered list).
  const clearStatus = useCallback(() => {
    update({ status: undefined });
  }, [update]);

  // The open row, from the page the list is showing (O-S89-E7).
  const openRow = state.open != null ? items.find((r) => r.document_id === state.open) ?? null : null;

  // Human label of the active chip (drives the filtered empty-state copy).
  const activeChipLabel = STATUS_CHIPS.find((c) => c.value === statusFilter)?.label ?? null;

  // Redirect members without accounting access — same structural pattern as
  // CardsPage (an effect, never a navigate() during render), gated on org role
  // (the backend enforces org membership on /documents/status/, not is_staff).
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
    <div className="flex h-full min-h-0 flex-col bg-gray-50 text-gray-900">
      <div className="flex min-h-0 flex-1 flex-col px-6 py-8" data-testid="documents-page">

        <PageHeader
          title="Documents"
          subtitle="Drop in a receipt or invoice — the accounting agent reads it, books it, and tracks it here."
        />

        {/* Top region: upload zone (left) + a static how-it-works helper (right,
            no data tiles). */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tier2UploadZone onUploaded={refresh} onOpenDocument={(id) => update({ open: id })} />
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

        {/* Status list + single-select filter chips. From here down the page
            is a flex column: the list's frame takes the remaining height. */}
        <section className="mt-8 flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-gray-500">
              Document status
            </h2>
            <StatusChips active={statusFilter} onToggle={toggleStatus} />
          </div>
          <div className="mb-3">
            <DocumentFilters
              filters={state}
              suppliers={suppliers}
              statusLabel={activeChipLabel}
              onChange={update}
              onClear={clear}
            />
          </div>
          <DocumentStatusList
            items={items}
            count={count}
            page={state.page}
            setPage={(n) => update({ page: n })}
            pageSize={pageSize}
            isLoading={isLoading}
            error={error}
            emptyMessage={
              activeChipLabel ? `No ${activeChipLabel.toLowerCase()} documents.` : undefined
            }
            onDeleted={refresh}
            open={state.open}
            onOpen={(id) => update({ open: id })}
          />
        </section>

        {/* The open row (O-S89-E7): the URL names it; the row comes from the
            page the list is showing. A row the page does not hold (another
            page, deleted) shows nothing. */}
        {openRow && <DocumentDrawer row={openRow} onOpen={(id) => update({ open: id })} />}

      </div>
    </div>
  );
};
