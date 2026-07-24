import { type FC, useState } from 'react';
import {
  useReviewQueue,
  approveEntry,
  rejectCorrect,
  type ReviewEntry,
  type RejectCorrectPayload,
} from '@/hooks/useInternalReview';
import {
  PageContainer,
  SectionCard,
  Pill,
  CenteredSpinner,
  EmptyState,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  Toast,
  useToast,
  formatMoney,
  formatAge,
  humanizeCode,
} from '@/components/internal/ui';
import { RejectCorrectEditor } from './RejectCorrectEditor';

const confidencePct = (c: ReviewEntry['confidence']): string => {
  if (c == null || c === '') return '—';
  const n = typeof c === 'number' ? c : Number(c);
  if (Number.isNaN(n)) return String(c);
  return `${Math.round(n * 100)}%`;
};

const entryTitle = (e: ReviewEntry): string =>
  e.description?.trim() || e.entry_number || `Entry ${e.id.slice(0, 8)}`;

type Mode = 'view' | 'confirmApprove' | 'reject';

const DetailPane: FC<{
  entry: ReviewEntry;
  onResolved: () => void;
  onClose: () => void;
  notify: (m: string, t: 'success' | 'error') => void;
}> = ({ entry, onResolved, onClose, notify }) => {
  const [mode, setMode] = useState<Mode>('view');
  const [submitting, setSubmitting] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const doApprove = async () => {
    setSubmitting(true);
    setErrorDetail(null);
    const res = await approveEntry(entry.id);
    setSubmitting(false);
    if (res.ok) {
      notify('Entry approved and posted.', 'success');
      onResolved();
    } else {
      setErrorDetail(res.errorDetail ?? 'Approval failed.');
      setMode('view');
    }
  };

  const doReject = async (payload: RejectCorrectPayload) => {
    setSubmitting(true);
    setErrorDetail(null);
    const res = await rejectCorrect(entry.id, payload);
    setSubmitting(false);
    if (res.ok) {
      notify('Correction posted; original replaced.', 'success');
      onResolved();
    } else {
      setErrorDetail(res.errorDetail ?? 'Reject & correct failed.');
    }
  };

  return (
    <SectionCard
      title={entryTitle(entry)}
      description={`${entry.org_name ?? '—'} · ${entry.entry_number ?? '—'} · ${entry.entry_date ?? '—'}`}
      actions={
        <button onClick={onClose} className="text-white/40 hover:text-white text-sm" title="Close">
          ✕
        </button>
      }
    >
      <div className="space-y-5">
        {/* Immutable AI draft summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-white/30">Source</div>
            <div className="text-white/80">{humanizeCode(entry.source)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-white/30">Routing reason</div>
            <div className="text-white/80">{humanizeCode(entry.routing_reason)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-white/30">Confidence</div>
            <div className="text-white/80">{confidencePct(entry.confidence)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-white/30">Status</div>
            <div className="text-white/80">{humanizeCode(entry.status)}</div>
          </div>
        </div>

        {entry.agent_rationale && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-white/30 mb-1">
              Agent rationale
            </div>
            <p className="text-sm text-white/70 whitespace-pre-wrap">{entry.agent_rationale}</p>
          </div>
        )}

        {/* Immutable draft lines */}
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/30 mb-1">Draft lines</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/30">
                  <th className="py-1 pr-3 font-medium">Code</th>
                  <th className="py-1 pr-3 font-medium">Account</th>
                  <th className="py-1 px-3 font-medium text-right">Debit</th>
                  <th className="py-1 px-3 font-medium text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((l) => (
                  <tr key={l.id} className="border-t border-white/5">
                    <td className="py-1.5 pr-3 font-mono text-white/70">{l.account_code ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-white/70">{l.account_name ?? '—'}</td>
                    <td className="py-1.5 px-3 text-right text-white/80">{formatMoney(l.debit)}</td>
                    <td className="py-1.5 px-3 text-right text-white/80">{formatMoney(l.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-medium">
                  <td className="py-1.5 pr-3" colSpan={2}>
                    Total
                  </td>
                  <td className="py-1.5 px-3 text-right">{formatMoney(entry.total_debits)}</td>
                  <td className="py-1.5 px-3 text-right">{formatMoney(entry.total_credits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {entry.source_document_id && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-white/30 mb-1">Document</div>
            {entry.source_document_url ? (
              <a
                href={entry.source_document_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#4DA6FF] hover:text-white underline underline-offset-2"
              >
                {entry.source_document_name ?? 'View document'}
              </a>
            ) : (
              <span className="text-sm text-white/60">{entry.source_document_name ?? '—'}</span>
            )}
          </div>
        )}

        {errorDetail && mode !== 'reject' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorDetail}
          </div>
        )}

        {/* Actions */}
        {mode === 'view' && (
          <div className="flex items-center gap-3 pt-1">
            <PrimaryButton onClick={() => setMode('confirmApprove')}>Approve</PrimaryButton>
            <SecondaryButton onClick={() => setMode('reject')}>Reject &amp; correct</SecondaryButton>
          </div>
        )}

        {mode === 'confirmApprove' && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 space-y-3">
            <p className="text-sm text-white/80">
              Approve and post this entry through the ledger engine? This cannot be undone here.
            </p>
            <div className="flex items-center gap-3">
              <PrimaryButton onClick={doApprove} busy={submitting}>
                Confirm approve
              </PrimaryButton>
              <SecondaryButton onClick={() => setMode('view')} disabled={submitting}>
                Cancel
              </SecondaryButton>
            </div>
          </div>
        )}

        {mode === 'reject' && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <RejectCorrectEditor
              entry={entry}
              submitting={submitting}
              errorDetail={errorDetail}
              onSubmit={doReject}
              onCancel={() => {
                setErrorDetail(null);
                setMode('view');
              }}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
};

export const InternalQueue: FC = () => {
  const { entries, count, isLoading, error, refetch } = useReviewQueue();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const onResolved = () => {
    setSelectedId(null);
    refetch();
  };

  return (
    <PageContainer
      title="Pending queue"
      subtitle={
        isLoading
          ? 'Loading…'
          : `${count} ${count === 1 ? 'entry' : 'entries'} awaiting review (oldest first).`
      }
    >
      <Toast toast={toast} />

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {isLoading ? (
        <SectionCard>
          <CenteredSpinner label="Loading review queue…" />
        </SectionCard>
      ) : entries.length === 0 && !error ? (
        <SectionCard>
          <EmptyState
            title="Nothing to review"
            description="No journal entries are currently awaiting review in your assigned organizations."
          />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Queue list */}
          <div className={selected ? 'lg:col-span-2' : 'lg:col-span-5'}>
            <SectionCard className="overflow-hidden" title={`Queue (${entries.length})`}>
              <div className="overflow-x-auto -m-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                      <th className="py-2 px-5 font-medium">Entry</th>
                      <th className="py-2 px-3 font-medium">Client</th>
                      <th className="py-2 px-3 font-medium text-right">Amount</th>
                      <th className="py-2 px-3 font-medium">Reason</th>
                      <th className="py-2 px-3 font-medium text-right">Conf.</th>
                      <th className="py-2 px-5 font-medium text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${
                          e.id === selectedId ? 'bg-[#0066FF]/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="py-2.5 px-5">
                          <div className="text-white/90 font-medium truncate max-w-[16rem]">
                            {entryTitle(e)}
                          </div>
                          <div className="text-[11px] text-white/40">{e.entry_number ?? '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-white/70 truncate max-w-[10rem]">
                          {e.org_name ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white/80">
                          {formatMoney(e.total_debits)}
                        </td>
                        <td className="py-2.5 px-3">
                          <Pill tone="warning">{humanizeCode(e.routing_reason)}</Pill>
                        </td>
                        <td className="py-2.5 px-3 text-right text-white/70">
                          {confidencePct(e.confidence)}
                        </td>
                        <td className="py-2.5 px-5 text-right text-white/50">
                          {formatAge(e.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Detail pane */}
          {selected && (
            <div className="lg:col-span-3">
              <DetailPane
                entry={selected}
                onResolved={onResolved}
                onClose={() => setSelectedId(null)}
                notify={showToast}
              />
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
};
