// useDocumentList (Release E2-1, O-S89-E4/E5/E6/E7): the Tier 2 document
// list's query string, its URL-held state, the rename and the pre-upload
// duplicate check — against the backend contract (accounting/
// document_status_views.py, accounting/document_views.py).
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  DOCUMENT_SORTS,
  DOCUMENTS_STATUS_URL,
  documentListParams,
  documentTypeLabel,
  parseDocumentListState,
  precheckDocument,
  renameDocument,
  serializeDocumentListState,
  useDocumentListState,
  type DocumentRow,
} from './useDocumentList';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const SUPPLIER = 'c0c0c0c0-0000-4000-8000-000000000001';

// A row as the server sends it (document_status_views.py DocumentStatusSerializer).
const ROW: DocumentRow = {
  document_id: 41,
  name: 'IMG_0042.jpg',
  created_at: '2026-05-05T10:00:00Z',
  extraction_status: 'done',
  accounting_status: 'posted',
  routing_reason: null,
  display_name: 'Costco Wholesale',
  display_name_source: 'supplier',
  document_date: '2026-05-04',
  uploaded_at: '2026-05-05T10:00:01Z',
  counterparty: { id: SUPPLIER, name: 'Costco Wholesale' },
  read_as: 'COSTCO WHOLESALE',
  total: '113.00',
  currency: 'CAD',
  document_type: 'receipt',
  duplicate_of: null,
};

beforeEach(() => {
  patch.mockReset();
  post.mockReset();
});

describe('the query string', () => {
  it('omits every filter that is not set, and trims the search', () => {
    expect(documentListParams({})).toEqual({});
    expect(documentListParams({ status: '', q: '   ', sort: undefined })).toEqual({});
    expect(documentListParams({ q: '  costco ' })).toEqual({ q: 'costco' });
  });

  it("sends each set filter under the name the server reads", () => {
    expect(
      documentListParams({
        status: 'posted',
        documentDateFrom: '2026-05-01',
        documentDateTo: '2026-05-31',
        uploadedFrom: '2026-04-01',
        uploadedTo: '2026-04-30',
        counterparty: SUPPLIER,
        q: 'costco',
        sort: '-document_date',
      }),
    ).toEqual({
      status: 'posted',
      document_date_from: '2026-05-01',
      document_date_to: '2026-05-31',
      uploaded_from: '2026-04-01',
      uploaded_to: '2026-04-30',
      counterparty: SUPPLIER,
      q: 'costco',
      sort: '-document_date',
    });
    expect(DOCUMENTS_STATUS_URL).toBe('/api/accounting/documents/status/');
    expect(DOCUMENT_SORTS).toEqual(['document_date', '-document_date', 'created_at', '-created_at']);
  });
});

describe('the URL-held state', () => {
  it('starts empty: page one, nothing open, no filter', () => {
    expect(parseDocumentListState(new URLSearchParams(''))).toEqual({ page: 1, open: null });
  });

  it('reads every parameter, and drops a page, open row or sort it cannot read', () => {
    const params = new URLSearchParams(
      'status=posted&document_date_from=2026-05-01&document_date_to=2026-05-31'
      + '&uploaded_from=2026-04-01&uploaded_to=2026-04-30'
      + `&counterparty=${SUPPLIER}&q=costco&sort=-document_date&page=3&open=41`,
    );
    expect(parseDocumentListState(params)).toEqual({
      status: 'posted',
      documentDateFrom: '2026-05-01',
      documentDateTo: '2026-05-31',
      uploadedFrom: '2026-04-01',
      uploadedTo: '2026-04-30',
      counterparty: SUPPLIER,
      q: 'costco',
      sort: '-document_date',
      page: 3,
      open: 41,
    });
    expect(parseDocumentListState(new URLSearchParams('page=0&open=x&sort=name'))).toEqual({
      page: 1,
      open: null,
    });
    expect(parseDocumentListState(new URLSearchParams('page=2.5&open=-1'))).toEqual({ page: 1, open: null });
  });

  it('writes only what is set, and reads its own writing back', () => {
    const state = parseDocumentListState(new URLSearchParams(`q=costco&page=2&open=41&counterparty=${SUPPLIER}`));
    const written = serializeDocumentListState(state);
    expect(written.toString()).toBe(`counterparty=${SUPPLIER}&q=costco&page=2&open=41`);
    expect(parseDocumentListState(written)).toEqual(state);
    // Defaults are not written at all.
    expect(serializeDocumentListState({ page: 1, open: null }).toString()).toBe('');
  });

  it('a change of filter goes back to page one and replaces the history entry; clear empties it', () => {
    const locations: string[] = [];
    const Probe = () => {
      const location = useLocation();
      locations.push(location.search);
      return null;
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        { initialEntries: ['/accounting/documents?q=old&page=3'] },
        children,
        createElement(Probe),
      );
    const { result } = renderHook(() => useDocumentListState(), { wrapper });
    expect(result.current.state).toEqual({ q: 'old', page: 3, open: null });

    act(() => result.current.update({ q: 'costco' }));
    expect(result.current.state).toEqual({ q: 'costco', page: 1, open: null });
    expect(locations.at(-1)).toBe('?q=costco');

    // Turning a page keeps the filter; opening a row keeps the page.
    act(() => result.current.update({ page: 2 }));
    act(() => result.current.update({ open: 41 }));
    expect(result.current.state).toEqual({ q: 'costco', page: 2, open: 41 });

    act(() => result.current.clear());
    expect(result.current.state).toEqual({ page: 1, open: null });
    expect(locations.at(-1)).toBe('');
  });
});

