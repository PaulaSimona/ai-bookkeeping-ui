// InternalBankRows (S87 B2b U3, O-S87-8) — the staff bank-rows screen: every
// bank row waiting on staff, across the orgs the viewer may see
// (GET /api/accounting/review/bank/). The list, and the open row in a pane —
// the row and the row it may be a copy of, side by side.
//
// Layout (Release C2, F-S88-1): the page takes the whole content width
// (PageContainer wide) and so does the list, whether or not a row is open. The
// table has a minimum width of 64rem: it scrolls sideways, inside its own
// frame, only when that frame is narrower. Bank text is the column that gives
// way; a long feed name is cut short and keeps its last four digits. The open
// row is a drawer over the right edge of the page, with its own scroll.
//
// The screen shows what the server sent. Amounts are its strings, rendered
// untouched (never formatMoney). Bank text — counterparty and description — is
// plain text. A feed is named by its name and its last four digits, never more.
// A match is shown by its entry and its line: line_debit / line_credit are the
// server's two-decimal strings (F-S87-7), shown as sent, a dash for the side
// the line does not carry. Nothing is computed from them. A row that is listed
// although it is settled (F-S88-6) shows the match that settled it.
//
// Release C2 (N-S88-3, N-S88-4): a ticket status and a routing reason are
// shown by the label the server sent with the row (labelOrCode) — never a code
// reworded here. The headings carry the server's own count of the rows the
// filters select.
//
// Filters (O-S87-3): ticket status, possible duplicates, a date range, and one
// feed. The feed is chosen in the feed picker or set from a row ("Only this
// feed"), and shown as a chip. No endpoint lists the feeds a viewer may see
// (N-S88-8), so the picker offers the feeds of the rows the list has shown so
// far (Release C2, N-S88-2): a feed is on offer once one of its rows has been
// loaded. A filter that is not set is not sent (bankRowParams), and changing
// one goes back to the first page. The older ?org= and ?include_excluded=
// parameters are not offered.
//
// The org column shows only when the viewer's own org list (GET
// /api/accounting/orgs/: a reviewer's assigned orgs, every org for a super
// user) has more than one org. The pane always names the row's org.
//
// Actions (U4), on a row flagged as a possible duplicate:
//   Merge: keep this row          → POST staff/bank-rows/<sibling>/merge/
//                                   {surviving_row_id: this row} — offered
//                                   only when the row has a sibling. The
//                                   sibling is the STALE row: it carries the
//                                   match, and it is the one marked duplicate.
//   Not a duplicate: release flag → POST staff/bank-rows/<this row>/release-flag/
// and (Release C2, O-S88-3) on a row whose ticket waits for a document and
// which is matched, settled at the bank and in the books:
//   No document needed            → POST staff/bank-rows/<this row>/no-document/
//                                   {reason, note?} — one of seven reasons;
//                                   "Other" needs a note (at most 200
//                                   characters). The form comes first, then
//                                   Preview asks for the plan.
// and, for a SUPER USER only (GET staff/me/), on a ticket closed as "no
// document needed" (listed when that status is asked for, O-S88-11):
//   Reopen                        → POST staff/bank-rows/<this row>/reopen/
//                                   {reason} — the reason is required. Nobody
//                                   else is shown the button; the server gives
//                                   anyone else its 404.
// and (Release D2, O-S89-4 / O-S89-5) on a row whose suggested match waits for
// a decision, settled at the bank and in the books:
//   Confirm match                 → POST staff/bank-rows/<this row>/match/confirm/
//   Reject match                  → POST staff/bank-rows/<this row>/match/reject/
//                                   {reason?} — the reason is optional. The
//                                   plan says what follows for the ticket.
// and on an unmatched row, settled at the bank and in the books:
//   Match to a line…              → GET  staff/bank-rows/<this row>/match-candidates/
//                                   for the picker (the live, free lines on the
//                                   feed's account for the exact amount), then
//                                   POST staff/bank-rows/<this row>/match/manual/
//                                   {journal_line_id, note?}. The picker names a
//                                   line by its entry, date, account and amount
//                                   — never bank text.
// Each asks the server for its plan first (a dry run), shows that plan in the
// confirm dialog (PlanPreview), and carries it out only on Confirm — the same
// request with confirm true. The server decides what is allowed: a refusal is
// shown by its code and in its own words. A confirm counts as carried out only
// when the server says so (executed === true): then the pane closes and the
// list is read again. A 200 that was not executed claims nothing — the page
// says so, names the plan's rows and reads the list again. With no answer at
// all (a lost connection) the dialog stays open, to be confirmed again.
import { type FC, type ReactNode, useState } from 'react';

