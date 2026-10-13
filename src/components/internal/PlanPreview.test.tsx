// PlanPreview (S87 B2b U2): what the server says a staff action will do — the
// bank-row merge, the flag release and the feed re-point — shown field by field
// as returned: amounts as the server's strings, ids shortened with the full id
// kept, and the balance legend only where the re-point balances are.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  type BankMatchPlan,
  type BankMergePlan,
  type BankNoDocumentPlan,
  type BankReleasePlan,
  type BankReopenPlan,
} from '@/hooks/useStaffBankRows';
import { type RepointPlan } from '@/hooks/useStaffRepoint';
import {
  MatchPlanPreview,
  MergePlanPreview,
  NoDocumentPlanPreview,
  ReleasePlanPreview,
  ReopenPlanPreview,
  RepointPlanPreview,
} from './PlanPreview';

// Every id starts differently, so its short form names exactly one of them.
const SIBLING = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROW = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MATCH = 'c1c1c1c1-0000-4000-8000-000000000001';
const LINE = 'd2d2d2d2-0000-4000-8000-000000000002';
const ENTRY = 'e3e3e3e3-0000-4000-8000-000000000003';
const FEED = 'f4f4f4f4-0000-4000-8000-000000000004';
const CARD = 'a5a5a5a5-0000-4000-8000-000000000005';
const ACCOUNT = 'b6b6b6b6-0000-4000-8000-000000000006';
const OTHER_ENTRY = 'e7e7e7e7-0000-4000-8000-000000000007';

// The plans as the server sends them (bank_duplicate_service.py
// MergePlan._image / ReleasePlan._image, feed_repoint_service.py
// RepointPlan.as_dict).
const MERGE: BankMergePlan = {
  stale_row_id: SIBLING,
  surviving_row_id: ROW,
  moves_match: {
    match_id: MATCH,
    state: 'auto_matched',
    journal_line_id: LINE,
    entry_id: ENTRY,
    entry_number: 68,
  },
  moves_entry: null,
  stale_ticket: {
    before: { status: 'documented', routing_reason: null },
    after: { status: 'closed', routing_reason: 'duplicate_merged' },
  },
  surviving_ticket: {
    before: { status: 'needs_review', routing_reason: 'possible_duplicate_bank_row' },
    after: { status: 'documented', routing_reason: 'bank_duplicate_merged' },
  },
  excluded_reason: 'duplicate',
};

const RELEASE: BankReleasePlan = {
  row_id: ROW,
  sibling_id: SIBLING,
  ticket: {
    before: { status: 'needs_review', routing_reason: 'possible_duplicate_bank_row' },
    after: { status: 'pending', routing_reason: null },
  },
  matched: null,
};

// Release C2: a waiting ticket closed as "no document needed"
// (bank_ticket_service.py NoDocumentPlan._image).
const NO_DOCUMENT: BankNoDocumentPlan = {
  row_id: ROW,
  row: { date: '2026-09-20', direction: 'money_out', amount: '1234.50', currency: 'CAD' },
  ticket: {
    before: { status: 'waiting_document', routing_reason: null },
    after: { status: 'no_document_needed', routing_reason: 'other' },
  },
  reason: 'other',
  reason_label: 'Other',
  note: 'Paid in cash, no receipt',
  entry: { entry_id: ENTRY, entry_number: 68, entry_date: '2026-09-21' },
  matched: { match_id: MATCH, state: 'auto_matched' },
};

// An override: the server computed 1234.50 and staff move 1000.00.
const REPOINT: RepointPlan = {
  mode: 'first',
  option: 'B',
  feed_id: FEED,
  from_account_code: '2110',
  target_account_code: '2150',
  target_account_name: 'Mastercard 3277',
  target_is_new: false,
  card_id: CARD,
  card_switches: true,
  computed: '1234.50',
  amount: '1000.00',
  override_reason: 'statement balance',
  legs: [
    {
      from_account_id: ACCOUNT,
      from_account_code: '2110',
      feed_lines: '1294.50',
      settlement_debits: '-60.00',
      earlier_moves: '0.00',
      rest: '85.25',
      basis: '1234.50',
      computed: '1234.50',
      moved: '1000.00',
    },
  ],
  balances: [
    { account_code: '2110', before: '1319.75', after: '319.75' },
    { account_code: '2150', before: '-12.00', after: '988.00' },
  ],
  notices: [
    '1 other open draft(s) carry a line on 2110; when approved they post there and are not moved by this run',
    "85.25 Cr on 2110 is not this feed's by any link (other feeds and cards, unmatched receipts, manual entries) and stays there",
  ],
  entry_id: null,
};

