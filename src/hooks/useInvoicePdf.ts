// §INV PDF open (S41 UI). NET-NEW pattern (Step-1B-h): the backend pdf/ endpoint
// returns application/pdf BYTES directly (auth via the Bearer header the api
// wrapper injects), so window.open on the URL can't carry auth. Fetch as a blob
// through the wrapped client, wrap in an object URL, open a new tab. Draft →
// DRAFT-watermark preview; issued/sent/paid → snapshot render; voided → VOID.
//
// Distinct from Pattern A (signed-URL JSON → window.open) and Pattern B
// (xlsx blob download) — do NOT touch those sites or react-to-pdf.
import { useCallback, useState } from 'react';
import api from '@/utils/api';

const BASE = '/api/accounting/sales-invoices/';

export const useInvoicePdf = () => {
  const [isOpening, setIsOpening] = useState(false);

  const openPdf = useCallback(async (id: string): Promise<{ ok: boolean; detail?: string }> => {
    setIsOpening(true);
    try {
      const res = await api.get(`${BASE}${id}/pdf/`, { responseType: 'blob' } as any);
      if (res == null) return { ok: false };
      if (res.status !== 200) {
        // The interceptor resolves error responses; with responseType 'blob' the
        // error body is a Blob — read it best-effort for the {detail} message.
        let detail = 'Could not generate the PDF.';
        try {
          const text = await (res.data as Blob).text();
          detail = JSON.parse(text)?.detail ?? detail;
        } catch { /* keep default */ }
        return { ok: false, detail };
      }
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      window.open(href, '_blank', 'noopener');
      // Revoke after the new tab has had time to load the resource.
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
      return { ok: true };
    } finally {
      setIsOpening(false);
    }
  }, []);

  return { openPdf, isOpening };
};