import { ActionRefusal, noticeCls } from '@/components/internal/ActionRefusal';
import {
  MatchPlanPreview,
  MergePlanPreview,
  NoDocumentPlanPreview,
  ReleasePlanPreview,
  ReopenPlanPreview,
} from '@/components/internal/PlanPreview';
import { ShortId } from '@/components/internal/ShortId';
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
  humanizeCode,
  useToast,
} from '@/components/internal/ui';
import { type PlanOutcome } from '@/hooks/staffPlan';
import { useOrgsList } from '@/hooks/useInternalAdmin';
import { useStaffMe } from '@/hooks/useStaffMe';
import {
  BANK_ROW_TICKET_STATUSES,
  BANK_ROW_TICKET_STATUS_LABELS,
  MATCH_REASON_MAX,
  NO_DOCUMENT_NOTE_MAX,
  NO_DOCUMENT_REASONS,
  NO_DOCUMENT_REASON_OTHER,
  POSSIBLE_DUPLICATE_REASON,
  REOPEN_REASON_MAX,
  canDecideSuggestion,
  canManualMatch,
  canMarkNoDocument,
  canReopenTicket,
  collectFeeds,
  confirmBankMatch,
  fetchMatchCandidates,
  labelOrCode,
  manualMatchBankRow,
  markNoDocument,
  mergeBankRow,
  rejectBankMatch,
  releaseBankRowFlag,
  reopenBankRow,
  useStaffBankRows,
  type BankFeedOption,
  type BankMatchCandidate,
  type BankRow,
  type BankRowFilters,
  type BankRowSibling,
} from '@/hooks/useStaffBankRows';
import { type RemediationRefusal } from '@/hooks/useStaffResolution';
import { formatEntryNumber } from '@/utils/entryStatus';

const fieldCls =
  'rounded-lg bg-[#0A1628] border border-white/15 px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:ring-1 focus:ring-[#0066FF] [color-scheme:dark]';
const labelCls = 'text-[11px] uppercase tracking-wide text-white/30';
const pagerCls =
  'rounded-md border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/5 disabled:opacity-40';

// A feed as the screen names it: its name, then its last four digits — never
// more of a mask than four.
const feedText = (feedName: string | null, mask: string | null): string => {
  const name = feedName ?? '—';
  const lastFour = mask ? mask.slice(-4) : '';
  return lastFour ? `${name} ····${lastFour}` : name;
};
const feedLabel = (row: BankRow): string => feedText(row.bank_account_name, row.feed_mask);

// A feed in the list (F-S88-1). A long name gives way — it is cut short, with
// the whole label in the title — and the last four digits always show. The
// text is the same as feedLabel's.
const FeedName: FC<{ row: BankRow }> = ({ row }) => {
  const lastFour = row.feed_mask ? row.feed_mask.slice(-4) : '';
  return (
    <span className="flex max-w-[14rem] min-w-0" title={feedLabel(row)}>
      <span className="truncate">{row.bank_account_name ?? '—'}</span>
      {lastFour && <span className="shrink-0 whitespace-pre">{` ····${lastFour}`}</span>}
    </span>
  );
};

// money_in / money_out in words; anything else as the server sent it.
const directionLabel = (direction: string): string => {
  if (direction === 'money_in') return 'Money in';
  if (direction === 'money_out') return 'Money out';
  return direction;
};

const SIBLING_RELATION: Record<BankRowSibling['relation'], string> = {
  flagged_against: 'Flagged against',
  merged_into: 'Merged into',
};

// An id on this screen (ShortId): small, and quieter than what it sits beside.
const idCls = 'text-xs text-white/40';

const Detail: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <dt className={labelCls}>{label}</dt>
    <dd className="text-white/80 break-words">{children}</dd>
  </div>
);

// What a row is flagged with: still pending at the bank, a possible copy of
// another row, out of the books.
const RowFlags: FC<{ row: BankRow }> = ({ row }) => {
  const possibleDuplicate = row.routing_reason === POSSIBLE_DUPLICATE_REASON;
  if (!row.pending && !possibleDuplicate && !row.excluded) return <>—</>;
  return (
    <span className="flex flex-wrap gap-1">
      {row.pending && <Pill tone="info">Pending at bank</Pill>}
      {possibleDuplicate && <Pill tone="warning">Possible duplicate</Pill>}
      {row.excluded && (
        <Pill tone="danger">
          {row.excluded_reason ? `Excluded: ${row.excluded_reason}` : 'Excluded'}
        </Pill>
      )}
    </span>
  );
};

