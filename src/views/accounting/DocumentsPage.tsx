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
import { type FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgMe } from '@/hooks/useAccounts';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { PageLoader } from '@/components/Loader';
import { PageHeader } from '@/components/t2/PageHeader';
import { Card } from '@/components/t2/Card';
import { Tier2UploadZone } from './documents/Tier2UploadZone';
import { DocumentStatusList, type DocumentStatusRow } from './documents/DocumentStatusList';

// Static "how it works" copy for the right column — guidance, not data. The
// prototype's stat tiles / filter chips / Telegram promo are OMITTED (no data /
// out of scope — s22 B2), never mocked.
const STEPS: string[] = [
  'Drop in a receipt or invoice.',
  'The accounting agent reads and books it.',
  'Track each document’s status below.',
];

const FRESHNESS_MS = 30_000;

export const DocumentsPage: FC = () => {
  const navigate = useNavigate();
  const { role, isLoading: orgLoading } = useOrgMe();
  const canView = role === 'owner' || role === 'accountant';

  // Lifted list state (see header). Hooks run unconditionally, before the
  // early returns below — the route gate already restricts this page to
  // staff/superuser, so the extra GET during org-load is benign.
  const {
    items, count, page, setPage, pageSize, isLoading, error, refetch,
  } = usePaginatedList<DocumentStatusRow>('/api/accounting/documents/status/');

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
    const t = setInterval(refetch, FRESHNESS_MS);
    return () => clearInterval(t);
  }, [refetch]);

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
            <Tier2UploadZone onUploaded={refetch} />
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

        {/* Status list */}
        <section className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
            Document status
          </h2>
          <DocumentStatusList
            items={items}
            count={count}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            isLoading={isLoading}
            error={error}
          />
        </section>

      </div>
    </div>
  );
};
