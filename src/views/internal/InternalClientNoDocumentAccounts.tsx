// Internal console — a client's "no document" accounts (Release C2 U7;
// backend Release C1, O-S88-4).
//
// IA: a per-org DRILL-IN page like the card registry (InternalClientCards at
// /internal/clients/:orgId/cards) — the marks are org-scoped data, reached
// from the client's row on Assigned clients. Reviewers and super users.
//
// The org's active expense accounts, each with its mark. A posted bank row
// whose entry is, apart from the bank's own line, on marked accounts only
// closes without waiting for a document. Staff mark or unmark one account at a
// time; the screen asks first (there is no dry run on the server), and then
// shows the mark THE SERVER RETURNED — from its list, or from its answer to
// the request — never the one that was asked for. What the server refuses is
// shown by its code and in its own words, and the mark stays as it was.
import { type FC, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ActionRefusal } from '@/components/internal/ActionRefusal';
import {
  CenteredSpinner,
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  PageContainer,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  Toast,
  useToast,
} from '@/components/internal/ui';
import {
  setNoDocumentAccount,
  useStaffNoDocumentAccounts,
  type NoDocumentAccount,
} from '@/hooks/useStaffNoDocumentAccounts';
import { type RemediationRefusal } from '@/hooks/useStaffResolution';

const pagerCls =
  'rounded-md border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/5 disabled:opacity-40';

// What ActionRefusal says on a 404: the account, or the client, is gone.
const ACCOUNT_GONE = 'This account is no longer available.';

// An account as the screen names it: its code, then its name.
const accountName = (account: NoDocumentAccount): string => `${account.code} ${account.name}`;

// What the server's answer amounts to, in a sentence — from the answer alone.
const answerSentence = (account: NoDocumentAccount, changed: boolean): string => {
  const name = accountName(account);
  if (!changed) {
    return `Nothing changed: ${name} ${account.no_document ? 'was already marked' : 'is not marked'}.`;
  }
  return account.no_document
    ? `${name} is now a no-document account.`
    : `${name} is no longer a no-document account.`;
};

export const InternalClientNoDocumentAccounts: FC = () => {
  const { orgId = '' } = useParams();
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } =
    useStaffNoDocumentAccounts(orgId);
  const { toast, showToast } = useToast();

  // The marks the server has answered with since the list was last read, by
  // account id. They stand in for the listed mark until the list is read again.
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  // The account staff are about to mark or unmark, waiting for their Confirm.
  const [asking, setAsking] = useState<{ account: NoDocumentAccount; mark: boolean } | null>(null);
  // A request is out: nothing else can be marked until it is answered.
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);

  // How an account stands, as the server last said.
  const isMarked = (account: NoDocumentAccount): boolean => answered[account.id] ?? account.no_document;

  // Reading the list again makes it the server's word once more.
  const readAgain = () => {
    setAnswered({});
    setRefusal(null);
    refetch();
  };
  const goToPage = (next: number) => {
    setAnswered({});
    setRefusal(null);
    setPage(next);
  };

  const confirm = async () => {
    if (!asking) return;
    setBusy(true);
    setRefusal(null);
    const outcome = await setNoDocumentAccount(orgId, asking.account.id, asking.mark);
    setBusy(false);
    setAsking(null);
    if (!outcome.ok) {
      // Refused, or no answer at all: the mark stays as it was.
      setRefusal(outcome.refusal);
      return;
    }
    // The mark is the one in the answer — not the one that was asked for.
    setAnswered((marks) => ({ ...marks, [outcome.account.id]: outcome.account.no_document }));
    showToast(answerSentence(outcome.account, outcome.changed), 'success');
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <PageContainer
      title="No-document accounts"
      subtitle="Expense accounts whose bank rows never wait for a document."
      actions={
        <Link to="/internal/clients" className="text-xs font-medium text-white/60 hover:text-white">
          ← Assigned clients
        </Link>
      }
    >
      <Toast toast={toast} />

      <p className="text-sm text-white/60">
        A posted bank row closes without waiting for a document when every line of its entry, apart
        from the bank&apos;s own, is on a marked account. A mark applies to entries posted from now
        on; rows already waiting are not changed from this page.
      </p>

      {error && <ErrorBanner message={error} onRetry={readAgain} />}

      {refusal && <ActionRefusal refusal={refusal} gone={ACCOUNT_GONE} onRefresh={readAgain} />}

      {isLoading ? (
        <SectionCard>
          <CenteredSpinner label="Loading accounts…" />
        </SectionCard>
      ) : items.length === 0 ? (
        !error && (
          <SectionCard>
            <EmptyState
              title="No expense accounts"
              description="This organization has no active expense account to mark."
            />
          </SectionCard>
        )
      ) : (
        <SectionCard className="overflow-hidden" title={`Expense accounts (${count})`}>
          <div className="overflow-x-auto -m-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                  <th className="py-2 px-5 font-medium">Code</th>
                  <th className="py-2 px-3 font-medium">Account</th>
                  <th className="py-2 px-3 font-medium">No document</th>
                  <th className="py-2 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((account) => {
                  const marked = isMarked(account);
                  return (
                    <tr key={account.id} className="border-b border-white/5">
                      <td className="py-2.5 px-5 text-white/70 whitespace-nowrap tabular-nums">
                        {account.code}
                      </td>
                      <td className="py-2.5 px-3 text-white/90">{account.name}</td>
                      <td className="py-2.5 px-3">
                        {marked ? (
                          <Pill tone="success">No document needed</Pill>
                        ) : (
                          <Pill>Document required</Pill>
                        )}
                      </td>
                      <td className="py-2.5 px-5 text-right">
                        <SecondaryButton
                          onClick={() => setAsking({ account, mark: !marked })}
                          disabled={busy}
                        >
                          {marked ? 'Remove mark' : 'Mark as no-document'}
                        </SecondaryButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {count > pageSize && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className={pagerCls}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className={pagerCls}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* The server has no dry run for a mark, so the screen asks first. */}
      {asking && (
        <ConfirmModal
          title={asking.mark ? 'Mark as a no-document account?' : 'Remove the no-document mark?'}
          onClose={() => !busy && setAsking(null)}
        >
          <p className="text-sm font-medium text-white">{accountName(asking.account)}</p>
          <p className="mt-2 text-sm text-white/70">
            {asking.mark
              ? 'Bank rows posted to this account will no longer wait for a document, when every other line of their entry is on a marked account too.'
              : 'Bank rows posted to this account will wait for a document again.'}
          </p>
          <p className="mt-2 text-xs text-white/50">
            Applies to entries posted from now on. Rows already waiting are not changed.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setAsking(null)} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void confirm()} disabled={busy} busy={busy}>
              Confirm
            </PrimaryButton>
          </div>
        </ConfirmModal>
      )}
    </PageContainer>
  );
};
