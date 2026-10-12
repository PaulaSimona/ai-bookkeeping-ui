// CardChangeDialog (S87 B2b U5, O-S87-9): "Change" on a business card of the
// staff card page — re-point the card's bank feed to another account. The
// dialog offers exactly what the server says the feed can move to (never the
// org's chart), asks for the plan first, shows it with the balance legend, and
// carries it out only on Confirm. It says a re-point is done only when the
// server says it executed.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type RepointPlan, type RepointTargets } from '@/hooks/useStaffRepoint';
import { type StaffCard } from '@/hooks/useStaffResolution';
import { CardChangeDialog } from './CardChangeDialog';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const FEED = 'f1f1f1f1-0000-4000-8000-000000000001';
const CARD_ID = 'c1c1c1c1-0000-4000-8000-000000000002';
const ENTRY = 'e1e1e1e1-0000-4000-8000-000000000003';

const TARGETS_URL = `/api/accounting/staff/bank-accounts/${FEED}/repoint-targets/`;
const REPOINT_URL = `/api/accounting/staff/bank-accounts/${FEED}/repoint/`;
const ENTRY_URL = `/api/accounting/staff/entries/${ENTRY}/`;

// A classified business card whose feed the server could name.
const CARD: StaffCard = {
  id: CARD_ID,
  last4: '3277',
  network: 'mastercard',
  label: 'Capital One M/C',
  classification: 'business',
  mapped_account: 'acc-2110',
  mapped_account_code: '2110',
  mapped_account_name: 'Visa Card Payable',
  source: 'detected',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  feed_id: FEED,
  feed_unlinked_reason: null,
};

// As the server sends them (feed_repoint_service.py repoint_targets /
// RepointPlan.as_dict). 2130 is the N-S87-2 case: an account named for
// another card network, offered all the same.
const TARGETS: RepointTargets = {
  feed_id: FEED,
  current_account: { code: '2110', name: 'Visa Card Payable' },
  targets: [
    { code: '2120', name: 'Mastercard' },
    { code: '2130', name: 'American Express' },
    { code: '2150', name: 'Mastercard 3277' },
  ],
  new_account_available: false,
};

const PLAN: RepointPlan = {
  mode: 'first',
  option: 'B',
  feed_id: FEED,
  from_account_code: '2110',
  target_account_code: '2150',
  target_account_name: 'Mastercard 3277',
  target_is_new: false,
  card_id: CARD_ID,
  card_switches: true,
  computed: '80.00',
  amount: '80.00',
  override_reason: null,
  legs: [
    {
      from_account_id: 'a1a1a1a1-0000-4000-8000-000000000004',
      from_account_code: '2110',
      feed_lines: '140.00',
      settlement_debits: '-60.00',
      earlier_moves: '0.00',
      rest: '85.00',
      basis: '80.00',
      computed: '80.00',
      moved: '80.00',
    },
  ],
  balances: [
    { account_code: '2110', before: '165.00', after: '85.00' },
    { account_code: '2150', before: '0.00', after: '80.00' },
  ],
  notices: [],
  entry_id: null,
};

const LEGEND =
  'Balances are credits minus debits on posted lines: a positive amount is owed on the card, a negative amount is a debit balance.';
const CAUTION =
  'Check this account: 2130 American Express is not named for this card (····3277).';
const DONE = 'The re-point was carried out.';
const NOT_DONE = 'The server did not carry this out.';
const UNAVAILABLE = "This card's feed is no longer available.";
const LIMIT = 'The hourly limit for this action has been reached. Try again later.';

const planned = (executed: boolean, plan: unknown) => ({ status: 200, data: { executed, plan } });
const ENTRY_READ = {
  status: 200,
  data: { id: ENTRY, entry_number: 102, entry_number_display: 'JE-0102' },
};

