import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/utils/api';
import { usePaginatedList } from '@/hooks/usePaginatedList';

/**
 * The Tier 2 Documents page's data (Release E2; backend Release E1):
 *   GET   /api/accounting/documents/status/              (paginated, filtered, sorted)
 *   PATCH /api/accounting/documents/<id>/name/           {display_name}
 *   POST  /api/accounting/documents/precheck/            {sha256}
 * The list's filters, page and open row live in the URL (O-S89-E7), so a
 * round trip to another page and back loses nothing. Amounts are the
 * server's strings and stay strings — display only.
 */

// Mirrors accounting/document_status_views.py DocumentStatusSerializer.
export interface DocumentRow {
  document_id: number;
  name: string; // the upload's filename (Tier 1), never edited
  created_at: string;
  extraction_status: string;
  accounting_status: string;
  routing_reason: string | null;
  // ── Release E (O-S89-E5) ──
  display_name: string; // the name the page shows: a manual or supplier name, else the filename
  display_name_source: 'filename' | 'supplier' | 'manual';
  document_date: string | null; // the date printed on the document, from the Tier 2 extraction
  uploaded_at: string; // when the document reached the accounting layer ("Uploaded")
  counterparty: { id: string; name: string } | null;
  read_as: string | null; // the supplier name the model read, as it read it
  total: string | null; // the server's two-decimal string
  currency: string | null;
  document_type: string | null;
  duplicate_of: { id: number; name: string } | null;
}

export const DOCUMENTS_STATUS_URL = '/api/accounting/documents/status/';

// The sorts the server accepts (document_status_views.py _SORTS); anything
// else is a 400 there.
export const DOCUMENT_SORTS = ['document_date', '-document_date', 'created_at', '-created_at'] as const;
export type DocumentSort = (typeof DOCUMENT_SORTS)[number];

export interface DocumentListFilters {
  status?: string;
  documentDateFrom?: string;
  documentDateTo?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
  counterparty?: string;
  q?: string;
  sort?: string;
}

// The list's query string: a filter that is not set is left out entirely,
// never sent empty; the search travels trimmed.
export const documentListParams = (filters: DocumentListFilters): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.documentDateFrom) params.document_date_from = filters.documentDateFrom;
  if (filters.documentDateTo) params.document_date_to = filters.documentDateTo;
  if (filters.uploadedFrom) params.uploaded_from = filters.uploadedFrom;
  if (filters.uploadedTo) params.uploaded_to = filters.uploadedTo;
  if (filters.counterparty) params.counterparty = filters.counterparty;
  const q = (filters.q ?? '').trim();
  if (q) params.q = q;
  if (filters.sort) params.sort = filters.sort;
  return params;
};

export const useDocumentList = (filters: DocumentListFilters) =>
  usePaginatedList<DocumentRow>(DOCUMENTS_STATUS_URL, documentListParams(filters));

// ─── URL-held state (O-S89-E7) ─────────────────────────────────────────────────

export interface DocumentListState extends DocumentListFilters {
  page: number; // 1-based
  open: number | null; // the open row's document id
}

// URL parameter ↔ state key, for the filters. The page and the open row are
// read and written apart (they are numbers).
const FILTER_PARAMS: [param: string, key: keyof DocumentListFilters][] = [
  ['status', 'status'],
  ['document_date_from', 'documentDateFrom'],
  ['document_date_to', 'documentDateTo'],
  ['uploaded_from', 'uploadedFrom'],
  ['uploaded_to', 'uploadedTo'],
  ['counterparty', 'counterparty'],
  ['q', 'q'],
  ['sort', 'sort'],
];

const positiveInt = (raw: string | null): number | null => {
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 ? value : null;
};

// What the URL says: every filter it names, page one unless it names a
// later page, no open row unless it names one. A value it cannot read (a
// page of 0, an open row that is not an id, a sort the server would refuse)
// is read as not set.
export const parseDocumentListState = (params: URLSearchParams): DocumentListState => {
  const state: DocumentListState = { page: positiveInt(params.get('page')) ?? 1, open: positiveInt(params.get('open')) };
  for (const [param, key] of FILTER_PARAMS) {
    const value = params.get(param);
    if (!value) continue;
    if (key === 'sort' && !(DOCUMENT_SORTS as readonly string[]).includes(value)) continue;
    state[key] = value;
  }
  return state;
};