// What the bank said of a row — the fields a row and its sibling share.
type RowSide = Pick<
  BankRow,
  | 'id'
  | 'date'
  | 'direction'
  | 'amount'
  | 'currency'
  | 'counterparty_name'
  | 'description'
  | 'pending'
  | 'excluded'
>;

// One half of the pane: the open row, or the row it may be a copy of.
const RowCard: FC<{ label: string; heading: string; row: RowSide }> = ({ label, heading, row }) => (
  <section aria-label={label} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-white">{heading}</h3>
      <ShortId className={idCls} id={row.id} />
    </div>
    <dl className="mt-2 space-y-2 text-sm">
      <Detail label="Date">{row.date}</Detail>
      <Detail label="Amount">
        {directionLabel(row.direction)} {row.amount} {row.currency}
      </Detail>
      <Detail label="Counterparty">{row.counterparty_name || '—'}</Detail>
      <Detail label="Bank text">{row.description || '—'}</Detail>
      <Detail label="Pending at bank">{row.pending ? 'Yes' : 'No'}</Detail>
      <Detail label="Excluded">{row.excluded ? 'Yes' : 'No'}</Detail>
    </dl>
  </section>
);

// ─── Actions ───────────────────────────────────────────────────────────────────

// A candidate line in the picker: its entry (number, else id), date, account
// and the one amount it carries, then the entry's description — the platform's
// wording, as the match summary already shows staff. Never bank text.
const candidateLabel = (candidate: BankMatchCandidate): string => {
  const entry = formatEntryNumber(candidate.entry.entry_number) || candidate.entry.entry_id.slice(0, 8);
  const amount =
    candidate.line_debit != null ? `debit ${candidate.line_debit}` : `credit ${candidate.line_credit ?? '—'}`;
  return `${entry} · ${candidate.entry.entry_date} · ${candidate.account_code} · ${amount} · ${candidate.entry_description}`;
};

// What ActionRefusal says on a 404: the row, or the sibling it would merge
// with, is gone.
const ROW_GONE = 'This row is no longer available.';

// A row a plan names, for the notice of a confirm the server did not carry out.
interface PlanRow {
  label: string;
  id: string;
}

// A plan as the confirm dialog needs it: what to ask, the plan itself, what
// to say once it is done, and the rows it names.
interface PlanView {
  title: string;
  plan: ReactNode;
  done: string;
  rows: PlanRow[];
}

// An action waiting for its Confirm: the plan the dry run returned, and the
// same request again with confirm true.
interface PendingAction extends PlanView {
  confirm: () => Promise<PlanOutcome<PlanView>>;
}

