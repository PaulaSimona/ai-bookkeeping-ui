import { type FC, useMemo, useState } from 'react';
import {
  useAssignments,
  useStaffList,
  useOrgsList,
  assignReviewer,
  deactivateAssignment,
  type AssignmentListItem,
} from '@/hooks/useInternalAdmin';
import {
  PageContainer,
  SectionCard,
  Pill,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  NotPermitted,
  PrimaryButton,
  SecondaryButton,
  Toast,
  useToast,
} from '@/components/internal/ui';

const selectCls =
  'rounded-lg bg-[#0f172a] border border-white/15 px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

const reviewerLabel = (a: AssignmentListItem): string =>
  a.staff_user_name?.trim() || a.staff_user_email?.trim() || a.staff_user;

export const InternalAssignments: FC = () => {
  const assignments = useAssignments();
  const staff = useStaffList();
  const orgs = useOrgsList();
  const { toast, showToast } = useToast();

  const [staffId, setStaffId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Reviewers worth assigning = active staff (super users reach every org by
  // capability and need no assignment row).
  const reviewerOptions = useMemo(
    () => staff.data.filter((s) => s.is_active && !s.is_super_user),
    [staff.data],
  );

  const active = assignments.data.filter((a) => a.is_active);
  const inactive = assignments.data.filter((a) => !a.is_active);

  const submitAssign = async () => {
    if (!staffId || !orgId || submitting) return;
    setSubmitting(true);
    const res = await assignReviewer(staffId, orgId);
    setSubmitting(false);
    if (res.ok) {
      showToast('Reviewer assigned.', 'success');
      setStaffId('');
      setOrgId('');
      assignments.refetch();
    } else {
      showToast(res.errorDetail ?? 'Failed to assign reviewer.', 'error');
    }
  };

  const revoke = async (a: AssignmentListItem) => {
    if (busyKey) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Revoke ${reviewerLabel(a)}'s access to ${a.org_name || a.org_id}?`)) return;
    setBusyKey(a.id);
    const res = await deactivateAssignment(a.staff_user, a.org_id);
    setBusyKey(null);
    if (res.ok) {
      showToast('Assignment revoked.', 'success');
      assignments.refetch();
    } else {
      showToast(res.errorDetail ?? 'Failed to revoke assignment.', 'error');
    }
  };

  return (
    <PageContainer title="Assignments" subtitle="Reviewer access to client organizations.">
      <Toast toast={toast} />

      {assignments.forbidden ? (
        <NotPermitted message="Assignment administration is limited to super users." />
      ) : (
        <>
          <SectionCard title="Assign a reviewer" description="Grants a reviewer access to one client org.">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[14rem]">
                <label className="block text-xs font-medium text-white/60 mb-1">Reviewer</label>
                <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="">{staff.isLoading ? 'Loading…' : 'Select a reviewer…'}</option>
                  {reviewerOptions.map((s) => (
                    <option key={s.id} value={s.staff_user}>
                      {s.staff_user_name?.trim() || s.staff_user_email || s.staff_user}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[14rem]">
                <label className="block text-xs font-medium text-white/60 mb-1">Organization</label>
                <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="">{orgs.isLoading ? 'Loading…' : 'Select an organization…'}</option>
                  {orgs.data.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <PrimaryButton onClick={submitAssign} disabled={!staffId || !orgId} busy={submitting}>
                Assign
              </PrimaryButton>
            </div>
            {(staff.error || orgs.error) && (
              <p className="mt-2 text-xs text-red-300">{staff.error ?? orgs.error}</p>
            )}
          </SectionCard>

          {assignments.error && <ErrorBanner message={assignments.error} onRetry={assignments.refetch} />}

          <SectionCard
            title={assignments.isLoading ? 'Active assignments' : `Active assignments (${active.length})`}
            className="overflow-hidden"
          >
            {assignments.isLoading ? (
              <CenteredSpinner label="Loading assignments…" />
            ) : active.length === 0 && !assignments.error ? (
              <EmptyState title="No active assignments" />
            ) : (
              <div className="overflow-x-auto -m-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                      <th className="py-2 px-5 font-medium">Reviewer</th>
                      <th className="py-2 px-3 font-medium">Organization</th>
                      <th className="py-2 px-3 font-medium">Assigned</th>
                      <th className="py-2 px-5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((a) => (
                      <tr key={a.id} className="border-b border-white/5">
                        <td className="py-2.5 px-5 text-white/90">{reviewerLabel(a)}</td>
                        <td className="py-2.5 px-3 text-white/70">{a.org_name || a.org_id}</td>
                        <td className="py-2.5 px-3 text-white/50">{a.assigned_at?.slice(0, 10) ?? '—'}</td>
                        <td className="py-2.5 px-5 text-right">
                          <SecondaryButton tone="danger" onClick={() => revoke(a)} disabled={busyKey === a.id}>
                            Revoke
                          </SecondaryButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {inactive.length > 0 && (
            <SectionCard title={`History (${inactive.length})`} className="overflow-hidden">
              <div className="overflow-x-auto -m-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                      <th className="py-2 px-5 font-medium">Reviewer</th>
                      <th className="py-2 px-3 font-medium">Organization</th>
                      <th className="py-2 px-3 font-medium">Revoked</th>
                      <th className="py-2 px-5 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactive.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 opacity-50">
                        <td className="py-2.5 px-5 text-white/80">{reviewerLabel(a)}</td>
                        <td className="py-2.5 px-3 text-white/60">{a.org_name || a.org_id}</td>
                        <td className="py-2.5 px-3 text-white/40">{a.deactivated_at?.slice(0, 10) ?? '—'}</td>
                        <td className="py-2.5 px-5 text-right">
                          <Pill tone="danger">Inactive</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </PageContainer>
  );
};
