// PlanPreview (S87 B2b U2): what the server says a staff action will do — the
// bank-row merge, the flag release and the feed re-point — shown field by field
// as returned: amounts as the server's strings, ids shortened with the full id
// kept, and the balance legend only where the re-point balances are.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type BankMergePlan, type BankReleasePlan } from '@/hooks/useStaffBankRows';
import { type RepointPlan } from '@/hooks/useStaffRepoint';
import { MergePlanPreview, ReleasePlanPreview, RepointPlanPreview } from './PlanPreview';

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
