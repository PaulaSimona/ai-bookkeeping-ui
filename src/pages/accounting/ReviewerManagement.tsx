import { type FC, useState } from 'react';
import {
  useOrgsList,
  useStaffList,
  useAssignments,
  assignReviewer,
  deactivateAssignment,
  createStaffInvite,
  type AssignmentListItem,
  type ConsoleError,
} from '@/hooks/useStaffConsole';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Friendly inline messages for the two write actions (status → text).
function mapAssignError(e: ConsoleError | null): string {
  switch (e?.status) {
    case 409: return 'That reviewer is already assigned to this org.';
    case 404: return 'Staff user or org not found.';
    case 400: return 'Invalid request.';
    case 403: return 'Not authorized.';
    default:  return e?.detail || 'Failed to assign reviewer.';
  }
}
function mapRevokeError(e: ConsoleError | null): string {
  switch (e?.status) {
    case 409: return 'No active assignment to revoke.';
    case 404: return 'Staff user or org not found.';
    case 403: return 'Not authorized.';
    default:  return e?.detail || 'Failed to revoke assignment.';
  }
}

// ─── Shared primitives (Tailwind, dark theme — matches the other Tier 2 pages) ──

const inputCls =
  'w-full rounded-lg border border-white/15 bg-[#0f172a] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed';

const Card: FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title, subtitle, children,
}) => (
  <div className="rounded-2xl bg-[#0A1628] border border-white/10">
    <div className="px-6 py-5 border-b border-white/10">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-white/40">{subtitle}</p>}
    </div>
    <div className="px-6 py-6">{children}</div>
  </div>
);

