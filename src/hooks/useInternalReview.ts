import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';

/**
 * Data + actions for the internal review queue (MASTER_T2 §15 / §4.2).
 * All calls go through the standard authed client. Endpoints:
 *   GET  /api/accounting/review/                       (paginated envelope)
 *   POST /api/accounting/review/<uuid>/approve/        (empty body)
 *   POST /api/accounting/review/<uuid>/reject-correct/ (RejectCorrectSerializer)
 * The api interceptor RESOLVES non-401 errors, so every call status-checks the
 * resolved response. Backend error `detail` is surfaced verbatim.
 */

// Mirrors accounting/review_serializers.py ReviewJournalLineSerializer.
export interface ReviewLine {
  id: string;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  debit: string | null;
  credit: string | null;
  description: string | null;
  tax_code: string | null;
  line_order: number | null;
}

// Mirrors accounting/review_serializers.py ReviewEntrySerializer.
export interface ReviewEntry {
  id: string;
  entry_number: string | null;
  entry_date: string | null;
  description: string | null;
  status: string;
  source: string | null;
  // R-S27-B: additive org attribution — which client this queued draft belongs to.
  org_id: string | null;
  org_name: string | null;
  confidence: string | number | null;
  agent_rationale: string | null;
  needs_review: boolean;
  routing_reason: string | null;
  source_document_id: number | null;
  source_document_name: string | null;
  source_document_url: string | null;
  total_debits: string | number | null;
  total_credits: string | number | null;
  lines: ReviewLine[];
  created_at: string | null;
  updated_at: string | null;
}

// Payload line for reject-correct — matches ReviewLineInputSerializer.
export interface CorrectedLineInput {
  account_id: string;
  debit: string | null;
  credit: string | null;
  description: string;
  tax_code: string;
  line_order: number;
}

export interface RejectCorrectPayload {
  reason_code: string;
  note: string;
  lines: CorrectedLineInput[];
  // Tri-state counterparty (§14 14-C-2b). OMIT the key → replacement inherits the
  // original's counterparty; null → clear it; a UUID → set it. The editor only
  // includes this key when the reviewer chooses clear/pick, so `keep` inherits.
  counterparty_id?: string | null;
}

export interface ActionResult {
  ok: boolean;
  errorDetail?: string;
}

/** Pull a human message out of a resolved error response, detail verbatim. */
const extractDetail = (res: unknown, fallback: string): string => {
  const data = (res as { data?: unknown } | null | undefined)?.data;
  if (data == null || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === 'string' && obj.detail) return obj.detail; // PostingError / 404 / 409
  // DRF serializer field errors, e.g. {reason_code: [...], lines: [...]}.
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'code') continue;
    if (Array.isArray(val)) parts.push(val.map((v) => String(v)).join(' '));
    else if (typeof val === 'string') parts.push(val);
  }
  return parts.length ? parts.join(' ') : fallback;
};

export const useReviewQueue = () => {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api
      .get('/api/accounting/review/', { params: { page_size: 200 } })
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) {
          const data = res.data;
          // Paginated envelope {count, next, previous, results}; coerce defensively.
          const rows = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
          setEntries(rows as ReviewEntry[]);
          setCount(typeof data?.count === 'number' ? data.count : rows.length);
        } else {
          setEntries([]);
          setError(extractDetail(res, 'Failed to load the review queue.'));
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load the review queue.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  return { entries, count, isLoading, error, refetch };
};

export const approveEntry = async (id: string): Promise<ActionResult> => {
  try {
    const res = await api.post(`/api/accounting/review/${id}/approve/`, {});
    if (res && (res.status === 200 || res.status === 201)) return { ok: true };
    return { ok: false, errorDetail: extractDetail(res, 'Approval failed.') };
  } catch {
    return { ok: false, errorDetail: 'Approval failed.' };
  }
};

export const rejectCorrect = async (
  id: string,
  payload: RejectCorrectPayload,
): Promise<ActionResult> => {
  try {
    const res = await api.post(`/api/accounting/review/${id}/reject-correct/`, payload);
    if (res && (res.status === 200 || res.status === 201)) return { ok: true };
    return { ok: false, errorDetail: extractDetail(res, 'Reject & correct failed.') };
  } catch {
    return { ok: false, errorDetail: 'Reject & correct failed.' };
  }
};