// The URL for a state: only what is set, page and open row last; the
// defaults (page one, nothing open) are not written at all.
export const serializeDocumentListState = (state: DocumentListState): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [param, key] of FILTER_PARAMS) {
    const value = state[key];
    if (value) params.set(param, value);
  }
  if (state.page > 1) params.set('page', String(state.page));
  if (state.open != null) params.set('open', String(state.open));
  return params;
};

// The list's state, held in the URL's search params. `update` merges a
// patch: a change to any filter goes back to page one (unless the patch
// names a page itself); every write replaces the history entry, so Back
// leaves the page, never steps through filters. `clear` empties it.
export const useDocumentListState = () => {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseDocumentListState(params), [params]);

  const update = useCallback(
    (patch: Partial<DocumentListState>) => {
      const current = parseDocumentListState(params);
      const filterChanged = Object.keys(patch).some((key) => key !== 'page' && key !== 'open');
      const next: DocumentListState = {
        ...current,
        ...patch,
        page: patch.page ?? (filterChanged ? 1 : current.page),
      };
      setParams(serializeDocumentListState(next), { replace: true });
    },
    [params, setParams],
  );

  const clear = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  return { state, update, clear };
};

// ─── Rename (O-S89-E4) ─────────────────────────────────────────────────────────

export type RenameOutcome =
  | { ok: true; row: DocumentRow }
  | { ok: false; status?: number; detail: string };

const RENAME_LIMIT = 'The hourly limit for renaming has been reached. Try again later.';
const RENAME_FAILED = 'Could not rename the document.';

// What a refusal says: the field's message (400 {display_name}), else the
// server's detail, else the fallback.
const refusalDetail = (data: unknown, fallback: string): string => {
  if (data == null || typeof data !== 'object') return fallback;
  const body = data as Record<string, unknown>;
  for (const key of ['display_name', 'detail']) {
    const value = body[key];
    if (typeof value === 'string' && value) return value;
  }
  return fallback;
};

// Rename a document on the Tier 2 page. The name travels as typed; the
// server trims it, holds it to 200 characters, and an empty name returns the
// document to automatic naming. A 200 is a success only with a row in it.
export const renameDocument = async (documentId: number, name: string): Promise<RenameOutcome> => {
  try {
    const res = await api.patch(`/api/accounting/documents/${documentId}/name/`, { display_name: name });
    const data = res?.data as DocumentRow | null | undefined;
    if (res && res.status === 200 && data != null && typeof data === 'object' && 'document_id' in data) {
      return { ok: true, row: data };
    }
    const status: number | undefined = res?.status;
    if (status === 429) return { ok: false, status, detail: RENAME_LIMIT };
    return { ok: false, status, detail: refusalDetail(res?.data, RENAME_FAILED) };
  } catch {
    return { ok: false, detail: RENAME_FAILED };
  }
};

// ─── Pre-upload duplicate check (O-S89-E6) ─────────────────────────────────────

export type PrecheckAnswer =
  | { exists: false }
  | { exists: true; document_id: number; name: string; uploaded_at: string };

// Is a byte-identical file already in the org's books? Null on any refusal,
// limit or lost connection: the precheck never blocks an upload — the
// server's own hard-duplicate check at intake still applies.
export const precheckDocument = async (sha256: string): Promise<PrecheckAnswer | null> => {
  try {
    const res = await api.post('/api/accounting/documents/precheck/', { sha256 });
    const data = res?.data as Partial<PrecheckAnswer> | null | undefined;
    if (!res || res.status !== 200 || data == null || typeof data.exists !== 'boolean') return null;
    if (!data.exists) return { exists: false };
    if (typeof data.document_id !== 'number' || typeof data.name !== 'string') return null;
    return {
      exists: true,
      document_id: data.document_id,
      name: data.name,
      uploaded_at: String(data.uploaded_at ?? ''),
    };
  } catch {
    return null;
  }
};

// ─── Document types (default 6) ────────────────────────────────────────────────

// The server's document types (accounting/models.py
// Tier2DocumentExtraction.DocumentType) in the page's words — no server label
// exists for them. An unknown code is shown as sent.
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  invoice_received: 'Bill',
  invoice_issued: 'Invoice',
  credit_note_received: 'Credit note received',
  credit_note_issued: 'Credit note issued',
  payment_received: 'Payment received',
  payment_made: 'Payment made',
  bank_statement: 'Bank statement',
  unknown: 'Unknown',
};

export const documentTypeLabel = (code: string | null | undefined): string => {
  if (!code) return '—';
  return DOCUMENT_TYPE_LABELS[code] ?? code;
};
