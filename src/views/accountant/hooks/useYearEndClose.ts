// useYearEndClose (Session-25 Phase E, U3) — the accountant Period-close data
// layer. GET renders the close status (closable / fiscal_year / blockers); it
// never 4xxs on a blocked state — "blocked" is a normal, renderable answer. POST
// executes the close. Standalone — no owner-hook import. Renders ONLY the shapes
// the backend returns (no draft-entry panel, no invented figures — Phase E owner
// ruling).
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

// Machine-readable precondition blocker ({code, count, detail}) — the page shows
// each `detail` as a checklist row; the raw code/count are not rendered.
export interface Blocker {
  code: string;
  count: number;
  detail: string;
}

export interface CloseStatus {
  closable: boolean;
  fiscal_year: { start: string; end: string } | null;
  blockers: Blocker[];
}

export const useYearEndClose = () => {
  const [status, setStatus] = useState<CloseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get('/api/accounting/year-end-close/')
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) setStatus(res.data as CloseStatus);
        else { setStatus(null); setError(res.data?.detail ?? 'Failed to load close status.'); }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load close status.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  return { status, isLoading, error, refetch };
};

// POST the close. Returns the resolved axios response so the caller status-checks
// (201 posted; 422 close_blocked{blockers}; 409 already_closed/stale_close_request;
// 400 posting_failed/close_failed/invalid_request).
export const postYearEndClose = (fiscalYearEnd: string) =>
  api.post('/api/accounting/year-end-close/', { fiscal_year_end: fiscalYearEnd });