const LEGEND =
  'Balances are credits minus debits on posted lines: a positive amount is owed on the card, a negative amount is a debit balance.';

// A labelled field: the term and, beside it, its value.
const field = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!;
const value = (label: string) => field(label).querySelector('dd')!;

// The id is on screen in its short form only, and the element keeps all of it.
const expectShortId = (inside: HTMLElement, id: string) => {
  expect(within(inside).getByText(id.slice(0, 8))).toHaveAttribute('title', id);
  expect(inside).not.toHaveTextContent(id);
};

// The cells of one body row (row 0 is the header).
const cells = (table: HTMLElement, row: number) =>
  within(within(table).getAllByRole('row')[row])
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

describe('merge plan', () => {
  it('says the sibling is marked duplicate and its match moves to this row, with no journal entry changed', () => {
    render(<MergePlanPreview plan={MERGE} />);
    const plan = screen.getByRole('region', { name: 'Merge plan' });

    expect(
      within(plan).getByText('The sibling will be marked duplicate, and its match moves to this row.'),
    ).toBeInTheDocument();
    expect(within(plan).getByText('No journal entry is changed.')).toBeInTheDocument();
    expect(plan).not.toHaveTextContent(/leaves? the books/i);
  });

  it('shows every field as returned: both rows, the match, the exclusion reason and each ticket before and after', () => {
    render(<MergePlanPreview plan={MERGE} />);

    expectShortId(field('Marked duplicate (the sibling)'), SIBLING);
    expectShortId(field('Stays (this row)'), ROW);
    expect(value('Exclusion reason').textContent).toBe('duplicate');

    const match = field('Match that moves');
    expect(match).toHaveTextContent('auto_matched');
    expect(match).toHaveTextContent('JE-0068');
    expectShortId(match, MATCH);
    expectShortId(match, ENTRY);
    expectShortId(match, LINE);

    expect(value('Entry that moves').textContent).toBe('none');
    expect(value("Sibling's ticket").textContent).toBe('documented → closed (duplicate_merged)');
    expect(value("This row's ticket").textContent).toBe(
      'needs_review (possible_duplicate_bank_row) → documented (bank_duplicate_merged)',
    );
  });

  it('names an entry that moves, and says so when nothing moves and there is no ticket', () => {
    const first = render(
      <MergePlanPreview
        plan={{ ...MERGE, moves_match: null, moves_entry: { entry_id: ENTRY, entry_number: 71 } }}
      />,
    );
    expect(
      screen.getByText('The sibling will be marked duplicate, and its entry moves to this row.'),
    ).toBeInTheDocument();
    expect(value('Match that moves').textContent).toBe('none');
    expect(field('Entry that moves')).toHaveTextContent('JE-0071');
    expectShortId(field('Entry that moves'), ENTRY);
    first.unmount();

    render(
      <MergePlanPreview
        plan={{
          ...MERGE,
          moves_match: null,
          moves_entry: null,
          stale_ticket: null,
          surviving_ticket: { before: null, after: null },
        }}
      />,
    );
    expect(
      screen.getByText('The sibling will be marked duplicate. Nothing moves to this row.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No journal entry is changed.')).toBeInTheDocument();
    expect(value('Match that moves').textContent).toBe('none');
    expect(value('Entry that moves').textContent).toBe('none');
    expect(value("Sibling's ticket").textContent).toBe('none');
    expect(value("This row's ticket").textContent).toBe('none');
  });

  it('says both move when the sibling carries a match and an entry of its own', () => {
    render(
      <MergePlanPreview
        plan={{ ...MERGE, moves_entry: { entry_id: OTHER_ENTRY, entry_number: 71 } }}
      />,
    );

    expect(
      screen.getByText(
        'The sibling will be marked duplicate, and its match and its entry move to this row.',
      ),
    ).toBeInTheDocument();
    expect(field('Match that moves')).toHaveTextContent('JE-0068');
    expectShortId(field('Match that moves'), ENTRY);
    expect(field('Entry that moves')).toHaveTextContent('JE-0071');
    expectShortId(field('Entry that moves'), OTHER_ENTRY);
  });

  it('names an entry that has no number by its id alone', () => {
    render(
      <MergePlanPreview
        plan={{ ...MERGE, moves_match: null, moves_entry: { entry_id: ENTRY, entry_number: null } }}
      />,
    );

    expect(value('Entry that moves').textContent).toBe('entry e3e3e3e3');
    expectShortId(field('Entry that moves'), ENTRY);
  });

  it('shows a ticket this row did not have before as none on that side', () => {
    render(
      <MergePlanPreview
        plan={{
          ...MERGE,
          surviving_ticket: {
            before: null,
            after: { status: 'documented', routing_reason: 'bank_duplicate_merged' },
          },
        }}
      />,
    );

    expect(value("This row's ticket").textContent).toBe(
      'none → documented (bank_duplicate_merged)',
    );
  });

  it('shows a ticket the merge leaves alone as returned, the same before and after', () => {
    const untouched = { status: 'pending', routing_reason: null };
    render(
      <MergePlanPreview
        plan={{ ...MERGE, surviving_ticket: { before: untouched, after: untouched } }}
      />,
    );

    expect(value("This row's ticket").textContent).toBe('pending → pending');
  });
});

