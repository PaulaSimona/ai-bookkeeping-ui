// New adjustment page (/accountant/adjustments/new, Session-25 Phase E/F). Page
// chrome around the shared AdjustmentForm, rendered UNSEEDED — identical behavior
// to before the Phase-F extraction: Cancel and a successful post both return to
// the ledger. The same form is embedded, seeded, in the JE drill-down drawer.
import { type FC, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgContext } from '@/context/OrgContext';
import { PageHeader } from '@/components/t2/PageHeader';
import { AdjustmentForm } from './AdjustmentForm';

const PageShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-[860px] px-6 py-8">{children}</div>
  </div>
);

const AdjustmentPage: FC = () => {
  const navigate = useNavigate();
  const { activeOrg } = useOrgContext();
  const toLedger = () => navigate('/accountant/ledger');
  return (
    <PageShell>
      <PageHeader
        title="New adjustment"
        subtitle={`${activeOrg?.org_name ?? 'This client'} · post a balanced correcting entry.`}
      />
      <div className="mt-6">
        <AdjustmentForm onPosted={toLedger} onCancel={toLedger} />
      </div>
    </PageShell>
  );
};

// Remount on client switch (fresh chart under the new X-Org-Id); prompt an
// unselected multi-client accountant to choose first.
export const NewAdjustment: FC = () => {
  const { activeOrgId, needsSelection } = useOrgContext();
  if (needsSelection) {
    return (
      <PageShell>
        <PageHeader title="New adjustment" subtitle="Choose a client from the sidebar first." />
      </PageShell>
    );
  }
  return <AdjustmentPage key={activeOrgId ?? 'none'} />;
};
