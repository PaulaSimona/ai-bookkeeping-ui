import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { type LedgerEntryRow } from '@/hooks/useLedgerEntries';
import { formatEntryNumber } from '@/utils/entryStatus';

/**
 * Internal-staff client-data resolution (backend s28, fe71367). Lets an assigned
 * reviewer / super user read+create the client records needed to resolve a review:
 *   GET/POST /api/accounting/staff/orgs/<org_id>/accounts/
 *   GET/POST /api/accounting/staff/orgs/<org_id>/counterparties/
 *   POST     /api/accounting/staff/entries/<id>/attribute/
 *   POST     /api/accounting/staff/entries/<id>/correct/    (S70 3c, O-S70-6)
 *   POST     /api/accounting/staff/entries/<id>/reverse/ · merge-into/ ·
 *            attach-document/, staff/documents/<id>/dismiss-duplicate/  (S84 CW4)
 *   GET      /api/accounting/staff/orgs/<org_id>/entries/  (paginated)
 *   GET/POST /api/accounting/staff/orgs/<org_id>/cards/    (paginated; s29)
 *   PATCH    /api/accounting/staff/cards/<pk>/             (s29)
 *   POST     /api/accounting/staff/cards/<pk>/resend-notification/  (s31 C2)
 * Same error/auth handling as useInternalReview: the api interceptor RESOLVES
 * non-401 errors, so every call status-checks the resolved response and surfaces
 * the backend `detail` verbatim.
 */

// Mirrors accounting/serializers.py AccountSerializer (the read shape we use).
export interface StaffAccount {
  id: string;
  code: string;
  name: string;
  type: string; // asset | liability | equity | revenue | expense
  normal_balance: string; // debit | credit
  is_active: boolean;
  parent_account_id: string | null;
  full_name: string; // "code — name"
}

// Mirrors accounting/counterparty_serializers.py CounterpartySerializer.
export interface StaffCounterparty {
  id: string;
  name: string;
  is_client: boolean;
  is_supplier: boolean;
  archived: boolean;
}

// The staff entries endpoint serializes JournalEntrySerializer — same row shape
// the owner ledger uses (reuse the type; do not redefine).
export type StaffLedgerEntry = LedgerEntryRow;

export interface WriteResult<T = unknown> {
  ok: boolean;
  data?: T;
  status?: number;
  // The server's refusal code ({code, detail, ...}) when it sent one.
  code?: string;
  errorDetail?: string;
}

const refusalCode = (res: unknown): string | undefined => {
  const code = (res as { data?: { code?: unknown } } | null | undefined)?.data?.code;
  return typeof code === 'string' && code ? code : undefined;
};

const extractDetail = (res: unknown, fallback: string): string => {
  const data = (res as { data?: unknown } | null | undefined)?.data;
  if (data == null || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string' && obj.detail) return obj.detail;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'code') continue;
    if (Array.isArray(val)) parts.push(val.map((v) => String(v)).join(' '));
    else if (typeof val === 'string') parts.push(val);
  }
  return parts.length ? parts.join(' ') : fallback;
};

// Read the full list off a paginated envelope in one page (the counterparty
// picker needs the whole set; the active counterparties fit under the 200
// server max).
const fetchAll = async <T>(url: string, params?: Record<string, string>): Promise<T[]> => {
  const res = await api.get(url, { params: { ...(params ?? {}), page_size: 200 } });
  if (res == null || res.status !== 200) return [];
  const data = res.data;
  if (Array.isArray(data)) return data as T[];
  return Array.isArray(data?.results) ? (data.results as T[]) : [];
};

// ─── Accounts ──────────────────────────────────────────────────────────────────
// The chart itself is read through useAllAccounts('staff', orgId) (every page,
// D-S84-6) — this file only creates an account from the reject-correct editor.

