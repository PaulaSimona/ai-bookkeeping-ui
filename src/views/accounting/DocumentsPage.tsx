// Tier 2 Documents page (§14 14A-3) — the owner/accountant view of what the
// accounting agent has done with each uploaded document. Its OWN data layer
// (the /api/accounting/documents/status/ endpoint, wired in commits 2–3);
// shares only the design system with Tier 1's /documents page, never its
// hooks or routes (MASTER_T2 §14–§15).
//
// Two-layer gating mirrors the other Tier 2 pages: the route is wrapped in
// <RequireStaffOrSuperuser> (interim), and this page redirects on the real
// org-role check — same structural pattern as AccountingReview.
// TODO: swap to Tier 2 subscription check when Advanced plan is live
import { type FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgMe } from '@/hooks/useAccounts';
import { PageLoader } from '@/components/Loader';
import { Tier2UploadZone } from './documents/Tier2UploadZone';

export const DocumentsPage: FC = () => {
  const navigate = useNavigate();
  const { role, isLoading: orgLoading } = useOrgMe();
  const canView = role === 'owner' || role === 'accountant';

  // Redirect members without accounting access — same structural pattern as
  // AccountingReview, gated on org role (the backend enforces org membership
  // on /documents/status/, not is_staff).
  useEffect(() => {
    if (!orgLoading && !canView) {
      navigate('/dashboard', { replace: true });
    }
  }, [orgLoading, canView, navigate]);

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
          {/* onUploaded wired to the status-list refetch in commit 3 */}
          <Tier2UploadZone onUploaded={() => {}} />
        </section>

        {/* Status list — filled by commit 3 */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Document status</h2>
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6" />
        </section>

      </div>
    </div>
  );
};
