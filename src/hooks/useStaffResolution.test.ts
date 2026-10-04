// Staff remediation API (UI2-U5, D-S84-7): the four request bodies and URLs
// against the backend contract (accounting/remediation_views.py /
// remediation_serializers.py), and how a refusal comes back.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  attachStaffDocument,
  dismissDuplicateDocument,
  mergeStaffEntry,
  remediationSummary,
  reverseStaffEntry,
  type RemediationOutcome,
} from './useStaffResolution';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const ENTRY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SURVIVOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REASON = 'Entered twice';

// The exact request each action sends. The bodies are strict server-side: an
// extra key is a 400.
const EXPECTED = {
  reverse: {
    url: `/api/accounting/staff/entries/${ENTRY}/reverse/`,
    body: { reason: REASON },
  },
  merge: {
    url: `/api/accounting/staff/entries/${ENTRY}/merge-into/`,
    body: { survivor_entry_id: SURVIVOR, reason: REASON },
  },
  attach: {
    url: `/api/accounting/staff/entries/${ENTRY}/attach-document/`,
    body: { document_id: 41, reason: REASON },
  },
  dismiss: {
    url: '/api/accounting/staff/documents/41/dismiss-duplicate/',
    body: { reason: REASON },
  },
};

const CALLS: Record<keyof typeof EXPECTED, () => Promise<RemediationOutcome>> = {
  reverse: () => reverseStaffEntry(ENTRY, REASON),
  merge: () => mergeStaffEntry(ENTRY, SURVIVOR, REASON),
  attach: () => attachStaffDocument(ENTRY, 41, REASON),
  dismiss: () => dismissDuplicateDocument(41, REASON),
};

// Every refusal the four endpoints answer with: status, code, the server's
// detail, and the context keys that travel with the code.
const REFUSALS: [code: string, status: number, body: Record<string, unknown>][] = [
  ['not_posted', 400, { detail: 'Only a posted entry can be used here.', field: 'entry', current_status: 'draft' }],
  ['reversal_source_blocked', 400, { detail: 'A reversal entry cannot be used here. Use the entry it reversed.', field: 'entry', current_status: 'posted' }],
  ['already_reversed', 409, { detail: 'This entry has already been reversed.', field: 'entry', current_status: 'posted' }],
  ['already_corrected', 409, { detail: 'This entry has already been corrected. Use the correcting entry instead.', field: 'survivor_entry_id', current_status: 'posted' }],
  ['entry_has_links', 409, { detail: 'This entry is linked to a bank transaction or a document. Merge it into the entry that should keep those links, or correct it, instead of reversing it.', field: 'entry', links: ['bank_state', 'active_match', 'document_state'] }],
  ['same_chain', 400, { detail: 'An entry cannot be merged into itself or into an entry of its own correction chain.', field: 'survivor_entry_id' }],
  ['amount_mismatch', 400, { detail: 'The two entries are not for the same amount, so one is not a duplicate of the other.', duplicate_total: '100.00', survivor_total: '120.00' }],
  ['bank_link_would_break', 400, { detail: 'A bank match on this entry cannot be carried over.', transaction_id: 'txn-1' }],
  ['duplicate_has_itc_adjustment', 409, { detail: 'The duplicate has a live ITC adjustment.', adjustment_entry_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }],
  ['document_in_processing', 409, { detail: 'This document is still being processed. Try again once it has been drafted or routed.', document_status: 'processing' }],
  ['document_rejected', 409, { detail: 'This document was rejected and cannot be attached.' }],
  ['document_has_open_draft', 409, { detail: 'This document has a draft entry awaiting review. Resolve that draft first.', entry_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }],
  ['document_attached_to_live_entry', 409, { detail: 'This document is already attached to a live entry. Merge that entry instead.', entry_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }],
  ['already_posted', 409, { detail: 'This document already has a posted entry.' }],
  ['already_rejected', 409, { detail: 'This document was already rejected.' }],
];

beforeEach(() => {
  post.mockReset();
});

