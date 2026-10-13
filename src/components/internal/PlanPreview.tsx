// PlanPreview (S87 B2b U2, O-S87-8 / O-S87-9) — what the server says a staff
// action will do, shown before staff confirm it: the bank-row merge, the flag
// release, the "no document needed" close and its reopen (useStaffBankRows)
// and the feed re-point (useStaffRepoint).
//
// Every field of a plan is shown as returned. Amounts are the server's strings,
// rendered untouched — never formatMoney: nothing regrouped, re-signed or given
// a symbol. An id shows its first eight characters and keeps the whole id in
// its title.
//
// The balance legend is true of a re-point's `balances` only, so it is shown
// only with them: a leg's amounts carry no sign claim, and a merge or a release
// moves no money. No plan carries a match's line_debit / line_credit (the
// server's strings since Release C1, F-S87-7), so none is rendered here.
import { type FC, type ReactNode, useId } from 'react';

import { ShortId } from '@/components/internal/ShortId';
import {
  labelOrCode,
  type BankMergePlan,
  type BankNoDocumentPlan,
  type BankReleasePlan,
  type BankReopenPlan,
  type BankTicketImage,
} from '@/hooks/useStaffBankRows';
import { type RepointPlan } from '@/hooks/useStaffRepoint';
import { formatEntryNumber } from '@/utils/entryStatus';

const planCls = 'text-sm text-white/80';
const headingCls = 'text-xs font-medium uppercase tracking-wide text-white/40';
const captionCls = `pb-1 text-left ${headingCls}`;
const headCls = 'py-1 px-3 font-medium text-right';
const amountCls = 'py-1.5 px-3 text-right tabular-nums whitespace-nowrap';

// What a balance's sign means — said of `balances`, and of nothing else.
const BALANCE_LEGEND =
  'Balances are credits minus debits on posted lines: a positive amount is owed on the card, a negative amount is a debit balance.';

// An id in a plan (ShortId): a shade lighter than the text around it.
const idCls = 'text-white/70';

// A labelled field: the term and, beside it, its value.
const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex gap-3 py-1">
    <dt className="w-52 shrink-0 text-white/50">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);

// An entry: its number when it has one ("JE-0068"), and its id.
const EntryLabel: FC<{ id: string; entryNumber: number | null }> = ({ id, entryNumber }) => {
  const display = formatEntryNumber(entryNumber);
  return (
    <>
      {display && `${display} · `}entry <ShortId className={idCls} id={id} />
    </>
  );
};

// A ticket where it stands: its status, and its routing reason when it has one.
const ticketText = (ticket: BankTicketImage | null): string => {
  if (ticket == null) return 'none';
  return ticket.routing_reason ? `${ticket.status} (${ticket.routing_reason})` : ticket.status;
};

// A ticket before and after the action — "none" when there is no ticket at all.
const ticketChange = (
  change: { before: BankTicketImage | null; after: BankTicketImage | null } | null,
): string =>
  change == null || (change.before == null && change.after == null)
    ? 'none'
    : `${ticketText(change.before)} → ${ticketText(change.after)}`;

// ─── Merge ─────────────────────────────────────────────────────────────────────

// What reaches this row from the sibling: its match, its entry, both or nothing.
const mergeSentence = ({ moves_match, moves_entry }: BankMergePlan): string => {
  if (moves_match && moves_entry) {
    return 'The sibling will be marked duplicate, and its match and its entry move to this row.';
  }
  if (moves_match) return 'The sibling will be marked duplicate, and its match moves to this row.';
  if (moves_entry) return 'The sibling will be marked duplicate, and its entry moves to this row.';
  return 'The sibling will be marked duplicate. Nothing moves to this row.';
};

