// Page-local counts reader for the Tier 2 Documents surface (§14 14-C-4 U2,
// C2 contract). The shared usePaginatedList intentionally reads only the
// {count,next,previous,results} envelope and DROPS the response's top-level
// `counts`; it must not be edited (it is consumed by other callers). So the
// filter-independent per-status counts are read here via a light page-local
// fetch — page_size=1 because the server computes `counts` over ALL of the org's
// rows regardless of pagination or the active ?status filter. Refetched on the
// SAME 30s freshness + onUploaded triggers as the list, via the page's lifted
// refresh, so the tiles stay live but never change when a filter chip toggles.
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

export interface DocumentStatusCounts {
  pending: number;
  processing: number;
  posted: number;
  needs_review: number;
  failed: number;
  rejected: number;
  // O-S30-1: the backend status-counts endpoint returns this key (Status enum
  // grew post-migration 0037); previously dropped here, which is why Total read
  // one higher than the six visible tiles summed. Consumed by the banner trigger
  // (F-S30-7) and surfaced as its own tile (O-S30-2).
  not_source_document: number;
  total: number;
}

export const useDocumentStatusCounts = () => {
  const [counts, setCounts] = useState<DocumentStatusCounts | null>(null);
  const [revision, setRevision] = useState(0);
  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Same interceptor contract as usePaginatedList: null = cancelled;
    // status 200 = trust; else a resolved error → leave tiles zero-filled.
    api.get('/api/accounting/documents/status/', { params: { page_size: 1 } })
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) {
          setCounts((res.data?.counts as DocumentStatusCounts | undefined) ?? null);
        } else {
          setCounts(null);
        }
      })
      .catch(() => { if (!cancelled) setCounts(null); });
    return () => { cancelled = true; };
  }, [revision]);

  return { counts, refetch };
};