describe('rename', () => {
  it('sends the name to the document and hands back the row the server answered with', async () => {
    patch.mockResolvedValue({ status: 200, data: { ...ROW, display_name: 'May supplies', display_name_source: 'manual' } });

    const outcome = await renameDocument(41, '  May supplies ');

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith('/api/accounting/documents/41/name/', { display_name: '  May supplies ' });
    expect(outcome).toEqual({ ok: true, row: { ...ROW, display_name: 'May supplies', display_name_source: 'manual' } });
  });

  it("hands back the server's words on a refusal, a 404 as gone, and a lost connection without inventing a row", async () => {
    patch.mockResolvedValueOnce({ status: 400, data: { display_name: 'The name may not exceed 200 characters.' } });
    expect(await renameDocument(41, 'x')).toEqual({
      ok: false,
      status: 400,
      detail: 'The name may not exceed 200 characters.',
    });
    patch.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    expect(await renameDocument(41, 'x')).toEqual({ ok: false, status: 404, detail: 'Not found.' });
    patch.mockResolvedValueOnce({ status: 429, data: { detail: 'Request was throttled.' } });
    expect(await renameDocument(41, 'x')).toEqual({
      ok: false,
      status: 429,
      detail: 'The hourly limit for renaming has been reached. Try again later.',
    });
    patch.mockRejectedValueOnce(new Error('network down'));
    expect(await renameDocument(41, 'x')).toEqual({ ok: false, detail: 'Could not rename the document.' });
    // A 200 without a row is not a success either.
    patch.mockResolvedValueOnce({ status: 200, data: null });
    expect(await renameDocument(41, 'x')).toMatchObject({ ok: false });
  });
});

describe('the pre-upload duplicate check', () => {
  it('sends the hash and nothing else, and hands back the answer as the server gave it', async () => {
    const sha = 'a'.repeat(64);
    post.mockResolvedValueOnce({ status: 200, data: { exists: false } });
    expect(await precheckDocument(sha)).toEqual({ exists: false });
    expect(post).toHaveBeenCalledWith('/api/accounting/documents/precheck/', { sha256: sha });

    const found = { exists: true, document_id: 41, name: 'Costco Wholesale', uploaded_at: '2026-05-05T10:00:01Z' };
    post.mockResolvedValueOnce({ status: 200, data: found });
    expect(await precheckDocument(sha)).toEqual(found);
  });

  it('answers null — never blocks an upload — on a refusal, a limit or a lost connection', async () => {
    post.mockResolvedValueOnce({ status: 429, data: { detail: 'Request was throttled.' } });
    expect(await precheckDocument('a'.repeat(64))).toBeNull();
    post.mockResolvedValueOnce({ status: 400, data: { sha256: 'Must be a 64-character hex SHA-256.' } });
    expect(await precheckDocument('bad')).toBeNull();
    post.mockRejectedValueOnce(new Error('network down'));
    expect(await precheckDocument('a'.repeat(64))).toBeNull();
    post.mockResolvedValueOnce({ status: 200, data: { something: 'else' } });
    expect(await precheckDocument('a'.repeat(64))).toBeNull();
  });
});

describe('document types', () => {
  it("labels the server's document types, shows an unknown code as sent, and a dash for none", () => {
    expect(documentTypeLabel('receipt')).toBe('Receipt');
    expect(documentTypeLabel('invoice_received')).toBe('Bill');
    expect(documentTypeLabel('invoice_issued')).toBe('Invoice');
    expect(documentTypeLabel('credit_note_received')).toBe('Credit note received');
    expect(documentTypeLabel('credit_note_issued')).toBe('Credit note issued');
    expect(documentTypeLabel('payment_received')).toBe('Payment received');
    expect(documentTypeLabel('payment_made')).toBe('Payment made');
    expect(documentTypeLabel('bank_statement')).toBe('Bank statement');
    expect(documentTypeLabel('unknown')).toBe('Unknown');
    expect(documentTypeLabel('something_new')).toBe('something_new');
    expect(documentTypeLabel(null)).toBe('—');
  });
});
