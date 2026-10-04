// useStaffEntryDetail (UI2-U0): the staff detail read keeps all six registry
// fields, so the Correct guard and the chain panel can read them.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { useStaffEntryDetail } from './useStaffReports';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

const ENTRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LIVE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// The staff detail payload as the registry serializer sends it: an original
// that JE-0102 corrected.
const PAYLOAD = {
  id: ENTRY_ID,
  org_id: '11111111-1111-4111-8111-111111111111',
  entry_number: 68,
  entry_number_display: 'JE-0068',
  entry_date: '2026-09-30',
  description: 'September rent',
  source: 'ai',
  status: 'posted',
  needs_review: false,
  created_by: 'agent',
  voided_at: null,
  voided_by: null,
  void_reason: '',
  source_document_id: 41,
  reverses_entry_id: null,
  reversed_by_entry_id: null,
  reverses_entry_number_display: null,
  reversed_by_entry_number_display: null,
  corrects_entry_id: null,
  corrects_entry_number_display: null,
  counterparty: { id: 'cp-1', name: 'Birch Inc' },
  total_debits: '100.00',
  total_credits: '100.00',
  is_balanced: true,
  lines: [
    {
      id: 'line-1',
      account_id: 'acc-5000',
      account_code: '5000',
      account_name: 'Rent Expense',
      debit: '100.00',
      credit: null,
      description: 'Office rent',
      tax_code: 'HST',
      line_order: 0,
    },
  ],
  display_status: 'corrected',
  corrected_by: { id: LIVE_ID, number: 'JE-0102' },
  live_entry: { id: LIVE_ID, number: 'JE-0102' },
  chain_root: { id: ENTRY_ID, number: 'JE-0068' },
  chain: [
    { id: ENTRY_ID, number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'corrected' },
    { id: LIVE_ID, number: 'JE-0102', date: '2026-10-02', role: 'correction', display_status: 'posted' },
  ],
  chain_truncated: false,
};

beforeEach(() => {
  get.mockReset();
});

describe('useStaffEntryDetail', () => {
  it('keeps all six registry fields of the detail payload', async () => {
    get.mockResolvedValue({ status: 200, data: PAYLOAD });
    const { result } = renderHook(() => useStaffEntryDetail(ENTRY_ID));
    await waitFor(() => expect(result.current.entry?.kind).toBe('ready'));

    expect(get).toHaveBeenCalledWith(`/api/accounting/staff/entries/${ENTRY_ID}/`);
    const state = result.current.entry;
    if (state?.kind !== 'ready') throw new Error('expected a loaded entry');
    expect(state.row).toMatchObject({
      display_status: PAYLOAD.display_status,
      corrected_by: PAYLOAD.corrected_by,
      live_entry: PAYLOAD.live_entry,
      chain_root: PAYLOAD.chain_root,
      chain: PAYLOAD.chain,
      chain_truncated: PAYLOAD.chain_truncated,
    });
  });

  it('also carries the number, the counterparty and each line\'s description and tax code', async () => {
    get.mockResolvedValue({ status: 200, data: PAYLOAD });
    const { result } = renderHook(() => useStaffEntryDetail(ENTRY_ID));
    await waitFor(() => expect(result.current.entry?.kind).toBe('ready'));

    const state = result.current.entry;
    if (state?.kind !== 'ready') throw new Error('expected a loaded entry');
    expect(state.row.entry_number).toBe(68);
    expect(state.row.counterparty).toEqual({ id: 'cp-1', name: 'Birch Inc' });
    expect(state.row.lines[0]).toMatchObject({ description: 'Office rent', tax_code: 'HST' });
  });

  it('does not invent registry fields a payload does not carry', async () => {
    // A row without them must never read as live.
    const { display_status, corrected_by, live_entry, chain_root, chain, chain_truncated, ...plain } = PAYLOAD;
    void [display_status, corrected_by, live_entry, chain_root, chain, chain_truncated];
    get.mockResolvedValue({ status: 200, data: plain });
    const { result } = renderHook(() => useStaffEntryDetail(ENTRY_ID));
    await waitFor(() => expect(result.current.entry?.kind).toBe('ready'));

    const state = result.current.entry;
    if (state?.kind !== 'ready') throw new Error('expected a loaded entry');
    expect(state.row.display_status).toBeUndefined();
    expect(state.row.live_entry).toBeUndefined();
  });

  it('reports a resolved error instead of a row', async () => {
    get.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    const { result } = renderHook(() => useStaffEntryDetail(ENTRY_ID));
    await waitFor(() => expect(result.current.entry?.kind).toBe('error'));
  });
});