const Pill: FC<{ tone: 'green' | 'gray' | 'blue'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    gray:  'bg-white/5 text-white/40 border-white/10',
    blue:  'bg-[#0066FF]/10 text-[#5b9bff] border-[#0066FF]/20',
  }[tone];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${cls}`}>
      {children}
    </span>
  );
};

const ErrorBanner: FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center gap-3">
    <p className="flex-1 text-sm text-red-400">{message}</p>
    <button onClick={onRetry} className="text-xs text-red-400 hover:text-red-300 underline">
      Retry
    </button>
  </div>
);

const SkeletonRows: FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-9 w-full bg-white/8 rounded animate-pulse" />
    ))}
  </div>
);

// ─── Toast ──────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: 'success' | 'error' }

const Toast: FC<{ toast: ToastState | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-lg ${
      toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
    }`}>
      {toast.message}
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const ReviewerManagement: FC = () => {
  const orgs = useOrgsList();
  const staff = useStaffList();
  const assignments = useAssignments();

  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: ToastState['type']) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Graceful 403 (FIRST): the route guard is a client proxy; the backend
  // 403 (can_administer) is the real gate. If any list came back 403, degrade
  // to a calm not-authorized card and render nothing else.
  const forbidden = [orgs.error, staff.error, assignments.error].some((e) => e?.status === 403);
  if (forbidden) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="rounded-2xl bg-[#0A1628] border border-white/10 px-6 py-10 text-center">
            <h1 className="text-lg font-semibold text-white">You don't have permission to manage reviewers.</h1>
            <p className="mt-2 text-sm text-white/40">This console is available to super users only.</p>
          </div>
        </div>
      </div>
    );
  }

  const activeStaff = staff.data.filter((s) => s.is_active);
  const activeAssignments = assignments.data.filter((a) => a.is_active);

  const handleAssign = async () => {
    if (!selectedStaff || !selectedOrg || isSubmitting) return;
    setIsSubmitting(true);
    const res = await assignReviewer({ staff_user_id: selectedStaff, org_id: selectedOrg });
    setIsSubmitting(false);
    if (res.ok) {
      showToast('Reviewer assigned.', 'success');
      setSelectedStaff('');
      setSelectedOrg('');
      // Don't trust the POST body (enriched fields come back empty) — refetch the list.
      assignments.refetch();
    } else {
      showToast(mapAssignError(res.errors), 'error');
    }
  };

  const handleRevoke = async (row: AssignmentListItem) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const res = await deactivateAssignment({ staff_user_id: row.staff_user, org_id: row.org_id });
    setIsSubmitting(false);
    if (res.ok) {
      showToast('Assignment revoked.', 'success');
      assignments.refetch();
    } else {
      showToast(mapRevokeError(res.errors), 'error');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || isInviting) return;
    setIsInviting(true);
    const res = await createStaffInvite(inviteEmail);
    setIsInviting(false);
    if (res.ok) {
      // No refetch: acceptance (not invite) creates the StaffProfile, so the
      // Staff table doesn't change here — just confirm and clear.
      showToast(`Invite sent to ${inviteEmail}.`, 'success');
      setInviteEmail('');
    } else {
      // Backend details are already human-readable (409 existing-account, 403 not-authorized).
      showToast(res.errors?.detail ?? 'Failed to send invite.', 'error');
    }
  };

  const assignFormLoading = orgs.isLoading || staff.isLoading;
  const assignFormError = orgs.error || staff.error; // non-403 here (403 handled above)

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <Toast toast={toast} />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Reviewer Management</h1>
          <p className="mt-1 text-sm text-white/50">
            Assign internal reviewers to client organizations and revoke access.
          </p>
        </div>

        {/* 1 — Invite form (super user emails a single-use invite; email only) */}
        <Card title="Invite a staff reviewer" subtitle="Email a single-use invite. New reviewers set their own password on accept.">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-white/60 mb-1.5">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="reviewer@example.com"
                className={inputCls}
              />
            </div>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail || isInviting}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors shrink-0"
            >
              {isInviting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Send invite
            </button>
          </div>
        </Card>

        {/* 2 — Assign form */}
        <Card title="Assign a reviewer" subtitle="Grant a staff reviewer access to a client organization.">
          {assignFormError ? (
            <ErrorBanner
              message={assignFormError.detail}
              onRetry={() => { orgs.refetch(); staff.refetch(); }}
            />
          ) : assignFormLoading ? (
            <SkeletonRows rows={2} />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-white/60 mb-1.5">Reviewer</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select reviewer —</option>
                  {activeStaff.map((s) => (
                    <option key={s.staff_user} value={s.staff_user}>
                      {s.staff_user_name || s.staff_user_email || s.staff_user}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-white/60 mb-1.5">Organization</label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select organization —</option>
                  {orgs.data.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAssign}
                disabled={!selectedStaff || !selectedOrg || isSubmitting}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors shrink-0"
              >
                {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Assign reviewer
              </button>
            </div>
          )}
        </Card>

        {/* 3 — Active assignments */}
        <Card title="Active assignments" subtitle="Reviewers currently assigned to organizations.">
          {assignments.error ? (
            <ErrorBanner message={assignments.error.detail} onRetry={assignments.refetch} />
          ) : assignments.isLoading ? (
            <SkeletonRows rows={3} />
          ) : activeAssignments.length === 0 ? (
            <p className="text-sm text-white/40 py-4 text-center">No active assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Reviewer</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Org</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Assigned</th>
                    <th className="px-3 py-2.5 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {activeAssignments.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="px-3 py-2.5 text-sm text-white">
                        {row.staff_user_name || row.staff_user_email || row.staff_user}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-white/70">{row.org_name || row.org_id}</td>
                      <td className="px-3 py-2.5 text-sm text-white/50">{fmtDate(row.assigned_at)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => handleRevoke(row)}
                          disabled={isSubmitting}
                          className="rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 4 — Staff overview (read-only) */}
        <Card title="Staff" subtitle="Internal staff who can be assigned as reviewers.">
          {staff.error ? (
            <ErrorBanner message={staff.error.detail} onRetry={staff.refetch} />
          ) : staff.isLoading ? (
            <SkeletonRows rows={3} />
          ) : staff.data.length === 0 ? (
            <p className="text-sm text-white/40 py-4 text-center">No staff profiles yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Super user</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Role type</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.data.map((s) => (
                    <tr key={s.id} className="border-b border-white/5">
                      <td className="px-3 py-2.5 text-sm text-white">{s.staff_user_name || '—'}</td>
                      <td className="px-3 py-2.5 text-sm text-white/70">{s.staff_user_email || '—'}</td>
                      <td className="px-3 py-2.5">
                        {s.is_super_user ? <Pill tone="blue">Super user</Pill> : <span className="text-white/30 text-sm">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-white/70">{s.role_type}</td>
                      <td className="px-3 py-2.5">
                        {s.is_active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Inactive</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
