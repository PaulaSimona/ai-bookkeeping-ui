// §INV data layer (S41 UI). Mirrors the useAccounts / useCounterparties house
// pattern: the list rides usePaginatedList; the detail hook and the mutation
// functions use the wrapped api client (auto JWT + X-Org-Id). The interceptor
// RESOLVES non-401 errors, so callers status-check the resolved response — never
// rely on catch. No money math anywhere here (display strings only).
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import type {
  InvoiceCreatePayload,
  InvoiceLineInput,
  InvoiceStatus,
  PaymentPayload,
  SalesInvoice,
} from '@/types/salesInvoice';

const BASE = '/api/accounting/sales-invoices/';

// ── Detail ────────────────────────────────────────────────────────────────────

export const useSalesInvoice = (id: string | undefined) => {
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get(`${BASE}${id}/`)
      .then((res) => {
        if (cancelled || res == null) return;
        if (res.status === 200) setInvoice(res.data as SalesInvoice);
        else { setInvoice(null); setError(res.data?.detail ?? 'Failed to load invoice'); }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? 'Failed to load invoice');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [id, revision]);

  return { invoice, isLoading, error, refetch };
};

// ── Counterparty options (name lookup + create-form picker) ────────────────────

export interface CounterpartyOption {
  id: string;
  name: string;
  email: string;
  payment_terms: string;
}

export const useCounterpartyOptions = () => {
  const [options, setOptions] = useState<CounterpartyOption[]>([]);
  const [byId, setById] = useState<Record<string, CounterpartyOption>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    api.get('/api/accounting/counterparties/', { params: { page_size: 200 } })
      .then((res) => {
        if (cancelled || res == null || res.status !== 200) return;
        const rows = (Array.isArray(res.data?.results) ? res.data.results : []) as CounterpartyOption[];
        setOptions(rows);
        setById(Object.fromEntries(rows.map((r) => [r.id, r])));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  return { options, byId, isLoading, refetch };
};

// ── Mutations (resolved axios responses — status-check at the call site) ───────

export const createInvoice = (payload: InvoiceCreatePayload) => api.post(BASE, payload);
export const patchInvoice = (id: string, payload: Partial<InvoiceCreatePayload>) =>
  api.patch(`${BASE}${id}/`, payload);
export const issueInvoice = (id: string) => api.post(`${BASE}${id}/issue/`, {});
export const voidInvoice = (id: string, reason: string) =>
  api.post(`${BASE}${id}/void/`, { reason });
export const recordInvoicePayment = (id: string, payload: PaymentPayload) =>
  api.post(`${BASE}${id}/payments/`, payload);
export const createCreditNote = (id: string, lines: InvoiceLineInput[]) =>
  api.post(`${BASE}${id}/credit-notes/`, { lines });
export const sendInvoice = (id: string, recipient?: string) =>
  api.post(`${BASE}${id}/send/`, recipient ? { recipient } : {});

// ── Display helpers (display-only; ZERO money arithmetic in JS) ────────────────

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export const fmtMoney = (v: string | null | undefined, currency?: string): string => {
  if (v == null || v === '') return '—';
  const n = Number(v); // coerce only — hand a numeric to Intl; never arithmetic
  if (Number.isNaN(n)) return `$${v}`;
  if (currency && currency !== 'CAD') {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(n);
  }
  return CAD.format(n);
};

export const invoiceNumberLabel = (inv: Pick<SalesInvoice, 'invoice_number' | 'kind'>): string => {
  if (inv.invoice_number != null) return `INV-${String(inv.invoice_number).padStart(5, '0')}`;
  return inv.kind === 'credit_note' ? 'Credit note (draft)' : 'Draft';
};

type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'voided';

export const statusMeta = (
  status: InvoiceStatus,
  isOverdue = false,
): { variant: BadgeVariant; label: string } => {
  if (isOverdue && (status === 'issued' || status === 'sent' || status === 'partial')) {
    return { variant: 'danger', label: 'Overdue' };
  }
  switch (status) {
    case 'draft': return { variant: 'neutral', label: 'Draft' };
    case 'issued': return { variant: 'info', label: 'Issued' };
    case 'sent': return { variant: 'info', label: 'Sent' };
    case 'partial': return { variant: 'warning', label: 'Partial' };
    case 'paid': return { variant: 'success', label: 'Paid' };
    case 'voided': return { variant: 'voided', label: 'Voided' };
    default: return { variant: 'neutral', label: status };
  }
};

// Shared control class (matches ledger/CounterpartyManager inputCls).
export const inputCls =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition';

export const primaryBtn =
  'inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 ' +
  'text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export const secondaryBtn =
  'inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 ' +
  'text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';