describe('release plan', () => {
  it('shows the row, the sibling it was flagged against and the ticket before and after', () => {
    render(<ReleasePlanPreview plan={RELEASE} />);
    const plan = screen.getByRole('region', { name: 'Release plan' });

    expect(
      within(plan).getByText('The possible-duplicate flag on this row will be released.'),
    ).toBeInTheDocument();
    expectShortId(field('Row'), ROW);
    expectShortId(field('Flagged against'), SIBLING);
    expect(value('Ticket').textContent).toBe(
      'needs_review (possible_duplicate_bank_row) → pending',
    );
    expect(value('Match already on this row').textContent).toBe('none');
  });

  it('names the match the row already carries, and says when no sibling was recorded', () => {
    render(
      <ReleasePlanPreview
        plan={{
          ...RELEASE,
          sibling_id: null,
          ticket: {
            before: RELEASE.ticket.before,
            after: { status: 'documented', routing_reason: 'bank_duplicate_flag_released' },
          },
          matched: { match_id: MATCH, state: 'confirmed', entry_id: ENTRY, entry_number: 68 },
        }}
      />,
    );

    expect(value('Flagged against').textContent).toBe('not recorded');
    expect(value('Ticket').textContent).toBe(
      'needs_review (possible_duplicate_bank_row) → documented (bank_duplicate_flag_released)',
    );
    const match = field('Match already on this row');
    expect(match).toHaveTextContent('confirmed');
    expect(match).toHaveTextContent('JE-0068');
    expectShortId(match, MATCH);
    expectShortId(match, ENTRY);
  });
});

describe('no-document plan', () => {
  it("shows the row, the server's reason label, the note, the entry and the match as returned", () => {
    render(<NoDocumentPlanPreview plan={NO_DOCUMENT} />);
    const plan = screen.getByRole('region', { name: 'No document needed plan' });

    expect(
      within(plan).getByText('This ticket will be closed: no document will be asked for this row.'),
    ).toBeInTheDocument();
    expect(within(plan).getByText('No journal entry is changed.')).toBeInTheDocument();
    expectShortId(field('Row'), ROW);
    // The reason in the server's words — its label, not its code.
    expect(value('Reason').textContent).toBe('Other');
    expect(value('Note').textContent).toBe('Paid in cash, no receipt');
    const entry = field('Entry');
    expect(entry).toHaveTextContent('JE-0068');
    expect(entry).toHaveTextContent('2026-09-21');
    expectShortId(entry, ENTRY);
    const match = field('Match');
    expect(match).toHaveTextContent('auto_matched');
    expectShortId(match, MATCH);
  });

  it("shows the amount as the server's string and the ticket change as returned, and says when there is no note", () => {
    render(
      <NoDocumentPlanPreview
        plan={{
          ...NO_DOCUMENT,
          reason: 'bank_fee',
          reason_label: 'Bank fee',
          note: null,
          ticket: {
            before: NO_DOCUMENT.ticket.before,
            after: { status: 'no_document_needed', routing_reason: 'bank_fee' },
          },
        }}
      />,
    );
    const plan = screen.getByRole('region', { name: 'No document needed plan' });

    expect(value('Date').textContent).toBe('2026-09-20');
    expect(value('Amount').textContent).toBe('Money out 1234.50 CAD');
    expect(plan).not.toHaveTextContent('1,234.50');
    expect(plan).not.toHaveTextContent('$');
    expect(value('Reason').textContent).toBe('Bank fee');
    expect(value('Note').textContent).toBe('none');
    expect(value('Ticket').textContent).toBe('waiting_document → no_document_needed (bank_fee)');
  });
});

