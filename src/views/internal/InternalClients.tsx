import { type FC, useEffect, useState } from 'react';
import api from '@/utils/api';
import {
  PageContainer,
  SectionCard,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
} from '@/components/internal/ui';

/**
 * Assigned clients.
 *
 * HONEST SUBSET (backend contract, not a design choice): the review-queue payload
 * (ReviewEntrySerializer) carries NO org/client identifier, so a per-client
 * rollup cannot be derived from it. The only client-name source is
 * GET /api/accounting/orgs/, which is super-user-only (can_administer → 403 for a
 * reviewer). So:
 *   • super user → the full client-organization list (from /orgs/);
 *   • reviewer   → an explicit note that per-client attribution is not available
 *     from the current backend contract (no reviewer-scoped clients endpoint).
 * No endpoint is invented.
 */

interface OrgRow {
  id: string;
  name: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'orgs'; rows: OrgRow[] }
  | { kind: 'reviewer' } // 403 from /orgs/ — expected for a non-super reviewer
  | { kind: 'error'; message: string };

export const InternalClients: FC = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [revision, setRevision] = useState(0);
  const refetch = () => setRevision((r) => r + 1);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    api
      .get('/api/accounting/orgs/')
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) {
          const rows = Array.isArray(res.data) ? (res.data as OrgRow[]) : [];
          setState({ kind: 'orgs', rows });
        } else if (res.status === 403) {
          setState({ kind: 'reviewer' });
        } else {
          setState({ kind: 'error', message: res.data?.detail ?? 'Failed to load clients.' });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error', message: 'Failed to load clients.' });
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  return (
    <PageContainer title="Assigned clients" subtitle="Client organizations under review.">
      {state.kind === 'loading' && (
        <SectionCard>
          <CenteredSpinner label="Loading clients…" />
        </SectionCard>
      )}

      {state.kind === 'error' && <ErrorBanner message={state.message} onRetry={refetch} />}

      {state.kind === 'reviewer' && (
        <SectionCard title="Per-client breakdown unavailable">
          <p className="text-sm text-white/60">
            The review queue does not expose per-client attribution, and there is no
            reviewer-scoped client list in the current backend contract. Your review scope is
            enforced server-side — the Pending queue already shows only entries from the
            organizations you are assigned to.
          </p>
        </SectionCard>
      )}

      {state.kind === 'orgs' &&
        (state.rows.length === 0 ? (
          <SectionCard>
            <EmptyState title="No client organizations" />
          </SectionCard>
        ) : (
          <SectionCard title={`Client organizations (${state.rows.length})`}>
            <div className="overflow-x-auto -m-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                    <th className="py-2 px-5 font-medium">Organization</th>
                    <th className="py-2 px-5 font-medium">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((o) => (
                    <tr key={o.id} className="border-b border-white/5">
                      <td className="py-2.5 px-5 text-white/90">{o.name}</td>
                      <td className="py-2.5 px-5 font-mono text-xs text-white/40">{o.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ))}
    </PageContainer>
  );
};
