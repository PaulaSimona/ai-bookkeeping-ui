// Staff feed re-point API (S87 B2b U1, O-S87-4 / O-S86-12): the targets read
// and the re-point request against the backend contract
// (accounting/staff_resolution_views.py StaffFeedRepointTargetsView /
// StaffFeedRepointView), and how a refusal comes back.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  REPOINT_NEW_ACCOUNT,
  fetchRepointTargets,
  repointFeed,
  type RepointPlan,
  type RepointTargets,
} from './useStaffRepoint';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const FEED = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const TARGETS_URL = `/api/accounting/staff/bank-accounts/${FEED}/repoint-targets/`;
const REPOINT_URL = `/api/accounting/staff/bank-accounts/${FEED}/repoint/`;

// As the server sends them (feed_repoint_service.py repoint_targets /
// RepointPlan.as_dict). Amounts are strings and stay strings.
const TARGETS: RepointTargets = {
  feed_id: FEED,
  current_account: { code: '2110', name: 'Visa' },
  targets: [
    { code: '2120', name: 'Mastercard' },
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
  card_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  card_switches: true,
  computed: '80.00',
  amount: '80.00',
  override_reason: null,
  legs: [
    {
      from_account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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

const ok = (executed: boolean, plan: unknown) => ({ status: 200, data: { executed, plan } });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('re-point targets', () => {
  it('reads the targets of one feed and returns them as sent', async () => {
    get.mockResolvedValue({ status: 200, data: TARGETS });

    const outcome = await fetchRepointTargets(FEED);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(TARGETS_URL);
    expect(outcome).toEqual({ ok: true, targets: TARGETS });
  });

  it('hands back the refusal of a feed that is not a card feed', async () => {
    get.mockResolvedValue({
      status: 409,
      data: { code: 'feed_not_card', detail: 'Only a credit-card feed can be re-pointed.' },
    });

    const outcome = await fetchRepointTargets(FEED);

    expect(outcome).toMatchObject({
      ok: false,
      refusal: {
        status: 409,
        code: 'feed_not_card',
        detail: 'Only a credit-card feed can be re-pointed.',
      },
    });
  });

  it('reports not found, the read limit and a lost connection', async () => {
    get.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    expect(await fetchRepointTargets(FEED)).toMatchObject({
      ok: false,
      refusal: { status: 404, detail: 'Not found' },
    });

    get.mockResolvedValueOnce({ status: 429, data: { detail: 'Request was throttled.' } });
    expect(await fetchRepointTargets(FEED)).toMatchObject({
      ok: false,
      refusal: { status: 429, detail: 'Too many requests just now. Try again in a minute.' },
    });

    get.mockRejectedValueOnce(new Error('network down'));
    expect(await fetchRepointTargets(FEED)).toEqual({
      ok: false,
      refusal: { detail: 'Could not load the accounts this feed can move to.', context: {} },
    });
  });
});

describe('re-point a feed', () => {
  it('asks for the plan first, and sends an override only when one is given', async () => {
    post.mockResolvedValue(ok(false, PLAN));

    const outcome = await repointFeed(FEED, { targetAccountCode: '2150', confirm: false });

    // No amount and no reason key at all: nothing is sent empty.
    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, {
      target_account_code: '2150',
      confirm: false,
    });
    expect(outcome).toEqual({ ok: true, executed: false, plan: PLAN });

    // A reason with no amount is not an override: still nothing extra.
    await repointFeed(FEED, {
      targetAccountCode: '2150',
      confirm: false,
      amount: '   ',
      reason: 'statement balance',
    });
    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, {
      target_account_code: '2150',
      confirm: false,
    });

    // An override: the amount exactly as typed (a string, never a number).
    await repointFeed(FEED, {
      targetAccountCode: '2150',
      confirm: false,
      amount: ' 50.00 ',
      reason: ' statement balance ',
    });
    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, {
      target_account_code: '2150',
      confirm: false,
      amount: '50.00',
      reason: 'statement balance',
    });
  });

  it('confirms with confirm true, and names a new account by the server word', async () => {
    const executed = { ...PLAN, entry_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' };
    post.mockResolvedValue(ok(true, executed));

    const outcome = await repointFeed(FEED, { targetAccountCode: '2150', confirm: true });

    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, {
      target_account_code: '2150',
      confirm: true,
    });
    expect(outcome).toEqual({ ok: true, executed: true, plan: executed });

    expect(REPOINT_NEW_ACCOUNT).toBe('new');
    await repointFeed(FEED, { targetAccountCode: REPOINT_NEW_ACCOUNT, confirm: false });
    expect(post).toHaveBeenLastCalledWith(REPOINT_URL, {
      target_account_code: 'new',
      confirm: false,
    });
  });

  it('hands back a refusal with its code, and a rejected body with its message', async () => {
    const openDrafts =
      'This feed has 1 open draft(s) on 2110. Post or resolve them first — approved ' +
      'later they would post to the account the feed has left.';
    post.mockResolvedValueOnce({ status: 409, data: { code: 'open_drafts', detail: openDrafts } });
    expect(await repointFeed(FEED, { targetAccountCode: '2150', confirm: true })).toMatchObject({
      ok: false,
      refusal: { status: 409, code: 'open_drafts', detail: openDrafts },
    });

    post.mockResolvedValueOnce({ status: 400, data: { amount: 'Must be a decimal string.' } });
    const rejected = await repointFeed(FEED, {
      targetAccountCode: '2150',
      confirm: false,
      amount: 'lots',
      reason: 'x',
    });
    expect(rejected).toMatchObject({
      ok: false,
      refusal: { status: 400, detail: 'Must be a decimal string.' },
    });
    expect(rejected.ok ? undefined : rejected.refusal.code).toBeUndefined();
  });
});