const RowActions: FC<{
  row: BankRow;
  // The viewer is a super user (GET staff/me/). False for a reviewer, and
  // while the viewer's role is not known yet.
  isSuperUser: boolean;
  // A confirmed action: say what was done, close the pane, read the list again.
  onDone: (message: string) => void;
  // A confirm the server answered without carrying it out: name the plan's
  // rows and read the list again.
  onNotCarriedOut: (rows: PlanRow[]) => void;
  onRefresh: () => void;
}> = ({ row, isSuperUser, onDone, onNotCarriedOut, onRefresh }) => {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);
  // A request is out: every button of the action waits for its answer.
  const [busy, setBusy] = useState(false);
  // "No document needed": its form is open, with the reason and the note staff
  // have given so far. They are kept while the plan is looked at, so a
  // cancelled plan comes back to the form as it was left.
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  // "Reopen": its form is open, with the reason given so far.
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  // "Reject match" (Release D2): its form is open, with the optional reason.
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // "Match to a line…" (Release D2): the candidates read for this row (null
  // until they arrive), the line chosen and the optional note.
  const [matching, setMatching] = useState(false);
  const [candidates, setCandidates] = useState<BankMatchCandidate[] | null>(null);
  const [lineId, setLineId] = useState('');
  const [matchNote, setMatchNote] = useState('');
  const sibling = row.duplicate_sibling;

  const flagged = row.routing_reason === POSSIBLE_DUPLICATE_REASON;
  const canClose = canMarkNoDocument(row);
  // Reopen is a super user's action only (O-S88-3): nobody else is shown it.
  const canReopen = isSuperUser && canReopenTicket(row);
  // A suggested match waits for a decision (Release D2, O-S89-4).
  const canDecide = canDecideSuggestion(row);
  // An unmatched row may be matched by hand (Release D2, O-S89-4).
  const canMatch = canManualMatch(row);
  if (!flagged && !canClose && !canReopen && !canDecide && !canMatch) return null;

  // Opens the manual-match form once the candidates are read. A refusal on
  // the read is shown and the form stays closed.
  const openMatching = async () => {
    setBusy(true);
    setRefusal(null);
    setCandidates(null);
    setLineId('');
    const outcome = await fetchMatchCandidates(row.id);
    setBusy(false);
    if (!outcome.ok) {
      setRefusal(outcome.refusal);
      return;
    }
    setCandidates(outcome.candidates);
    setMatching(true);
  };

  // "Other" needs a note (spaces are not one); any other reason stands alone.
  const noteRequired = reason === NO_DOCUMENT_REASON_OTHER;
  const canPreview = reason !== '' && (!noteRequired || note.trim() !== '');

  // `send(false)` asks what the action would do. Its plan goes into the
  // confirm dialog, whose Confirm is `send(true)`: the same request.
  const ask = async <P,>(
    send: (confirm: boolean) => Promise<PlanOutcome<P>>,
    view: (plan: P) => PlanView,
  ) => {
    setBusy(true);
    setRefusal(null);
    const outcome = await send(false);
    setBusy(false);
    if (!outcome.ok) {
      setRefusal(outcome.refusal);
      return;
    }
    setPending({
      ...view(outcome.plan),
      confirm: async () => {
        const confirmed = await send(true);
        return confirmed.ok ? { ...confirmed, plan: view(confirmed.plan) } : confirmed;
      },
    });
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setRefusal(null);
    const outcome = await pending.confirm();
    setBusy(false);
    // No answer at all (a lost connection): the dialog stays, with the failure
    // in it, and Confirm can be pressed again.
    if (!outcome.ok && outcome.refusal.status === undefined) {
      setRefusal(outcome.refusal);
      return;
    }
    setPending(null);
    if (!outcome.ok) setRefusal(outcome.refusal);
    // A 200 is carried out only when the server says so (executed === true).
    else if (outcome.executed) onDone(pending.done);
    else onNotCarriedOut(outcome.plan.rows);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {flagged && sibling && (
          <PrimaryButton
            onClick={() =>
              void ask(
                // The sibling is the stale row; this row is the one that stays.
                (confirmed) => mergeBankRow(sibling.id, row.id, confirmed),
                (plan) => ({
                  title: 'Merge: keep this row?',
                  plan: <MergePlanPreview plan={plan} />,
                  done: 'Merged. The sibling is marked duplicate.',
                  rows: [
                    { label: 'Sibling', id: plan.stale_row_id },
                    { label: 'This row', id: plan.surviving_row_id },
                  ],
                }),
              )
            }
            disabled={busy}
          >
            Merge: keep this row
          </PrimaryButton>
        )}
        {flagged && (
          <SecondaryButton
            onClick={() =>
              void ask(
                (confirmed) => releaseBankRowFlag(row.id, confirmed),
                (plan) => ({
                  title: 'Release the possible-duplicate flag?',
                  plan: <ReleasePlanPreview plan={plan} />,
                  done: 'Flag released. This row is not a duplicate.',
                  rows: [{ label: 'Row', id: plan.row_id }],
                }),
              )
            }
            disabled={busy}
          >
            Not a duplicate: release flag
          </SecondaryButton>
        )}
        {canDecide && (
          <PrimaryButton
            onClick={() =>
              void ask(
                (confirmed) => confirmBankMatch(row.id, confirmed),
                (plan) => ({
                  title: 'Confirm this match?',
                  plan: <MatchPlanPreview plan={plan} />,
                  done: 'Match confirmed.',
                  rows: [{ label: 'Row', id: plan.row_id }],
                }),
              )
            }
            disabled={busy}
          >
            Confirm match
          </PrimaryButton>
        )}
        {canDecide && (
          <SecondaryButton onClick={() => setRejecting(true)} disabled={busy}>
            Reject match
          </SecondaryButton>
        )}
        {canMatch && (
          <SecondaryButton onClick={() => void openMatching()} disabled={busy}>
            Match to a line…
          </SecondaryButton>
        )}
        {canClose && (
          <SecondaryButton onClick={() => setClosing(true)} disabled={busy}>
            No document needed
          </SecondaryButton>
        )}
        {canReopen && (
          <SecondaryButton onClick={() => setReopening(true)} disabled={busy}>
            Reopen
          </SecondaryButton>
        )}
      </div>

      {/* Reject match: an optional reason first; the plan is asked for with
          Preview. The plan says where the row goes: its own entry, review, or
          back to the drafting queue. */}
      {canDecide && rejecting && !pending && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/70">
            Reject this match: the row is re-linked to its own entry when it has one; otherwise it
            goes to review, or back to the drafting queue.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            disabled={busy}
            maxLength={MATCH_REASON_MAX}
            rows={2}
            aria-label="Reason for rejecting"
            placeholder="Reason (optional)"
            className={`${fieldCls} w-full`}
          />
          <p className="text-xs text-white/40">A reason is optional.</p>
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton
              onClick={() =>
                void ask(
                  (confirmed) => rejectBankMatch(row.id, rejectReason, confirmed),
                  (plan) => ({
                    title: 'Reject this match?',
                    plan: <MatchPlanPreview plan={plan} />,
                    done: 'Match rejected.',
                    rows: [{ label: 'Row', id: plan.row_id }],
                  }),
                )
              }
              disabled={busy}
            >
              Preview
            </PrimaryButton>
            <SecondaryButton onClick={() => setRejecting(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      {/* Match to a line: the candidates the server read for this row, one to
          be chosen, and an optional note; the plan is asked for with Preview. */}
      {canMatch && matching && candidates != null && !pending && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          {candidates.length === 0 ? (
            <p className="text-sm text-white/70">
              No posted line on this feed&apos;s account is free for this amount.
            </p>
          ) : (
            <>
              <p className="text-sm text-white/70">
                Match this row by hand to a posted line on its feed&apos;s account for the same
                amount. The ticket then waits for its document.
              </p>
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                disabled={busy}
                aria-label="Line"
                className={`${fieldCls} w-full`}
              >
                <option value="">Choose a line</option>
                {candidates.map((candidate) => (
                  <option key={candidate.journal_line_id} value={candidate.journal_line_id}>
                    {candidateLabel(candidate)}
                  </option>
                ))}
              </select>
              <textarea
                value={matchNote}
                onChange={(e) => setMatchNote(e.target.value)}
                disabled={busy}
                maxLength={MATCH_REASON_MAX}
                rows={2}
                aria-label="Note for the match"
                placeholder="Note (optional)"
                className={`${fieldCls} w-full`}
              />
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {candidates.length > 0 && (
              <PrimaryButton
                onClick={() =>
                  void ask(
                    (confirmed) => manualMatchBankRow(row.id, lineId, matchNote, confirmed),
                    (plan) => ({
                      title: 'Match this row by hand?',
                      plan: <MatchPlanPreview plan={plan} />,
                      done: 'Matched by hand.',
                      rows: [{ label: 'Row', id: plan.row_id }],
                    }),
                  )
                }
                disabled={busy || lineId === ''}
              >
                Preview
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => setMatching(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      {/* Reopen: the reason first; the plan is asked for with Preview. */}
      {canReopen && reopening && !pending && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/70">
            Reopen this ticket: it will wait for its document again.
          </p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            disabled={busy}
            maxLength={REOPEN_REASON_MAX}
            rows={2}
            aria-label="Reason for reopening"
            placeholder="Reason for reopening"
            className={`${fieldCls} w-full`}
          />
          <p className="text-xs text-white/40">A reason is required.</p>
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton
              onClick={() =>
                void ask(
                  (confirmed) => reopenBankRow(row.id, reopenReason, confirmed),
                  (plan) => ({
                    title: 'Reopen this ticket?',
                    plan: <ReopenPlanPreview plan={plan} />,
                    done: 'Reopened: waiting for a document again.',
                    rows: [{ label: 'Row', id: plan.row_id }],
                  }),
                )
              }
              disabled={busy || reopenReason.trim() === ''}
            >
              Preview
            </PrimaryButton>
            <SecondaryButton onClick={() => setReopening(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      {/* The reason first; the plan is asked for with Preview. Put away while
          the plan is on screen, and back as it was left if that is cancelled. */}
      {canClose && closing && !pending && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/70">
            Close this ticket: no document will be asked for this row.
          </p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            aria-label="Reason"
            className={`${fieldCls} w-full`}
          >
            <option value="">Choose a reason</option>
            {NO_DOCUMENT_REASONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            maxLength={NO_DOCUMENT_NOTE_MAX}
            rows={2}
            aria-label="Note"
            placeholder="Note"
            className={`${fieldCls} w-full`}
          />
          <p className="text-xs text-white/40">
            {noteRequired ? 'A note is required for the reason "Other".' : 'A note is optional.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton
              onClick={() =>
                void ask(
                  (confirmed) => markNoDocument(row.id, reason, note, confirmed),
                  (plan) => ({
                    title: 'Close this ticket: no document needed?',
                    plan: <NoDocumentPlanPreview plan={plan} />,
                    done: 'Closed: no document needed.',
                    rows: [{ label: 'Row', id: plan.row_id }],
                  }),
                )
              }
              disabled={busy || !canPreview}
            >
              Preview
            </PrimaryButton>
            <SecondaryButton onClick={() => setClosing(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      {refusal && !pending && <ActionRefusal refusal={refusal} gone={ROW_GONE} onRefresh={onRefresh} />}

      {pending && (
        <ConfirmModal title={pending.title} onClose={() => !busy && setPending(null)}>
          {pending.plan}
          {refusal && (
            <div className="mt-4">
              <ActionRefusal refusal={refusal} gone={ROW_GONE} onRefresh={onRefresh} />
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void confirm()} disabled={busy} busy={busy}>
              Confirm
            </PrimaryButton>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};

const DetailPane: FC<{
  row: BankRow;
  isSuperUser: boolean;
  // The list is already narrowed to this row's feed.
  feedIsFilter: boolean;
  onOnlyThisFeed: () => void;
  onDone: (message: string) => void;
  onNotCarriedOut: (rows: PlanRow[]) => void;
  onRefresh: () => void;
  onClose: () => void;
}> = ({
  row,
  isSuperUser,
  feedIsFilter,
  onOnlyThisFeed,
  onDone,
  onNotCarriedOut,
  onRefresh,
  onClose,
}) => {
  const sibling = row.duplicate_sibling;
  // The match that settled the row when it has one; else the suggestion that
  // waits for a decision.
  const match = row.settled_match ?? row.suggested_match;
  const matchHeading = row.settled_match ? 'Settled match' : 'Suggested match';
  return (
    <section aria-label="Bank row detail">
      <SectionCard
        title={`${row.date} · ${directionLabel(row.direction)} ${row.amount} ${row.currency}`}
        description={feedLabel(row)}
        actions={
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm" title="Close">
            ✕
          </button>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RowCard label="This row" heading="This row" row={row} />
            {sibling ? (
              <RowCard label="Sibling" heading={SIBLING_RELATION[sibling.relation]} row={sibling} />
            ) : (
              <p className="text-sm text-white/50">No duplicate sibling.</p>
            )}
          </div>

          <RowActions
            row={row}
            isSuperUser={isSuperUser}
            onDone={onDone}
            onNotCarriedOut={onNotCarriedOut}
            onRefresh={onRefresh}
          />

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Org">
              {row.org_name ?? '—'} {row.org_id && <ShortId className={idCls} id={row.org_id} />}
            </Detail>
            <Detail label="Feed">{feedLabel(row)}</Detail>
            <Detail label="Feed account">{row.feed_account_code ?? '—'}</Detail>
            <Detail label="Source">{humanizeCode(row.source)}</Detail>
            <Detail label="Ticket">{labelOrCode(row.ticket_status_label, row.ticket_status)}</Detail>
            <Detail label="Routing reason">
              {labelOrCode(row.routing_reason_label, row.routing_reason)}
            </Detail>
            {/* The staff note of a closed ticket, in the words it was written in. */}
            {row.resolution_note && <Detail label="Note">{row.resolution_note}</Detail>}
          </dl>

          {match && (
            <section aria-label={matchHeading}>
              <div className={`${labelCls} mb-1`}>{matchHeading}</div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="State">{humanizeCode(match.state)}</Detail>
                <Detail label="Entry date">{match.entry_date ?? '—'}</Detail>
                <Detail label="Entry">{match.entry_description || '—'}</Detail>
                <Detail label="Account">{match.account_code ?? '—'}</Detail>
                {/* The line's own amounts, as the server's strings. */}
                <Detail label="Debit">{match.line_debit ?? '—'}</Detail>
                <Detail label="Credit">{match.line_credit ?? '—'}</Detail>
              </dl>
            </section>
          )}

          {!feedIsFilter && (
            <div>
              <SecondaryButton onClick={onOnlyThisFeed}>Only this feed</SecondaryButton>
            </div>
          )}
        </div>
      </SectionCard>
    </section>
  );
};

export const InternalBankRows: FC = () => {
  const [filters, setFilters] = useState<Omit<BankRowFilters, 'bankAccountId'>>({});
  // The one feed the list is narrowed to, named as the row it was set from
  // named it.
  const [feed, setFeed] = useState<{ id: string; label: string } | null>(null);
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useStaffBankRows({
    ...filters,
    bankAccountId: feed?.id,
  });
  // The feeds the filter offers: the ones met in the rows shown so far, on any
  // page and under any filter (collectFeeds) — no endpoint lists them.
  // Worked out while rendering, not in an effect: the picker has a row's feed
  // in the same render that shows the row, never one render later.
  const [knownFeeds, setKnownFeeds] = useState<BankFeedOption[]>([]);
  const feeds = collectFeeds(knownFeeds, items);
  if (feeds !== knownFeeds) setKnownFeeds(feeds);
  const { data: orgs } = useOrgsList();
  const spansOrgs = orgs.length > 1;
  // Who is looking (GET staff/me/): only a super user is shown Reopen. Not a
  // super user until the answer says so.
  const { staff } = useStaffMe();
  const isSuperUser = staff?.isSuperUser === true;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((row) => row.id === selectedId) ?? null;
  // The page's toast: a confirmed action closes the pane, so the confirmation
  // lives here.
  const { toast, showToast } = useToast();

  // The rows of a confirm the server answered without carrying it out. Kept
  // here, not in the pane: reading the list again takes the pane down with it.
  const [notCarriedOut, setNotCarriedOut] = useState<PlanRow[] | null>(null);

  // A confirmed merge or release: say so, close the pane and read the list
  // again — the row has changed, and after a merge it has usually left the list.
  const onActionDone = (message: string) => {
    showToast(message, 'success');
    setNotCarriedOut(null);
    setSelectedId(null);
    refetch();
  };
  // Not carried out: nothing is claimed. The list is read again so the screen
  // shows where the rows stand now.
  const onActionNotCarriedOut = (rows: PlanRow[]) => {
    setNotCarriedOut(rows);
    refetch();
  };

  // A change of filter starts again from the first page, with no row open.
  const restart = () => {
    setPage(1);
    setSelectedId(null);
  };
  const change = (patch: Omit<BankRowFilters, 'bankAccountId'>) => {
    setFilters((current) => ({ ...current, ...patch }));
    restart();
  };
  const changeFeed = (next: { id: string; label: string } | null) => {
    setFeed(next);
    restart();
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <PageContainer
      wide
      title="Bank rows"
      subtitle={
        isLoading
          ? 'Loading…'
          : // The server's own count of the rows the filters select (N-S88-4).
            `${count} bank ${count === 1 ? 'row' : 'rows'} (oldest first).`
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={filters.ticketStatus ?? ''}
          onChange={(e) => change({ ticketStatus: e.target.value || undefined })}
          aria-label="Ticket status"
          className={fieldCls}
        >
          <option value="">Any ticket status</option>
          {/* The server's own eight (BANK_ROW_TICKET_STATUSES), by its labels. */}
          {BANK_ROW_TICKET_STATUSES.map((status) => (
            <option key={status} value={status}>
              {BANK_ROW_TICKET_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={filters.possibleDuplicate ?? false}
            onChange={(e) => change({ possibleDuplicate: e.target.checked || undefined })}
          />
          Possible duplicates only
        </label>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <span>From</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => change({ dateFrom: e.target.value || undefined })}
            aria-label="From date"
            className={fieldCls}
          />
          <span>to</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => change({ dateTo: e.target.value || undefined })}
            aria-label="To date"
            className={fieldCls}
          />
        </div>
        <select
          value={feed?.id ?? ''}
          onChange={(e) => {
            const chosen = feeds.find((option) => option.id === e.target.value);
            changeFeed(chosen ? { id: chosen.id, label: feedText(chosen.name, chosen.mask) } : null);
          }}
          aria-label="Feed"
          className={fieldCls}
        >
          <option value="">Any feed</option>
          {feeds.map((option) => (
            <option key={option.id} value={option.id}>
              {feedText(option.name, option.mask)}
              {/* Two orgs can each have a feed of the same name. */}
              {spansOrgs && option.orgName ? ` · ${option.orgName}` : ''}
            </option>
          ))}
        </select>
        {feed && (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#0066FF]/20 px-3 py-1 text-xs font-medium text-[#4DA6FF]">
            <span>Feed: {feed.label}</span>
            <button
              type="button"
              onClick={() => changeFeed(null)}
              aria-label="Remove feed filter"
              className="hover:text-white"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {notCarriedOut && (
        <div role="alert" className={noticeCls}>
          <p>The server did not carry this out.</p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-xs">
            {notCarriedOut.map((planRow) => (
              <span key={planRow.label}>
                {planRow.label} <ShortId className={idCls} id={planRow.id} />
              </span>
            ))}
          </p>
        </div>
      )}

      {isLoading ? (
        <SectionCard>
          <CenteredSpinner label="Loading bank rows…" />
        </SectionCard>
      ) : items.length === 0 ? (
        !error && (
          <SectionCard>
            <EmptyState title="No bank rows" description="No bank rows match the current filters." />
          </SectionCard>
        )
      ) : (
        <div>
          {/* List: the whole content width, whether or not a row is open
              (F-S88-1). It scrolls sideways only inside this frame, and only
              when the frame is narrower than the table's minimum width. */}
          <div>
            <SectionCard className="overflow-hidden" title={`Bank rows (${count})`}>
              <div className="overflow-x-auto -m-5">
                <table className="w-full min-w-[64rem] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-white/30 border-b border-white/10">
                      <th className="py-2 px-5 font-medium">Date</th>
                      {spansOrgs && <th className="py-2 px-3 font-medium">Org</th>}
                      <th className="py-2 px-3 font-medium">Feed</th>
                      <th className="py-2 px-3 font-medium text-right">Amount</th>
                      <th className="py-2 px-3 font-medium">Bank text</th>
                      <th className="py-2 px-3 font-medium">Ticket</th>
                      <th className="py-2 px-3 font-medium">Flags</th>
                      <th className="py-2 px-5 font-medium">Routing reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${
                          row.id === selectedId ? 'bg-[#0066FF]/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="py-2.5 px-5 text-white/70 whitespace-nowrap">{row.date}</td>
                        {spansOrgs && (
                          <td className="py-2.5 px-3 text-white/70 truncate max-w-[10rem]">
                            {row.org_name ?? '—'}
                            {/* O-S43-3: short org-id disambiguator (id.slice(0,8) + font-mono). */}
                            {row.org_id && (
                              <span className="ml-2 font-mono text-xs text-white/40">
                                {row.org_id.slice(0, 8)}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-white/70">
                          <FeedName row={row} />
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className="text-xs text-white/40">{directionLabel(row.direction)}</span>{' '}
                          <span className="text-white/90 tabular-nums">{`${row.amount} ${row.currency}`}</span>
                        </td>
                        {/* The column that gives way: it takes the width the
                            others leave, and its text is cut short to fit. */}
                        <td className="py-2.5 px-3 w-full max-w-0">
                          {row.counterparty_name && (
                            <div className="text-white/90 truncate">{row.counterparty_name}</div>
                          )}
                          <div className="text-white/50 truncate">{row.description || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {row.ticket_status ? (
                            <Pill>{labelOrCode(row.ticket_status_label, row.ticket_status)}</Pill>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <RowFlags row={row} />
                        </td>
                        <td className="py-2.5 px-5 text-white/70 min-w-[9rem]">
                          {labelOrCode(row.routing_reason_label, row.routing_reason)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* The open row: a drawer over the right edge of the page, with its
              own scroll — the list beneath keeps its full width and its rows
              stay there to be opened (Release C2, conflict 4). Under the
              confirm dialog and the toast (z-50). */}
          {selected && (
            <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0f172a] p-4 shadow-2xl">
              <DetailPane
                key={selected.id}
                row={selected}
                isSuperUser={isSuperUser}
                feedIsFilter={feed?.id === selected.bank_account_id}
                onOnlyThisFeed={() =>
                  changeFeed({ id: selected.bank_account_id, label: feedLabel(selected) })
                }
                onDone={onActionDone}
                onNotCarriedOut={onActionNotCarriedOut}
                onRefresh={refetch}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {count > pageSize && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className={pagerCls}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className={pagerCls}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </PageContainer>
  );
};