// What the server answers to the dialog's reads: the feed's targets, and the
// entry a re-point posted.
const serve = (targets: unknown = { status: 200, data: TARGETS }, entry: unknown = ENTRY_READ) => {
  get.mockImplementation((url) => {
    if (url === TARGETS_URL) return Promise.resolve(targets);
    if (url === ENTRY_URL) return Promise.resolve(entry);
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
};

const onChanged = vi.fn();
const onClose = vi.fn();

const openDialog = () =>
  render(<CardChangeDialog card={CARD} onChanged={onChanged} onClose={onClose} />);

const button = (name: string) => screen.getByRole('button', { name });
// Every account on offer, in order, by its label.
const radios = () =>
  screen.getAllByRole('radio').map((option) => option.closest('label')?.textContent);
// Lets every answered request reach the screen.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

type User = ReturnType<typeof userEvent.setup>;

// Picks one of the offered accounts once the targets are on screen.
const choose = async (user: User, name: string) => {
  await user.click(await screen.findByRole('radio', { name }));
};

// Picks an account and asks for its plan.
const preview = async (user: User, name: string) => {
  await choose(user, name);
  await user.click(button('Preview'));
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  onChanged.mockReset();
  onClose.mockReset();
});

describe('card change: what the feed can move to', () => {
  it('offers exactly the targets the server returned, then Sweep — never the chart of accounts', async () => {
    serve();
    openDialog();

    expect(
      await screen.findByRole('dialog', { name: 'Change account for the card ending 3277' }),
    ).toBeInTheDocument();
    await screen.findByRole('radio', { name: 'Sweep remaining lines' });
    expect(radios()).toEqual([
      '2120 Mastercard',
      '2130 American Express',
      '2150 Mastercard 3277',
      'Sweep remaining lines',
    ]);

    // The one account named for this card is marked, and only that one.
    const marks = screen.getAllByText("this card's account");
    expect(marks).toHaveLength(1);
    expect(marks[0].closest('li')).toHaveTextContent('2150 Mastercard 3277');

    // Sweep names the account the feed is on now.
    expect(screen.getByRole('radio', { name: 'Sweep remaining lines' }).closest('li')).toHaveTextContent(
      '2110 Visa Card Payable',
    );

    // One read, and it is the feed's own targets.
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(TARGETS_URL);
    expect(button('Preview')).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('offers Create new account only when the server says one would be created', async () => {
    const user = userEvent.setup();
    serve();
    const without = openDialog();
    await screen.findByRole('radio', { name: 'Sweep remaining lines' });
    expect(screen.queryByRole('radio', { name: 'Create new account' })).not.toBeInTheDocument();
    without.unmount();

    serve({ status: 200, data: { ...TARGETS, new_account_available: true } });
    post.mockResolvedValue(planned(false, { ...PLAN, target_is_new: true }));
    openDialog();
    await screen.findByRole('radio', { name: 'Create new account' });
    expect(radios()).toEqual([
      '2120 Mastercard',
      '2130 American Express',
      '2150 Mastercard 3277',
      'Sweep remaining lines',
      'Create new account',
    ]);

    // Asked for by the server's own word.
    await preview(user, 'Create new account');
    await screen.findByRole('region', { name: 'Re-point plan' });
    expect(post).toHaveBeenCalledWith(REPOINT_URL, { target_account_code: 'new', confirm: false });
  });

  it('says the feed is gone when its targets cannot be read, and offers nothing but Close', async () => {
    const user = userEvent.setup();
    serve({ status: 404, data: { detail: 'Not found.' } });
    openDialog();

    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(TARGETS_URL);

    // No account to pick, nothing to preview, no override.
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Advanced: override amount' }),
    ).not.toBeInTheDocument();
    // What is left: the window's own ✕, the notice's Refresh, and Close.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '✕',
      'Refresh',
      'Close',
    ]);
    expect(post).not.toHaveBeenCalled();

    await user.click(button('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('cautions when the chosen account is not named for this card, again at the confirm, and never for Sweep or Create new', async () => {
    const user = userEvent.setup();
    serve({ status: 200, data: { ...TARGETS, new_account_available: true } });
    post.mockResolvedValue(
      planned(false, { ...PLAN, target_account_code: '2130', target_account_name: 'American Express' }),
    );
    openDialog();

    await choose(user, '2150 Mastercard 3277');
    expect(screen.queryByText(/Check this account/)).not.toBeInTheDocument();
    await choose(user, 'Sweep remaining lines');
    expect(screen.queryByText(/Check this account/)).not.toBeInTheDocument();
    await choose(user, 'Create new account');
    expect(screen.queryByText(/Check this account/)).not.toBeInTheDocument();

    await choose(user, '2130 American Express');
    expect(screen.getByText(CAUTION)).toBeInTheDocument();

    // Still said beside the plan, where the re-point is confirmed.
    await user.click(button('Preview'));
    await screen.findByRole('region', { name: 'Re-point plan' });
    expect(button('Confirm')).toBeInTheDocument();
    expect(screen.getByText(CAUTION)).toBeInTheDocument();
  });

  it('needs an amount of the right shape and a written reason before an override can be previewed, and sends both as typed', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue(planned(false, { ...PLAN, amount: '50.50', override_reason: 'statement balance' }));
    openDialog();
    await choose(user, '2150 Mastercard 3277');
    expect(button('Preview')).toBeEnabled();

    await user.click(button('Advanced: override amount'));
    const amount = screen.getByLabelText('Override amount');
    const reason = screen.getByLabelText('Reason');
    const SHAPE = 'Use digits with at most two decimals, like 1234.50.';

    // Cents only: a third decimal, an exponent, a comma or a space is not an
    // amount here, though the server would read some of them. No preview.
    for (const typed of ['12.345', '1e2', '12,50', ' 12']) {
      await user.clear(amount);
      await user.type(amount, typed);
      expect(screen.getByText(SHAPE)).toBeInTheDocument();
      expect(button('Preview')).toBeDisabled();
    }

    // An optional minus (a debit balance is moved by a negative), digits, and
    // at most two decimals.
    for (const typed of ['-12.5', '300', '0.05']) {
      await user.clear(amount);
      await user.type(amount, typed);
      expect(screen.queryByText(SHAPE)).not.toBeInTheDocument();
    }

    // A number, but no reason yet: still no preview.
    await user.clear(amount);
    await user.type(amount, '50.50');
    expect(screen.queryByText(SHAPE)).not.toBeInTheDocument();
    expect(screen.getByText('An override needs a written reason.')).toBeInTheDocument();
    expect(button('Preview')).toBeDisabled();
    await user.type(reason, '   ');
    expect(button('Preview')).toBeDisabled();

    await user.clear(reason);
    await user.type(reason, 'statement balance');
    expect(screen.queryByText('An override needs a written reason.')).not.toBeInTheDocument();
    expect(button('Preview')).toBeEnabled();

    // The amount goes as the string that was typed — never a number.
    await user.click(button('Preview'));
    await screen.findByRole('region', { name: 'Re-point plan' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(REPOINT_URL, {
      target_account_code: '2150',
      confirm: false,
      amount: '50.50',
      reason: 'statement balance',
    });
  });
});

describe('card change: preview, confirm and what comes back', () => {
  it('asks for the plan first — the chosen account, or the current one for Sweep — and shows it with the balance legend', async () => {
    const user = userEvent.setup();
    serve();
    post.mockResolvedValue(planned(false, PLAN));
    openDialog();

    await preview(user, '2150 Mastercard 3277');
    const plan = await screen.findByRole('region', { name: 'Re-point plan' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(REPOINT_URL, { target_account_code: '2150', confirm: false });
    expect(within(plan).getByText(LEGEND)).toBeInTheDocument();
    expect(within(plan).getByRole('table', { name: 'Balances' })).toBeInTheDocument();

    // Looking is not doing: nothing is confirmed, nothing refreshed.
    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    // Back to the choice; Sweep is asked for by the current account's code.
    await user.click(button('Back'));
    await preview(user, 'Sweep remaining lines');
    await screen.findByRole('region', { name: 'Re-point plan' });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, { target_account_code: '2110', confirm: false });
  });

  it('confirms with the same request and confirm true, then says it is done and names the entry it posted', async () => {
    const user = userEvent.setup();

    // Carries one re-point through to its end.
    const carryOut = async (executedPlan: RepointPlan) => {
      get.mockClear();
      post.mockReset();
      post.mockResolvedValueOnce(planned(false, PLAN)).mockResolvedValueOnce(planned(true, executedPlan));
      const view = openDialog();
      await preview(user, '2150 Mastercard 3277');
      await screen.findByRole('region', { name: 'Re-point plan' });
      await user.click(button('Confirm'));
      await screen.findByText(DONE);
      return view;
    };

    // The entry is named by its number, read from the staff entry detail.
    serve();
    const numbered = await carryOut({ ...PLAN, entry_id: ENTRY });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, { target_account_code: '2150', confirm: true });
    expect(await screen.findByText('Posted as JE-0102.')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(ENTRY_URL);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    await user.click(button('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    numbered.unmount();

    // That read failing leaves the entry's short id, with the whole id kept.
    serve(undefined, { status: 404, data: { detail: 'Not found.' } });
    const unread = await carryOut({ ...PLAN, entry_id: ENTRY });
    await waitFor(() => expect(get).toHaveBeenCalledWith(ENTRY_URL));
    await settle();
    const posted = screen.getByText('e1e1e1e1');
    expect(posted).toHaveAttribute('title', ENTRY);
    expect(posted.parentElement).toHaveTextContent('Posted as entry e1e1e1e1.');
    expect(screen.queryByText(/JE-/)).not.toBeInTheDocument();
    unread.unmount();

    // Nothing to move posts nothing.
    serve();
    await carryOut({ ...PLAN, entry_id: null });
    expect(screen.getByText('No entry was needed.')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(ENTRY_URL);
  });

  it('counts a confirm as carried out only when the server says so: otherwise names the feed, claims nothing and has the cards read again', async () => {
    const user = userEvent.setup();
    serve();
    // The confirm comes back 200, but as a plan that was NOT executed.
    post.mockResolvedValueOnce(planned(false, PLAN)).mockResolvedValueOnce(planned(false, PLAN));
    openDialog();
    await preview(user, '2150 Mastercard 3277');
    await screen.findByRole('region', { name: 'Re-point plan' });

    await user.click(button('Confirm'));

    const notice = (await screen.findByText(NOT_DONE)).closest('[role="alert"]') as HTMLElement;
    expect(within(notice).getByText('f1f1f1f1')).toHaveAttribute('title', FEED);
    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, { target_account_code: '2150', confirm: true });
    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
    expect(screen.queryByText(/Posted as/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("shows a refusal by the server's code and in its own words, at the preview or at the confirm", async () => {
    const user = userEvent.setup();
    serve();
    openDialog();

    // Refused at the dry run: no plan, the choice stays.
    const current =
      'This feed is already on 2110, and it has never been re-pointed: there is nothing to do.';
    post.mockResolvedValueOnce({ status: 409, data: { code: 'target_is_current', detail: current } });
    await preview(user, 'Sweep remaining lines');
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent(current);
    expect(within(first).getByText('target_is_current')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Re-point plan' })).not.toBeInTheDocument();

    // Refused at the confirm: back to the choice, with the refusal.
    const drafts =
      'This feed has 2 open draft(s) on 2110. Post or resolve them first — approved later they would post to the account the feed has left.';
    post
      .mockResolvedValueOnce(planned(false, PLAN))
      .mockResolvedValueOnce({ status: 409, data: { code: 'open_drafts', detail: drafts } });
    await preview(user, '2150 Mastercard 3277');
    await screen.findByRole('region', { name: 'Re-point plan' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(button('Confirm'));
    const second = await screen.findByRole('alert');
    expect(second).toHaveTextContent(drafts);
    expect(within(second).getByText('open_drafts')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Re-point plan' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '2150 Mastercard 3277' })).toBeChecked();

    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('says the feed is gone on a 404, shows the hourly limit on a 429, and keeps the confirm open when the connection is lost', async () => {
    const user = userEvent.setup();

    // 404: not available any more, with a refresh that reads the cards again.
    serve();
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    const gone = openDialog();
    await preview(user, '2150 Mastercard 3277');
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Re-point plan' })).not.toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    await user.click(button('Refresh'));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    gone.unmount();

    // 429: the action's hourly limit. Nothing is sent again by itself.
    post.mockReset();
    post.mockResolvedValue({ status: 429, data: { detail: 'Request was throttled.' } });
    const limited = openDialog();
    await preview(user, '2150 Mastercard 3277');
    expect(await screen.findByText(LIMIT)).toBeInTheDocument();
    await settle();
    expect(post).toHaveBeenCalledTimes(1);
    expect(button('Preview')).toBeEnabled();
    limited.unmount();

    // No answer at the confirm: the plan stays, with the failure and no code,
    // and Confirm can be pressed again.
    post.mockReset();
    post.mockResolvedValueOnce(planned(false, PLAN)).mockRejectedValueOnce(new Error('network down'));
    onChanged.mockReset();
    openDialog();
    await preview(user, '2150 Mastercard 3277');
    await screen.findByRole('region', { name: 'Re-point plan' });
    await user.click(button('Confirm'));
    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toBe('Re-point failed.');
    expect(screen.getByRole('region', { name: 'Re-point plan' })).toBeInTheDocument();
    expect(button('Confirm')).toBeEnabled();
    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
    expect(screen.queryByText(NOT_DONE)).not.toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('sends one request at a time: no second preview or confirm while one is in flight', async () => {
    const user = userEvent.setup();
    serve();
    const answers: ((value: unknown) => void)[] = [];
    post.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    openDialog();

    // The dry run is out: it cannot be asked for again, nor the choice changed.
    await preview(user, '2150 Mastercard 3277');
    expect(button('Preview')).toBeDisabled();
    expect(screen.getByRole('radio', { name: '2120 Mastercard' })).toBeDisabled();
    await user.click(button('Preview'));
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => answers[0](planned(false, PLAN)));
    await screen.findByRole('region', { name: 'Re-point plan' });

    // The confirm is out: it cannot be sent twice, nor walked back half way.
    await user.click(button('Confirm'));
    expect(button('Confirm')).toBeDisabled();
    expect(button('Back')).toBeDisabled();
    await user.click(button('Confirm'));
    expect(post).toHaveBeenCalledTimes(2);

    await act(async () => answers[1](planned(true, PLAN)));
    expect(await screen.findByText(DONE)).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });
});
