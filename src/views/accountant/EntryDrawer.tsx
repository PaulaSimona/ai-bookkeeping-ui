// EntryDrawer (Session-25 Phase F, O-S25-5) — the accountant JE drill-down.
// Expands inline under a ledger row: the entry's lines (read-only), a "View
// document" action for document-derived entries, and an in-context "Adjust this
// entry" that expands the SHARED AdjustmentForm seeded from this entry's accounts
// (original lines stay visible above the form). Posting is immutable-safe — an
// adjustment is a new balanced entry, never an edit. Tokens only, no hex.
import { type FC, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { StatusBadge } from '@/components/t2/StatusBadge';
import api from '@/utils/api';
import { AdjustmentForm, today } from './AdjustmentForm';
import { type AccountantLedgerRow } from './hooks/useAccountantLedger';

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const fmtMoney = (v: string | null): string => (v == null || v === '' ? '' : CAD.format(Number(v)));
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

const MONO = 'font-[var(--font-family-mono)] tabular-nums';

const humanizeSource = (s: string): string => {
  const t = s.replace(/_/g, ' ').trim();
  return t.length === 0 ? '—' : t.charAt(0).toUpperCase() + t.slice(1);
};

const statusVariant = (status: string): 'neutral' | 'info' | 'success' => {
  if (status === 'posted') return 'success';
  if (status === 'reversed') return 'info';
  return 'neutral';
};

interface EntryDrawerProps {
  row: AccountantLedgerRow;
  adjustOpen: boolean;
  onToggleAdjust: () => void;
  onPosted: () => void; // refresh the list + collapse the drawer
}

export const EntryDrawer: FC<EntryDrawerProps> = ({ row, adjustOpen, onToggleAdjust, onPosted }) => {
  const { showToast } = useToast();
  const orderedLines = [...row.lines].sort((a, b) => a.line_order - b.line_order);

  // View document (O-S25-5): fetch the short-lived signed URL ON CLICK — never
  // prefetched — then open it in a detached new tab. Mirrors the owner
  // DocumentStatusList action.
  const viewDocument = async () => {
    if (row.source_document_id == null) return;
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const res = await api.get(`/api/accounting/documents/${row.source_document_id}/file-url/`);
      const url = res?.status === 200 ? res.data?.url : null;
      if (url) {
        if (tab) tab.location.href = url;
        else window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        if (tab) tab.close();
        showToast({
          title: 'Could not open document',
          message: res?.data?.detail ?? 'Please try again in a moment.',
          variant: 'danger',
        });
      }
    } catch (e: any) {
      if (tab) tab.close();
      showToast({
        title: 'Could not open document',
        message: e?.response?.data?.detail ?? 'Please try again in a moment.',
        variant: 'danger',
      });
    }
  };

  const seedAccountIds = orderedLines.map((l) => l.account_id);
  const seedMemo = `Adjustment re ${row.entry_number_display ?? 'entry'}`;

  return (
    <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`text-[13px] font-semibold text-gray-900 ${MONO}`}>
          {row.entry_number_display ?? '—'}
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-[13px] text-gray-600">{fmtDate(row.entry_date)}</span>
        <span className="text-gray-300">·</span>
        <StatusBadge variant="neutral">{humanizeSource(row.source)}</StatusBadge>
        <StatusBadge variant={statusVariant(row.status)}>
          {humanizeSource(row.status)}
        </StatusBadge>
      </div>

      {/* Lines table (read-only) */}
      <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="grid grid-cols-[1fr_140px_140px] gap-3 border-b border-gray-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span>Account</span>
          <span className="justify-self-end">Debit</span>
          <span className="justify-self-end">Credit</span>
        </div>
        <div className="divide-y divide-gray-50">
          {orderedLines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_140px_140px] items-start gap-3 px-4 py-2.5">
              <span className="text-[13px] text-gray-800">
                <span className={`text-gray-500 ${MONO}`}>{l.account_code ?? ''}</span>
                {l.account_code ? ' · ' : ''}
                {l.account_name ?? ''}
                {l.description ? (
                  <span className="mt-0.5 block text-[11.5px] text-gray-400">{l.description}</span>
                ) : null}
              </span>
              <span className={`justify-self-end text-[13px] text-gray-800 ${MONO}`}>{fmtMoney(l.debit)}</span>
              <span className={`justify-self-end text-[13px] text-gray-800 ${MONO}`}>{fmtMoney(l.credit)}</span>
            </div>
          ))}
        </div>
        {/* Totals row — is_balanced is a backend invariant; not recomputed here. */}
        <div className="grid grid-cols-[1fr_140px_140px] gap-3 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-[12px] font-semibold text-gray-600">
          <span className="justify-self-start">Total</span>
          <span className={`justify-self-end text-gray-900 ${MONO}`}>{fmtMoney(row.total_debits)}</span>
          <span className={`justify-self-end text-gray-900 ${MONO}`}>{fmtMoney(row.total_credits)}</span>
        </div>
      </div>

      {/* Entry description */}
      {row.description ? (
        <p className="mt-2 text-[13px] text-gray-600">{row.description}</p>
      ) : null}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.source_document_id != null && (
          <button
            type="button"
            onClick={viewDocument}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View document
          </button>
        )}
        <button
          type="button"
          onClick={onToggleAdjust}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-navy)] px-3 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {adjustOpen ? 'Hide adjustment' : 'Adjust this entry'}
        </button>
      </div>

      {/* In-context adjust — the shared form, seeded from this entry's accounts
          (amounts blank). The original lines remain visible above. */}
      {adjustOpen && (
        <div className="mt-4">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
            New adjusting entry
          </div>
          <AdjustmentForm
            key={row.id}
            seedAccountIds={seedAccountIds}
            initialMemo={seedMemo}
            initialDate={today()}
            onPosted={onPosted}
            onCancel={onToggleAdjust}
          />
        </div>
      )}
    </div>
  );
};