export const createStaffOrgAccount = async (
  orgId: string,
  payload: {
    code: string;
    name: string;
    type: string;
    normal_balance: string;
    parent_account_id?: string | null;
  },
): Promise<WriteResult<StaffAccount>> => {
  try {
    const res = await api.post(`/api/accounting/staff/orgs/${orgId}/accounts/`, payload);
    if (res && res.status === 201) return { ok: true, data: res.data as StaffAccount };
    return { ok: false, status: res?.status, errorDetail: extractDetail(res, 'Failed to create account.') };
  } catch {
    return { ok: false, errorDetail: 'Failed to create account.' };
  }
};

// ─── Counterparties (the attribution picker) ───────────────────────────────────

export const useStaffOrgCounterparties = (
  orgId: string | null | undefined,
  opts?: { archived?: boolean },
) => {
  const archived = opts?.archived ? 'true' : 'false';
  const [counterparties, setCounterparties] = useState<StaffCounterparty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!orgId) {
      setCounterparties([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchAll<StaffCounterparty>(`/api/accounting/staff/orgs/${orgId}/counterparties/`, { archived })
      .then((rows) => {
        if (!cancelled) setCounterparties(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load counterparties.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, archived, revision]);

  return { counterparties, isLoading, error, refetch };
};

export const createStaffOrgCounterparty = async (
  orgId: string,
  payload: { name: string; is_client?: boolean; is_supplier?: boolean },
): Promise<WriteResult<StaffCounterparty>> => {
  try {
    const res = await api.post(`/api/accounting/staff/orgs/${orgId}/counterparties/`, payload);
    if (res && res.status === 201) return { ok: true, data: res.data as StaffCounterparty };
    return { ok: false, status: res?.status, errorDetail: extractDetail(res, 'Failed to create counterparty.') };
  } catch {
    return { ok: false, errorDetail: 'Failed to create counterparty.' };
  }
};

// ─── Entry attribution ─────────────────────────────────────────────────────────

// S69 E7/E8 (O-S69-1 / O-S69-20 / D-S69-17): the staff lane REPLACES or CLEARS
// a counterparty. Body key is the ruled `counterparty` (uuid | null → clear);
// `reason` is optional (≤500). The response carries `changed` — false when the
// target already equalled the current value (nothing written, nothing audited).
// A refusal carries the server's `code` (409 not_editable) and its `detail`.
export const attributeStaffEntry = async (
  entryId: string,
  counterparty: string | null,
  reason?: string,
): Promise<WriteResult<{ changed: boolean }>> => {
  try {
    const res = await api.post(`/api/accounting/staff/entries/${entryId}/attribute/`, {
      counterparty,
      ...(reason ? { reason } : {}),
    });
    if (res && res.status === 200) {
      return { ok: true, status: 200, data: { changed: res.data?.changed !== false } };
    }
    return {
      ok: false,
      status: res?.status,
      code: refusalCode(res),
      errorDetail: extractDetail(res, 'Attribution failed.'),
    };
  } catch {
    return { ok: false, errorDetail: 'Attribution failed.' };
  }
};

// ─── Posted-entry correction (S70 3c, F-S69-8 / O-S70-6; S84 CW2) ─────────────

// Body of POST staff/entries/<id>/correct/ — mirrors the backend contract
// (accounting/staff_serializers.py StaffCorrectionSerializer /
// StaffCorrectionLineSerializer) exactly: a free-text `reason` (required,
// ≤500) and the corrected lines {account_id, side, amount, description,
// tax_code}. `amount` is a 2-dp STRING (money is never a float; the server
// parses it to Decimal). description (≤500) and tax_code (≤20) are carried
// onto the new line as given (D-S85-17); both may be blank. The body is
// STRICT — an unknown key is a 400 — and every account must be ACTIVE. No
// counterparty key is sent: the correction inherits the entry's (the server's
// default counterparty_mode).
export interface CorrectedLine {
  account_id: string;
  side: 'debit' | 'credit';
  amount: string;
  description: string;
  tax_code: string;
}

export interface CorrectPostedPayload {
  reason: string;
  lines: CorrectedLine[];
}

// The 201 body is the ONE new correction entry, serialized by
// JournalEntrySerializer (the same shape the ledger list uses — reuse, do not
// redefine; it carries no chain fields). The fields the editor reads are
// pinned here; corrects_entry_id points back at the entry it corrects.
export type CorrectedEntry = LedgerEntryRow & { corrects_entry_id: string | null };

export type CorrectPostedResult =
  | { ok: true; entry: CorrectedEntry }
  | { ok: false; status?: number; code?: string; errorDetail: string };

// Error mapping (O-S70-6): a refusal arrives as {code, detail, ...} — `code`
// is handed back so the editor can tell them apart (409 already_corrected /
// already_reversed: the entry is no longer live) and `detail` is what the
// reviewer reads, verbatim; 404 → the §16 IDOR shape; 429 → the staff_write /
// staff_correction throttle.
export const correctPostedEntry = async (
  entryId: string,
  payload: CorrectPostedPayload,
): Promise<CorrectPostedResult> => {
  try {
    const res = await api.post(`/api/accounting/staff/entries/${entryId}/correct/`, payload);
    if (res && res.status === 201 && res.data) {
      return { ok: true, entry: res.data as CorrectedEntry };
    }
    const status = res?.status;
    if (status === 404) return { ok: false, status, errorDetail: 'Not found' };
    if (status === 429) {
      return { ok: false, status, errorDetail: 'Rate limit — try again in a minute' };
    }
    return {
      ok: false,
      status,
      code: refusalCode(res),
      errorDetail: extractDetail(res, 'Correction failed.'),
    };
  } catch {
    return { ok: false, errorDetail: 'Correction failed.' };
  }
};

// ─── Staff remediation (S84 CW4, D-S84-7 / D-S85-14) ──────────────────────────
// Four staff-lane writes (backend accounting/remediation_views.py), each one
// transaction and one audit row:
//   POST staff/entries/<id>/reverse/             {reason}
//   POST staff/entries/<id>/merge-into/          {survivor_entry_id, reason}
//   POST staff/entries/<id>/attach-document/     {document_id, reason}
//   POST staff/documents/<id>/dismiss-duplicate/ {reason}
// The bodies are STRICT (an unknown key is a 400). Success is 201 with every
// entry the action created and what it moved. A refusal is {code, detail,
// ...context}: 409 for a state conflict, 400 otherwise, the staff lane's 404
// for anything the caller may not see, 429 for the shared hourly limit.

export interface RemediationEntryRef {
  id: string;
  entry_number: number | null;
}

export interface RemediationCreatedEntry extends RemediationEntryRef {
  kind: string; // reversal | itc_adjustment | …
}

export interface RemediationResult {
  action: string;
  entry?: RemediationEntryRef;
  survivor?: RemediationEntryRef;
  document_id?: number;
  entries_created: RemediationCreatedEntry[];
  moved: Record<string, unknown>;
}

// A refusal as the server sent it. `detail` is the server's own text and is
// what the reviewer reads; `code` tells the refusals apart; `context` holds
// the rest of the body (field, links, entry_id, adjustment_entry_id,
// duplicate_total, survivor_total, current_status, …).
export interface RemediationRefusal {
  status?: number;
  code?: string;
  detail: string;
  context: Record<string, unknown>;
}

export type RemediationOutcome =
  | { ok: true; result: RemediationResult }
  | { ok: false; refusal: RemediationRefusal };

export const REMEDIATION_REASON_MAX = 500;

const remediate = async (
  url: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<RemediationOutcome> => {
  try {
    const res = await api.post(url, body);
    if (res && res.status === 201 && res.data) {
      const data = res.data as Partial<RemediationResult>;
      return {
        ok: true,
        result: {
          ...data,
          action: data.action ?? '',
          entries_created: Array.isArray(data.entries_created) ? data.entries_created : [],
          moved: data.moved ?? {},
        },
      };
    }
    const status = res?.status;
    const raw = res?.data;
    const context: Record<string, unknown> =
      raw != null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    if (status === 404) return { ok: false, refusal: { status, detail: 'Not found', context } };
    if (status === 429) {
      return {
        ok: false,
        refusal: {
          status,
          detail: 'The hourly limit for these actions has been reached. Try again later.',
          context,
        },
      };
    }
    return {
      ok: false,
      refusal: { status, code: refusalCode(res), detail: extractDetail(res, fallback), context },
    };
  } catch {
    return { ok: false, refusal: { detail: fallback, context: {} } };
  }
};

// Reverse a live entry that nothing points at. 409 entry_has_links (context
// `links`) when a bank state, an active match or a document state does.
export const reverseStaffEntry = (entryId: string, reason: string) =>
  remediate(`/api/accounting/staff/entries/${entryId}/reverse/`, { reason }, 'Reversal failed.');

// Merge the duplicate entry into the entry that survives.
export const mergeStaffEntry = (entryId: string, survivorEntryId: string, reason: string) =>
  remediate(
    `/api/accounting/staff/entries/${entryId}/merge-into/`,
    { survivor_entry_id: survivorEntryId, reason },
    'Merge failed.',
  );

// Attach one of the org's documents to a live entry. A document outside the
// entry's org is the same 404 as one that does not exist.
export const attachStaffDocument = (entryId: string, documentId: number, reason: string) =>
  remediate(
    `/api/accounting/staff/entries/${entryId}/attach-document/`,
    { document_id: documentId, reason },
    'Attaching the document failed.',
  );

// Reject an UNPOSTED document as a duplicate and clear its duplicate flag.
export const dismissDuplicateDocument = (documentId: number, reason: string) =>
  remediate(
    `/api/accounting/staff/documents/${documentId}/dismiss-duplicate/`,
    { reason },
    'Dismissing the document failed.',
  );

const createdLabel = (e: RemediationCreatedEntry): string =>
  `${formatEntryNumber(e.entry_number) ?? 'an entry'} (${e.kind.replace(/_/g, ' ')})`;

// One line saying what an action did and what it moved — the success message.
export const remediationSummary = (result: RemediationResult): string => {
  const entry = formatEntryNumber(result.entry?.entry_number) ?? 'The entry';
  const created = result.entries_created.map(createdLabel);
  const createdText = created.length > 0 ? ` Created ${created.join(', ')}.` : '';
  const moved = result.moved as {
    bank_state_ids?: unknown[];
    matches_carried?: unknown;
    matches_unmatched?: unknown;
    documents?: { document_id?: number; mode?: string }[];
  };
  const count = (v: unknown): number => (Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0);
  const documents = Array.isArray(moved.documents) ? moved.documents : [];
  const documentText = documents
    .map((d) => `document ${d.document_id ?? '—'}${d.mode ? ` (${d.mode.replace(/_/g, ' ')})` : ''}`)
    .join(', ');

  switch (result.action) {
    case 'reverse':
      return `${entry} reversed.${createdText}`;
    case 'merge': {
      const survivor = formatEntryNumber(result.survivor?.entry_number) ?? 'the surviving entry';
      const parts = [
        `${count(moved.bank_state_ids)} bank link(s)`,
        `${count(moved.matches_carried)} match(es) carried`,
        `${count(moved.matches_unmatched)} match(es) left unmatched`,
        documentText || 'no documents',
      ];
      return `${entry} merged into ${survivor}.${createdText} Moved: ${parts.join('; ')}.`;
    }
    case 'attach_document':
      return `Attached to ${entry}: ${documentText || 'the document'}.${createdText}`;
    case 'dismiss_duplicate':
      return result.document_id != null
        ? `Document ${result.document_id} dismissed as a duplicate.`
        : 'Document dismissed as a duplicate.';
    default:
      return `Done.${createdText}`;
  }
};

// ─── Entries list (the per-client entries surface) ─────────────────────────────

export interface StaffEntriesFilters {
  status?: string;
  unattributed?: boolean;
}

export const useStaffOrgEntries = (orgId: string, filters: StaffEntriesFilters) => {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.unattributed) params.unattributed = 'true';
  return usePaginatedList<StaffLedgerEntry>(`/api/accounting/staff/orgs/${orgId}/entries/`, params);
};

// ─── Card registry (s29 staff lane + s31 C2 resend) ───────────────────────────

// Mirrors accounting/card_serializers.py OrgCardSerializer (the staff shape —
// wider than the client's: last4 / network / source / is_active are writable
// here). v1 of this surface writes only classification, mapped_account, label,
// plus is_active for retirement.
export interface StaffCard {
  id: string;
  last4: string;
  network: 'visa' | 'mastercard' | 'amex' | 'other';
  label: string;
  classification: 'unidentified' | 'business' | 'personal';
  mapped_account: string | null;
  mapped_account_code: string | null;
  mapped_account_name: string | null;
  source: 'plaid' | 'detected' | 'manual';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useStaffOrgCards = (orgId: string) =>
  usePaginatedList<StaffCard>(`/api/accounting/staff/orgs/${orgId}/cards/`);

export const createStaffCard = async (
  orgId: string,
  payload: {
    last4: string;
    network: string;
    classification?: string;
    mapped_account?: string | null;
    label?: string;
  },
): Promise<WriteResult<StaffCard>> => {
  try {
    const res = await api.post(`/api/accounting/staff/orgs/${orgId}/cards/`, payload);
    if (res && res.status === 201) return { ok: true, status: 201, data: res.data as StaffCard };
    return { ok: false, status: res?.status, errorDetail: extractDetail(res, 'Failed to add card.') };
  } catch {
    return { ok: false, errorDetail: 'Failed to add card.' };
  }
};

export const patchStaffCard = async (
  cardId: string,
  payload: Partial<Pick<StaffCard, 'classification' | 'mapped_account' | 'label' | 'is_active'>>,
): Promise<WriteResult<StaffCard>> => {
  try {
    const res = await api.patch(`/api/accounting/staff/cards/${cardId}/`, payload);
    if (res && res.status === 200) return { ok: true, status: 200, data: res.data as StaffCard };
    // The model invariant (OrgCard.clean) surfaces as a 400 whose message is
    // user-actionable — extractDetail keeps the server's own wording.
    return { ok: false, status: res?.status, errorDetail: extractDetail(res, 'Failed to save card.') };
  } catch {
    return { ok: false, errorDetail: 'Failed to save card.' };
  }
};

// C2 resend. The three outcomes are distinct and the caller renders each
// differently, so the backend `code` is returned alongside the status rather
// than being flattened into one error string:
//   200 -> {sent_to_count}
//   429 -> code 'notification_rate_limited'  (calm inline, not an error toast)
//   502 -> code 'notification_send_failed'   (retryable error)
//   400 -> code 'card_not_notifiable'        (unreachable from this UI; surfaced anyway)
export interface ResendResult {
  ok: boolean;
  status?: number;
  code?: string;
  sentToCount?: number;
  errorDetail?: string;
}

export const resendCardNotification = async (cardId: string): Promise<ResendResult> => {
  try {
    const res = await api.post(`/api/accounting/staff/cards/${cardId}/resend-notification/`);
    if (res && res.status === 200) {
      const count = (res.data as { sent_to_count?: number } | null)?.sent_to_count;
      return { ok: true, status: 200, sentToCount: typeof count === 'number' ? count : 0 };
    }
    const code = (res?.data as { code?: string } | null | undefined)?.code;
    return {
      ok: false,
      status: res?.status,
      code,
      errorDetail: extractDetail(res, 'Could not re-send the notification.'),
    };
  } catch {
    return { ok: false, errorDetail: 'Could not re-send the notification.' };
  }
};