describe('reopen plan', () => {
  it('shows the row, the reason given, the entry and the ticket change as returned', () => {
    const reopen: BankReopenPlan = {
      row_id: ROW,
      row: { date: '2026-09-20', direction: 'money_out', amount: '1234.50', currency: 'CAD' },
      ticket: {
        before: { status: 'no_document_needed', routing_reason: 'bank_fee' },
        after: { status: 'waiting_document', routing_reason: null },
      },
      reason: 'Receipt turned up',
      entry: { entry_id: ENTRY, entry_number: 68, entry_date: '2026-09-21' },
    };
    render(<ReopenPlanPreview plan={reopen} />);
    const plan = screen.getByRole('region', { name: 'Reopen plan' });

    expect(within(plan).getByText('This ticket will wait for its document again.')).toBeInTheDocument();
    expect(within(plan).getByText('No journal entry is changed.')).toBeInTheDocument();
    expectShortId(field('Row'), ROW);
    expect(value('Date').textContent).toBe('2026-09-20');
    expect(value('Amount').textContent).toBe('Money out 1234.50 CAD');
    expect(value('Reason for reopening').textContent).toBe('Receipt turned up');
    const entry = field('Entry');
    expect(entry).toHaveTextContent('JE-0068');
    expect(entry).toHaveTextContent('2026-09-21');
    expectShortId(entry, ENTRY);
    expect(value('Ticket').textContent).toBe('no_document_needed (bank_fee) → waiting_document');
  });
});

