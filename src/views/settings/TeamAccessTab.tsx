// Team & access tab (s24 U3 — D-S24-4/5). Owner-facing team management for the
// §14 14-D invite backend: GET /api/accounting/team/ + the invite/membership
// lifecycle actions. Entitlement gating happens in index.tsx (tab visibility);
// mutation controls additionally hide unless useOrgMe role is owner (the server
// enforces can_manage_org regardless). Wrapped api client (authenticated owner
// endpoints) — its interceptor RESOLVES non-401 errors to a response, so every
// call status-checks (never try/catch for the business error). Zero raw hex.
import { type FC, type FormEvent, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import api from '@/utils/api';
import { useOrgMe } from '@/hooks/useAccounts';
import { Section, Spinner } from './ui';

interface Member {
  id: string; email: string; first_name: string; last_name: string;
  role: string; joined_at: string; is_active: boolean;
}
interface Invite {
  id: string; email: string; status: string; created_at: string; expires_at: string;
}
interface TeamPayload { members: Member[]; invites: Invite[] }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

const initials = (m: Member) => {
  const a = (m.first_name?.[0] ?? '').toUpperCase();
  const b = (m.last_name?.[0] ?? '').toUpperCase();
  return (a + b) || m.email[0]?.toUpperCase() || '?';
};

const RoleTag: FC<{ role: string }> = ({ role }) =>
  role === 'owner' ? (
    <span className="rounded-md bg-[var(--color-primary-light)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">Owner</span>
  ) : (
    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Accountant</span>
  );

export const TeamAccessTab: FC<{ showSuccess: (m: string) => void; showError: (m: string) => void }> = ({
  showSuccess, showError,
}) => {
  const { role } = useOrgMe();
  const isOwner = role === 'owner';
  const { user } = useSelector((s: RootState) => s.auth);
  const myEmail = (user?.user?.email ?? user?.email ?? '').toLowerCase();

  const [data, setData]       = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail]           = useState('');
  const [inviting, setInviting]     = useState(false);
  const [inviteErr, setInviteErr]   = useState<string | null>(null);

  const [busy, setBusy]           = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchTeam = useCallback(() => {
    setLoading(true);
    api.get('/api/accounting/team/').then((res) => {
      if (res == null) return;
      if (res.status === 200) { setData(res.data); setError(null); }
      else { setData(null); setError(res.data?.detail ?? 'Failed to load team.'); }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const submitInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteErr(null);
    try {
      const res = await api.post('/api/accounting/invite/', { email });
      if (res?.status === 201) {
        setEmail(''); setShowInvite(false);
        showSuccess('Invitation sent.');
        fetchTeam();
      } else {
        // s23 error convention: field error, then detail, verbatim.
        setInviteErr(res?.data?.email?.[0] ?? res?.data?.detail ?? 'Could not send the invite.');
      }
    } catch {
      setInviteErr('Could not send the invite.');
    } finally {
      setInviting(false);
    }
  };

  const run = async (key: string, url: string, okMsg: string) => {
    setBusy((b) => new Set(b).add(key));
    try {
      const res = await api.post(url);
      if (res?.status === 200) { showSuccess(okMsg); fetchTeam(); }
      else showError(res?.data?.detail ?? 'That action could not be completed.');
    } catch {
      showError('That action could not be completed.');
    } finally {
      setBusy((b) => { const n = new Set(b); n.delete(key); return n; });
      setConfirmId(null);
    }
  };

  const members = data?.members ?? [];
  const invites = data?.invites ?? [];

  return (
    <Section
      title="Team & access"
      description="Invite your accountant to review the books. They join as an accountant — you stay the owner."
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center"><Spinner /></div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : (
        <div className="space-y-6">
          {/* Invite action / inline form */}
          {isOwner && (
            <div>
              {showInvite ? (
                <form onSubmit={submitInvite} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Accountant’s email</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="accountant@example.com"
                      className="h-[42px] flex-1 rounded-lg border border-gray-300 px-3.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={inviting}
                        className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                      >
                        {inviting && <Spinner light />}
                        Send invite
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowInvite(false); setInviteErr(null); }}
                        className="h-[42px] rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  {inviteErr && <p className="mt-2 text-sm text-red-600">{inviteErr}</p>}
                </form>
              ) : (
                <button
                  onClick={() => setShowInvite(true)}
                  className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Invite accountant
                </button>
              )}
            </div>
          )}

          {/* Members */}
          <div>
            <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">Members</h3>
            <div className="space-y-2">
              {members.map((m) => {
                const isYou = m.email.toLowerCase() === myEmail;
                const canRevoke = isOwner && m.role === 'accountant' && !isYou;
                const name = `${m.first_name} ${m.last_name ?? ''}`.trim() || m.email;
                return (
                  <div key={m.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-semibold text-[var(--color-primary)]">
                          {initials(m)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {name}{isYou && <span className="ml-1 text-gray-400">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-gray-500">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <RoleTag role={m.role} />
                        {canRevoke && confirmId !== m.id && (
                          <button
                            onClick={() => setConfirmId(m.id)}
                            className="text-sm font-medium text-red-600 transition-colors hover:text-red-700"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                    {canRevoke && confirmId === m.id && (
                      <div className="mt-3 flex flex-col gap-2 rounded-lg bg-red-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-red-700">Their access ends immediately; posted work remains.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => run(`revoke-${m.id}`, `/api/accounting/membership/${m.id}/revoke/`, 'Access revoked.')}
                            disabled={busy.has(`revoke-${m.id}`)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                          >
                            Revoke access
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Keep
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">Pending invites</h3>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">{inv.email}</p>
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 capitalize">{inv.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Invited {fmtDate(inv.created_at)} · expires {fmtDate(inv.expires_at)}
                      </p>
                    </div>
                    {isOwner && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => run(`resend-${inv.id}`, `/api/accounting/invite/${inv.id}/resend/`, 'Invite resent.')}
                          disabled={busy.has(`resend-${inv.id}`)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => run(`cancel-${inv.id}`, `/api/accounting/invite/${inv.id}/cancel/`, 'Invite cancelled.')}
                          disabled={busy.has(`cancel-${inv.id}`)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
};