export const MergePlanPreview: FC<{ plan: BankMergePlan }> = ({ plan }) => (
  <section aria-label="Merge plan" className={planCls}>
    <p>{mergeSentence(plan)}</p>
    <p className="mt-1 text-white/50">No journal entry is changed.</p>
    <dl className="mt-3">
      <Field label="Marked duplicate (the sibling)">
        <ShortId className={idCls} id={plan.stale_row_id} />
      </Field>
      <Field label="Stays (this row)">
        <ShortId className={idCls} id={plan.surviving_row_id} />
      </Field>
      <Field label="Exclusion reason">{plan.excluded_reason}</Field>
      <Field label="Match that moves">
        {plan.moves_match ? (
          <>
            match <ShortId className={idCls} id={plan.moves_match.match_id} /> · {plan.moves_match.state} ·{' '}
            <EntryLabel
              id={plan.moves_match.entry_id}
              entryNumber={plan.moves_match.entry_number}
            />{' '}
            · line <ShortId className={idCls} id={plan.moves_match.journal_line_id} />
          </>
        ) : (
          'none'
        )}
      </Field>
      <Field label="Entry that moves">
        {plan.moves_entry ? (
          <EntryLabel id={plan.moves_entry.entry_id} entryNumber={plan.moves_entry.entry_number} />
        ) : (
          'none'
        )}
      </Field>
      <Field label="Sibling's ticket">{ticketChange(plan.stale_ticket)}</Field>
      <Field label="This row's ticket">{ticketChange(plan.surviving_ticket)}</Field>
    </dl>
  </section>
);

// ─── Release flag ──────────────────────────────────────────────────────────────

export const ReleasePlanPreview: FC<{ plan: BankReleasePlan }> = ({ plan }) => (
  <section aria-label="Release plan" className={planCls}>
    <p>The possible-duplicate flag on this row will be released.</p>
    <dl className="mt-3">
      <Field label="Row">
        <ShortId className={idCls} id={plan.row_id} />
      </Field>
      <Field label="Flagged against">
        {plan.sibling_id ? <ShortId className={idCls} id={plan.sibling_id} /> : 'not recorded'}
      </Field>
      <Field label="Ticket">{ticketChange(plan.ticket)}</Field>
      <Field label="Match already on this row">
        {plan.matched ? (
          <>
            match <ShortId className={idCls} id={plan.matched.match_id} /> · {plan.matched.state} ·{' '}
            <EntryLabel id={plan.matched.entry_id} entryNumber={plan.matched.entry_number} />
          </>
        ) : (
          'none'
        )}
      </Field>
    </dl>
  </section>
);

// ─── No document needed (Release C2) ───────────────────────────────────────────

// money_in / money_out in the words the bank-rows screen uses; anything else
// as the server sent it.
const directionText = (direction: string): string => {
  if (direction === 'money_in') return 'Money in';
  if (direction === 'money_out') return 'Money out';
  return direction;
};

// The row a ticket plan is about: its id, its date and its amount — the
// amount as the server's string.
const TicketPlanRow: FC<{ plan: Pick<BankNoDocumentPlan, 'row_id' | 'row'> }> = ({ plan }) => (
  <>
    <Field label="Row">
      <ShortId className={idCls} id={plan.row_id} />
    </Field>
    <Field label="Date">{plan.row.date}</Field>
    <Field label="Amount">
      {`${directionText(plan.row.direction)} ${plan.row.amount} ${plan.row.currency}`}
    </Field>
  </>
);

// The ticket's own entry: its number, its id and its date.
const TicketPlanEntry: FC<{ entry: BankNoDocumentPlan['entry'] }> = ({ entry }) => (
  <Field label="Entry">
    <EntryLabel id={entry.entry_id} entryNumber={entry.entry_number} /> · {entry.entry_date}
  </Field>
);

// The reason is shown by the label the SERVER gives it (reason_label), never
// by the picker's own wording (Release C2, conflict 5).
export const NoDocumentPlanPreview: FC<{ plan: BankNoDocumentPlan }> = ({ plan }) => (
  <section aria-label="No document needed plan" className={planCls}>
    <p>This ticket will be closed: no document will be asked for this row.</p>
    <p className="mt-1 text-white/50">No journal entry is changed.</p>
    <dl className="mt-3">
      <TicketPlanRow plan={plan} />
      <Field label="Reason">{labelOrCode(plan.reason_label, plan.reason)}</Field>
      <Field label="Note">{plan.note ?? 'none'}</Field>
      <TicketPlanEntry entry={plan.entry} />
      <Field label="Match">
        match <ShortId className={idCls} id={plan.matched.match_id} /> · {plan.matched.state}
      </Field>
      <Field label="Ticket">{ticketChange(plan.ticket)}</Field>
    </dl>
  </section>
);