describe('staff remediation — requests', () => {
  it.each(Object.keys(EXPECTED) as (keyof typeof EXPECTED)[])(
    '%s sends exactly its contract body to its URL',
    async (action) => {
      post.mockResolvedValue({ status: 201, data: { action, entries_created: [], moved: {} } });
      const outcome = await CALLS[action]();

      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith(EXPECTED[action].url, EXPECTED[action].body);
      expect(outcome.ok).toBe(true);
    },
  );

  it('attach sends the document id as an integer', async () => {
    post.mockResolvedValue({ status: 201, data: { action: 'attach_document', entries_created: [], moved: {} } });
    await attachStaffDocument(ENTRY, 41, REASON);
    const body = post.mock.calls[0][1] as { document_id: unknown };
    expect(body.document_id).toBe(41);
    expect(typeof body.document_id).toBe('number');
  });

  it('hands back what the action created and moved', async () => {
    const data = {
      action: 'reverse',
      entry: { id: ENTRY, entry_number: 68 },
      entries_created: [{ id: 'r-1', entry_number: 120, kind: 'reversal' }],
      moved: {},
    };
    post.mockResolvedValue({ status: 201, data });
    const outcome = await reverseStaffEntry(ENTRY, REASON);
    expect(outcome).toEqual({ ok: true, result: data });
  });
});

describe('staff remediation — refusals', () => {
  it.each(REFUSALS)('%s: the code, the server\'s detail and its context come back', async (code, status, body) => {
    post.mockResolvedValue({ status, data: { code, ...body } });
    const outcome = await reverseStaffEntry(ENTRY, REASON);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.status).toBe(status);
    expect(outcome.refusal.code).toBe(code);
    expect(outcome.refusal.detail).toBe(body.detail);
    expect(outcome.refusal.context).toEqual({ code, ...body });
  });

  it('404 is the staff lane\'s "Not found"', async () => {
    post.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    const outcome = await attachStaffDocument(ENTRY, 41, REASON);
    expect(outcome).toEqual({
      ok: false,
      refusal: { status: 404, detail: 'Not found', context: { detail: 'Not found.' } },
    });
  });

  it('429 says the hourly limit was reached', async () => {
    post.mockResolvedValue({
      status: 429,
      data: { detail: 'Request was throttled. Expected available in 1800 seconds.' },
    });
    for (const call of Object.values(CALLS)) {
      const outcome = await call();
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.refusal.status).toBe(429);
      expect(outcome.refusal.detail).toBe(
        'The hourly limit for these actions has been reached. Try again later.',
      );
    }
  });

  it('a serializer error (no code) is shown as the server worded it', async () => {
    post.mockResolvedValue({ status: 400, data: { reason: ['This field may not be blank.'] } });
    const outcome = await reverseStaffEntry(ENTRY, '');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusal.code).toBeUndefined();
    expect(outcome.refusal.detail).toBe('This field may not be blank.');
  });

  it('a failed request is a refusal, never a throw', async () => {
    post.mockRejectedValue(new Error('network'));
    const outcome = await mergeStaffEntry(ENTRY, SURVIVOR, REASON);
    expect(outcome).toEqual({ ok: false, refusal: { detail: 'Merge failed.', context: {} } });
  });
});

describe('remediationSummary — the success message lists what moved', () => {
  it('reverse', () => {
    expect(
      remediationSummary({
        action: 'reverse',
        entry: { id: ENTRY, entry_number: 68 },
        entries_created: [{ id: 'r-1', entry_number: 120, kind: 'reversal' }],
        moved: {},
      }),
    ).toBe('JE-0068 reversed. Created JE-0120 (reversal).');
  });

  it('merge', () => {
    expect(
      remediationSummary({
        action: 'merge',
        entry: { id: ENTRY, entry_number: 68 },
        survivor: { id: SURVIVOR, entry_number: 90 },
        entries_created: [{ id: 'r-1', entry_number: 121, kind: 'reversal' }],
        moved: {
          bank_state_ids: ['bs-1'],
          matches_carried: ['m-1'],
          matches_unmatched: [],
          documents: [{ document_id: 41, mode: 'full' }],
          source_document_id: 41,
        },
      }),
    ).toBe(
      'JE-0068 merged into JE-0090. Created JE-0121 (reversal). Moved: 1 bank link(s); ' +
        '1 match(es) carried; 0 match(es) left unmatched; document 41 (full).',
    );
  });

  it('attach document', () => {
    expect(
      remediationSummary({
        action: 'attach_document',
        entry: { id: ENTRY, entry_number: 68 },
        entries_created: [{ id: 'a-1', entry_number: 122, kind: 'itc_adjustment' }],
        moved: {
          documents: [{ document_id: 41, mode: 'pointer_only', from_entry_id: null, to_entry_id: ENTRY }],
        },
      }),
    ).toBe('Attached to JE-0068: document 41 (pointer only). Created JE-0122 (itc adjustment).');
  });

  it('dismiss duplicate', () => {
    expect(
      remediationSummary({ action: 'dismiss_duplicate', document_id: 41, entries_created: [], moved: {} }),
    ).toBe('Document 41 dismissed as a duplicate.');
  });
});