describe('re-point plan', () => {
  it('shows every amount exactly as the server sent it', () => {
    render(<RepointPlanPreview plan={REPOINT} />);
    const plan = screen.getByRole('region', { name: 'Re-point plan' });

    expect(value('Computed').textContent).toBe('1234.50');
    expect(value('Amount to move').textContent).toBe('1000.00');

    // One row per account the feed leaves: feed lines, card settlements,
    // earlier re-points, everything else, basis, computed, moved.
    const parts = screen.getByRole('table', { name: 'Parts by account' });
    const [account, ...amounts] = cells(parts, 1);
    expect(account).toContain('2110');
    expect(amounts).toEqual(['1294.50', '-60.00', '0.00', '85.25', '1234.50', '1234.50', '1000.00']);

    const balances = screen.getByRole('table', { name: 'Balances' });
    expect(cells(balances, 1)).toEqual(['2110', '1319.75', '319.75']);
    expect(cells(balances, 2)).toEqual(['2150', '-12.00', '988.00']);

    // Nothing regrouped, re-signed or given a symbol on the way to the screen.
    expect(plan).not.toHaveTextContent('1,234.50');
    expect(plan).not.toHaveTextContent('(60.00)');
    expect(plan).not.toHaveTextContent('$');
  });

  it('explains the balance sign in a legend that sits with the balances, and nowhere else', () => {
    const repoint = render(<RepointPlanPreview plan={REPOINT} />);
    expect(screen.getByText(LEGEND)).toBeInTheDocument();
    repoint.unmount();

    // No balances, no legend.
    const bare = render(<RepointPlanPreview plan={{ ...REPOINT, balances: [] }} />);
    expect(screen.getByRole('region', { name: 'Re-point plan' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Balances' })).not.toBeInTheDocument();
    expect(screen.queryByText(LEGEND)).not.toBeInTheDocument();
    bare.unmount();

    // A merge or a release moves no money and explains none.
    render(<MergePlanPreview plan={MERGE} />);
    render(<ReleasePlanPreview plan={RELEASE} />);
    expect(screen.getByRole('region', { name: 'Merge plan' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Release plan' })).toBeInTheDocument();
    expect(screen.queryByText(/credits minus debits/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/owed on the card/i)).not.toBeInTheDocument();
  });

  it('shows the feed, the accounts, the card, the override and the notices, and says when each is absent', () => {
    const first = render(<RepointPlanPreview plan={REPOINT} />);
    expectShortId(field('Feed'), FEED);
    expect(value('Mode').textContent).toBe('first');
    expect(value('Option').textContent).toBe('B');
    expect(value('From account').textContent).toBe('2110');
    expect(value('Target account').textContent).toBe('2150 Mastercard 3277');
    expectShortId(field('Card'), CARD);
    expect(field('Card')).toHaveTextContent('switches to 2150');
    expect(value('Override reason').textContent).toBe('statement balance');
    expect(value('Entry id').textContent).toBe('—');
    expectShortId(screen.getByRole('table', { name: 'Parts by account' }), ACCOUNT);
    const notices = within(screen.getByRole('list', { name: 'Notices' })).getAllByRole('listitem');
    expect(notices.map((item) => item.textContent)).toEqual(REPOINT.notices);
    first.unmount();

    // A sweep onto a new account, with no card, no override, nothing to say
    // and an entry already posted.
    render(
      <RepointPlanPreview
        plan={{
          ...REPOINT,
          mode: 'sweep',
          option: 'C',
          from_account_code: null,
          target_is_new: true,
          card_id: null,
          card_switches: false,
          override_reason: null,
          legs: [],
          notices: [],
          entry_id: ENTRY,
        }}
      />,
    );
    expect(value('Mode').textContent).toBe('sweep');
    expect(value('Option').textContent).toBe('C');
    expect(value('From account').textContent).toBe('—');
    expect(value('Target account').textContent).toBe('2150 Mastercard 3277 (new account)');
    expect(value('Card').textContent).toBe('none');
    expect(value('Override reason').textContent).toBe('none');
    expectShortId(field('Entry id'), ENTRY);
    expect(screen.queryByRole('table', { name: 'Parts by account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Notices' })).not.toBeInTheDocument();
  });

  it('says a card that keeps its account is not switched', () => {
    render(<RepointPlanPreview plan={{ ...REPOINT, card_switches: false }} />);

    expectShortId(field('Card'), CARD);
    expect(value('Card').textContent).toBe('a5a5a5a5 not switched');
    expect(field('Card')).not.toHaveTextContent('switches to');
  });
});

// ─── Match actions (Release D2) ────────────────────────────────────────────────

// A confirm plan as the server sends it (bank_match_actions.py
// MatchActionPlan._image).
const CONFIRM: BankMatchPlan = {
  action: 'confirm',
  row_id: ROW,
  row: { date: '2026-09-20', direction: 'money_out', amount: '6.00', currency: 'CAD' },
  match: {
    match_id: MATCH,
    state: { before: 'suggested', after: 'confirmed' },
    journal_line_id: LINE,
    account_code: '1010',
    line_debit: null,
    line_credit: '6.00',
    entry: { entry_id: ENTRY, entry_number: 66, entry_date: '2026-09-19' },
  },
  ticket: {
    before: { status: 'needs_review', routing_reason: 'suggested_match_review' },
    after: { status: 'no_document_needed', routing_reason: 'account_rule' },
  },
  follow: 'account_rule',
  relink: null,
  reason: null,
  note: null,
  routing_reason_label: 'No-document account',
};

describe('match plan', () => {
  it('shows a confirm as returned: the row, the match and its states, the entry, the line amounts as strings, the ticket change and what follows', () => {
    render(<MatchPlanPreview plan={CONFIRM} />);
    const plan = screen.getByRole('region', { name: 'Match plan' });

    expect(within(plan).getByText('The suggested match will be confirmed.')).toBeInTheDocument();
    expect(within(plan).getByText('No journal entry is changed.')).toBeInTheDocument();
    expectShortId(field('Row'), ROW);
    expect(value('Amount').textContent).toBe('Money out 6.00 CAD');
    const match = field('Match');
    expectShortId(match, MATCH);
    expect(match).toHaveTextContent('suggested → confirmed');
    const entry = field('Entry');
    expect(entry).toHaveTextContent('JE-0066');
    expect(entry).toHaveTextContent('2026-09-19');
    expectShortId(entry, ENTRY);
    // The line's amounts are the server's strings; the side it does not carry is a dash.
    expect(value('Line').textContent).toBe('1010 · debit — · credit 6.00');
    expect(value('Ticket').textContent).toBe(
      'needs_review (suggested_match_review) → no_document_needed (account_rule)',
    );
    // The routing reason after, in the server's words.
    expect(value('Routing reason').textContent).toBe('No-document account');
    expect(value('Then').textContent).toBe(
      'The ticket closes: every other line of the entry is on a no-document account.',
    );
    expect(screen.queryByText('Re-linked to', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Reason', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Note', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('shows a rejection with the entry the row is re-linked to and the reason given', () => {
    render(
      <MatchPlanPreview
        plan={{
          ...CONFIRM,
          action: 'reject',
          match: { ...CONFIRM.match, state: { before: 'suggested', after: 'rejected' } },
          ticket: {
            before: { status: 'needs_review', routing_reason: 'bank_draft_match_race' },
            after: { status: 'waiting_document', routing_reason: null },
          },
          follow: 'waiting_document',
          relink: {
            entry: { entry_id: OTHER_ENTRY, entry_number: 70, entry_date: '2026-09-20' },
            journal_line_id: 'd8d8d8d8-0000-4000-8000-000000000008',
            account_code: '1010',
          },
          reason: 'not this entry',
          routing_reason_label: null,
        }}
      />,
    );
    const plan = screen.getByRole('region', { name: 'Match plan' });

    expect(within(plan).getByText('The suggested match will be rejected.')).toBeInTheDocument();
    expect(field('Match')).toHaveTextContent('suggested → rejected');
    const relink = field('Re-linked to');
    expect(relink).toHaveTextContent('JE-0070');
    expect(relink).toHaveTextContent('line on 1010');
    expectShortId(relink, OTHER_ENTRY);
    expect(value('Reason').textContent).toBe('not this entry');
    expect(value('Ticket').textContent).toBe('needs_review (bank_draft_match_race) → waiting_document');
    expect(screen.queryByText('Routing reason', { selector: 'dt' })).not.toBeInTheDocument();
    expect(value('Then').textContent).toBe('The ticket waits for its document.');
  });

  it('shows a match made by hand as new, with its note, and an unmatch with its reason and the review that follows', () => {
    const manual = render(
      <MatchPlanPreview
        plan={{
          ...CONFIRM,
          action: 'manual_match',
          match: { ...CONFIRM.match, match_id: null, state: { before: null, after: 'manually_matched' } },
          ticket: {
            before: { status: 'pending', routing_reason: null },
            after: { status: 'waiting_document', routing_reason: null },
          },
          follow: 'waiting_document',
          note: 'by hand',
          routing_reason_label: null,
        }}
      />,
    );
    expect(
      screen.getByText('This row will be matched to the line below by hand.'),
    ).toBeInTheDocument();
    expect(value('Match').textContent).toBe('new → manually_matched');
    expect(value('Note').textContent).toBe('by hand');
    expect(value('Ticket').textContent).toBe('pending → waiting_document');
    manual.unmount();

    render(
      <MatchPlanPreview
        plan={{
          ...CONFIRM,
          action: 'unmatch',
          match: { ...CONFIRM.match, state: { before: 'auto_matched', after: 'unmatched' } },
          ticket: {
            before: { status: 'waiting_document', routing_reason: null },
            after: { status: 'needs_review', routing_reason: 'unmatched_by_staff' },
          },
          follow: 'needs_review',
          reason: 'Matched to the wrong entry.',
          routing_reason_label: 'Unmatched by staff',
        }}
      />,
    );
    expect(screen.getByText('The settled match will be taken off this row.')).toBeInTheDocument();
    expect(field('Match')).toHaveTextContent('auto_matched → unmatched');
    expect(value('Reason').textContent).toBe('Matched to the wrong entry.');
    expect(value('Routing reason').textContent).toBe('Unmatched by staff');
    expect(value('Then').textContent).toBe('The ticket goes to review.');
  });
});