// A closed ticket sent back to wait for its document (super users).
export const ReopenPlanPreview: FC<{ plan: BankReopenPlan }> = ({ plan }) => (
  <section aria-label="Reopen plan" className={planCls}>
    <p>This ticket will wait for its document again.</p>
    <p className="mt-1 text-white/50">No journal entry is changed.</p>
    <dl className="mt-3">
      <TicketPlanRow plan={plan} />
      <Field label="Reason for reopening">{plan.reason}</Field>
      <TicketPlanEntry entry={plan.entry} />
      <Field label="Ticket">{ticketChange(plan.ticket)}</Field>
    </dl>
  </section>
);

// ─── Re-point ──────────────────────────────────────────────────────────────────

export const RepointPlanPreview: FC<{ plan: RepointPlan }> = ({ plan }) => {
  const noticesId = useId();
  return (
    <section aria-label="Re-point plan" className={planCls}>
      <dl>
        <Field label="Feed">
          <ShortId className={idCls} id={plan.feed_id} />
        </Field>
        <Field label="Mode">{plan.mode}</Field>
        <Field label="Option">{plan.option}</Field>
        <Field label="From account">{plan.from_account_code ?? '—'}</Field>
        <Field label="Target account">
          {`${plan.target_account_code} ${plan.target_account_name}`}
          {plan.target_is_new && ' (new account)'}
        </Field>
        <Field label="Card">
          {plan.card_id ? (
            <>
              <ShortId className={idCls} id={plan.card_id} />{' '}
              {plan.card_switches ? `switches to ${plan.target_account_code}` : 'not switched'}
            </>
          ) : (
            'none'
          )}
        </Field>
        <Field label="Computed">{plan.computed}</Field>
        <Field label="Amount to move">{plan.amount}</Field>
        <Field label="Override reason">{plan.override_reason ?? 'none'}</Field>
        <Field label="Entry id">{plan.entry_id ? <ShortId className={idCls} id={plan.entry_id} /> : '—'}</Field>
      </dl>

      {plan.legs.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <caption className={captionCls}>Parts by account</caption>
            <thead>
              <tr className="text-xs text-white/40">
                <th className="py-1 pr-3 font-medium text-left">Account</th>
                <th className={headCls}>Feed lines</th>
                <th className={headCls}>Card settlements</th>
                <th className={headCls}>Earlier re-points</th>
                <th className={headCls}>Everything else</th>
                <th className={headCls}>Basis</th>
                <th className={headCls}>Computed</th>
                <th className={headCls}>Moved</th>
              </tr>
            </thead>
            <tbody>
              {plan.legs.map((leg) => (
                <tr key={leg.from_account_id} className="border-t border-white/5">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {leg.from_account_code} <ShortId className={idCls} id={leg.from_account_id} />
                  </td>
                  <td className={amountCls}>{leg.feed_lines}</td>
                  <td className={amountCls}>{leg.settlement_debits}</td>
                  <td className={amountCls}>{leg.earlier_moves}</td>
                  <td className={amountCls}>{leg.rest}</td>
                  <td className={amountCls}>{leg.basis}</td>
                  <td className={amountCls}>{leg.computed}</td>
                  <td className={amountCls}>{leg.moved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan.balances.length > 0 && (
        <div className="mt-4">
          <table>
            <caption className={captionCls}>Balances</caption>
            <thead>
              <tr className="text-xs text-white/40">
                <th className="py-1 pr-3 font-medium text-left">Account</th>
                <th className={headCls}>Before</th>
                <th className={headCls}>After</th>
              </tr>
            </thead>
            <tbody>
              {plan.balances.map((balance) => (
                <tr key={balance.account_code} className="border-t border-white/5">
                  <td className="py-1.5 pr-3">{balance.account_code}</td>
                  <td className={amountCls}>{balance.before}</td>
                  <td className={amountCls}>{balance.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-white/50">{BALANCE_LEGEND}</p>
        </div>
      )}

      {plan.notices.length > 0 && (
        <div className="mt-4">
          <p id={noticesId} className={headingCls}>
            Notices
          </p>
          <ul aria-labelledby={noticesId} className="mt-1 list-disc space-y-1 pl-5 text-amber-200">
            {plan.notices.map((notice, index) => (
              <li key={index}>{notice}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
