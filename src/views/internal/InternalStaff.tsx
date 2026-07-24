import { type FC, useState } from 'react';
import {
  useStaffList,
  createStaffInvite,
  deactivateStaffAccount,
  type StaffListItem,
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
  humanizeCode,
} from '@/components/internal/ui';

const inputCls =
  'rounded-lg bg-[#0f172a] border border-white/15 px-3 py-2 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

const staffLabel = (s: StaffListItem): string =>
  s.staff_user_name?.trim() || s.staff_user_email?.trim() || s.staff_user;

export const InternalStaff: FC = () => {
  const staff = useStaffList();
  const { toast, showToast } = useToast();
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submitInvite = async () => {
    const value = email.trim();
    if (!value || inviting) return;
    setInviting(true);
    const res = await createStaffInvite(value);
    setInviting(false);
    if (res.ok) {
      showToast('Invite sent.', 'success');
      setEmail('');
      staff.refetch();
    } else {
      showToast(res.errorDetail ?? 'Failed to send invite.', 'error');
    }
  };

  const deactivate = async (s: StaffListItem) => {
    if (busyId) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Deactivate this staff account? This revokes all their access.`)) return;
    setBusyId(s.id);
    const res = await deactivateStaffAccount(s.staff_user);
    setBusyId(null);
    if (res.ok) {
      showToast('Staff account deactivated.', 'success');
      staff.refetch();
    } else {
      showToast(res.errorDetail ?? 'Failed to deactivate staff.', 'error');
    }
  };

  return (
    <PageContainer title="Staff" subtitle="Internal reviewer and super-user accounts.">
      <Toast toast={toast} />

      {staff.forbidden ? (
        <NotPermitted message="Staff administration is limited to super users." />
      ) : (
        <>
          <SectionCard title="Invite a reviewer" description="Emails a single-use invite link.">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[16rem]">
                <label className="block text-xs font-medium text-white/60 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
                  placeholder="reviewer@example.com"
                  className={`${inputCls} w-full`}
                />
              </div>
              <PrimaryButton onClick={submitInvite} disabled={!email.trim()} busy={inviting}>
                Send invite
              </PrimaryButton>
            </div>
          </SectionCard>

          {staff.error && <ErrorBanner message={staff.error} onRetry={staff.refetch} />}

          <SectionCard
            title={staff.isLoading ? 'Staff' : `Staff (${staff.data.length})`}
            className="overflow-hidden"
          >
            {staff.isLoading ? (
              <CenteredSpinner label="Loading staff…" />
            ) : staff.data.length === 0 && !staff.error ? (
              <EmptyState title="No staff accounts yet" />
            ) : (
              <div className="overflow-x-auto -m-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                      <th className="py-2 px-5 font-medium">Name</th>
                      <th className="py-2 px-3 font-medium">Email</th>
                      <th className="py-2 px-3 font-medium">Role</th>
                      <th className="py-2 px-3 font-medium">Capability</th>
                      <th className="py-2 px-3 font-medium">Status</th>
                      <th className="py-2 px-5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.data.map((s) => (
                      <tr key={s.id} className={`border-b border-white/5 ${s.is_active ? '' : 'opacity-50'}`}>
                        <td className="py-2.5 px-5 text-white/90">{staffLabel(s)}</td>
                        <td className="py-2.5 px-3 text-white/60">{s.staff_user_email || '—'}</td>
                        <td className="py-2.5 px-3 text-white/70">{humanizeCode(s.role_type)}</td>
                        <td className="py-2.5 px-3">
                          {s.is_super_user ? <Pill tone="info">Super user</Pill> : <Pill>Reviewer</Pill>}
                        </td>
                        <td className="py-2.5 px-3">
                          {s.is_active ? (
                            <Pill tone="success">Active</Pill>
                          ) : (
                            <Pill tone="danger">Inactive</Pill>
                          )}
                        </td>
                        <td className="py-2.5 px-5 text-right">
                          {s.is_active ? (
                            <SecondaryButton
                              tone="danger"
                              onClick={() => deactivate(s)}
                              disabled={busyId === s.id}
                            >
                              Deactivate
                            </SecondaryButton>
                          ) : (
                            <span className="text-xs text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </PageContainer>
  );
};
