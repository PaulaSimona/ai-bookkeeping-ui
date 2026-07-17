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
import { Tier2UploadZone } from './documents/Tier2UploadZone';
import { DocumentStatusList, type DocumentStatusRow } from './documents/DocumentStatusList';

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
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload receipts and invoices — track what the accounting agent has
            done with each one.
          </p>
        </div>

        {/* Upload area */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Upload</h2>
          <Tier2UploadZone onUploaded={refetch} />
        </section>

        {/* Status list */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Document status</h2>
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
