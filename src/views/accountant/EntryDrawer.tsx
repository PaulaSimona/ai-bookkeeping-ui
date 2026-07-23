// EntryDrawer (Session-25 Phase F, O-S25-5) — the accountant JE drill-down.
// Expands inline under a ledger row: the entry's lines (read-only), a "View
// document" action for document-derived entries, and an in-context "Adjust this
// entry" that expands the SHARED AdjustmentForm seeded from this entry's accounts
// (original lines stay visible above the form). Posting is immutable-safe — an
// adjustment is a new balanced entry, never an edit. Tokens only, no hex.
import { type FC, useState } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { useToast } from '@/hooks/useToast';
import { StatusBadge } from '@/components/t2/StatusBadge';
import api from '@/utils/api';
import { AdjustmentForm, today } from './AdjustmentForm';
import { voidAdjustment } from './hooks/adjustmentApi';
import { type AccountantLedgerRow } from './hooks/useAccountantLedger';

const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const fmtMoney = (v: string | null): string => (v == null || v === '' ? '' : CAD.format(Number(v)));
const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const MONO = 'font-[var(--font-family-mono)] tabular-nums';

const humanizeSource = (s: string): string => {
  const t = s.replace(/_/g, ' ').trim();
  return t.length === 0 ? '—' : t.charAt(0).toUpperCase() + t.slice(1);
};

const statusVariant = (status: string): 'neutral' | 'info' | 'success' | 'voided' => {
  if (status === 'posted') return 'success';
  if (status === 'reversed') return 'info';
  if (status === 'voided') return 'voided';
  return 'neutral';
};

interface EntryDrawerProps {
  row: AccountantLedgerRow;
  adjustOpen: boolean;
  onToggleAdjust: () => void;
  onPosted: () => void; // adjust posted → refresh the list + collapse the drawer
  onVoided?: () => void; // void succeeded → refetch the list (drawer stays, shows voided)
}

export const EntryDrawer: FC<EntryDrawerProps> = ({ row, adjustOpen, onToggleAdjust, onPosted, onVoided }) => {
  const { showToast } = useToast();
  // Current user id from the /me-backed store (O-S26-2 exposes user.id). The store
  // already retains the whole /me payload, so no store change is needed.
  const currentUserId = useSelector(
    (s: RootState) => s.auth.user?.user?.id ?? s.auth.user?.id ?? null,
  );
  const orderedLines = [...row.lines].sort((a, b) => a.line_order - b.line_order);

  // Void state. voidedInfo is set locally on a successful void so the drawer shows
  // the voided state immediately (the list also refetches via onVoided). A row that
  // is ALREADY voided (viewed under Show voided) is voided from the start.
  const [voidedInfo, setVoidedInfo] = useState<{ voided_at: string | null; void_reason: string } | null>(null);
  const isVoided = row.status === 'voided' || voidedInfo !== null;
  const voidedAt = voidedInfo?.voided_at ?? row.voided_at ?? null;
  const voidReason = voidedInfo?.void_reason ?? row.void_reason ?? '';

  // Author-gated Void affordance (O-S26-2) — mirrors, never replaces, the backend
  // author-equality fence. Shown ONLY when the entry is a posted accountant
  // adjustment authored by the current user; absent otherwise (never disabled).
  const canVoid =
    !isVoided &&
    row.status === 'posted' &&
    row.source === 'accountant_adjustment' &&
    currentUserId != null &&
    row.created_by === currentUserId;

  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const submitVoid = async () => {
    if (!reason.trim() || voiding) return;
    setVoiding(true);
    setVoidError(null);
    try {
      const res = await voidAdjustment(row.id, reason.trim());
      if (res?.status === 200) {
        setVoidedInfo({
          voided_at: res.data?.voided_at ?? null,
          void_reason: res.data?.void_reason ?? reason.trim(),
        });
        setConfirmingVoid(false);
        showToast({
          title: 'Entry voided',
          message: 'It no longer affects balances or reports.',
          variant: 'success',
        });
        onVoided?.();
      } else {
        // Backend's stable message (incl. the 403 author-equality text) verbatim.
        setVoidError(res?.data?.detail ?? 'The entry could not be voided.');
      }
    } catch (e: any) {
      setVoidError(e?.response?.data?.detail ?? 'The entry could not be voided.');
    } finally {
      setVoiding(false);
    }
  };

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
      {/* Header — the entry number is struck through once voided. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`text-[13px] font-semibold text-gray-900 ${MONO} ${isVoided ? 'line-through text-gray-400' : ''}`}>
          {row.entry_number_display ?? '—'}
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-[13px] text-gray-600">{fmtDate(row.entry_date)}</span>
        <span className="text-gray-300">·</span>
        <StatusBadge variant="neutral">{humanizeSource(row.source)}</StatusBadge>
        <StatusBadge variant={statusVariant(isVoided ? 'voided' : row.status)}>
          {humanizeSource(isVoided ? 'voided' : row.status)}
        </StatusBadge>
      </div>

      {/* Voided metadata — shown for an already-voided row or right after voiding. */}
      {isVoided && (
        <div className="mt-3 rounded-xl bg-gray-100 px-4 py-3 text-[12.5px] text-gray-500">
          Voided{voidedAt ? ` on ${fmtDateTime(voidedAt)}` : ''}. Removed from balances
          and reports; retained in the audit trail and under Show voided.
          {voidReason ? (
            <span className="mt-1 block text-gray-600">Reason: {voidReason}</span>
          ) : null}
        </div>
      )}

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

      {/* Actions — View document is always available; Adjust/Void only on a
          non-voided entry (Void only for the author of a posted adjustment). */}
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
        {!isVoided && (
          <button
            type="button"
            onClick={onToggleAdjust}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-navy)] px-3 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {adjustOpen ? 'Hide adjustment' : 'Adjust this entry'}
          </button>
        )}
        {canVoid && !confirmingVoid && (
          <button
            type="button"
            onClick={() => { setConfirmingVoid(true); setVoidError(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            Void entry
          </button>
        )}
      </div>

      {/* Void confirm panel (house pattern — no browser confirm()). */}
      {confirmingVoid && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <div className="text-[13px] font-semibold text-gray-900">
            Void {row.entry_number_display ?? 'this entry'}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">
            Voiding removes this entry from balances and reports. It stays in the audit
            trail and under Show voided. This cannot be undone.
          </p>
          <label className="mt-3 block text-[12px] font-medium text-gray-700">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Why is this entry being voided?"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition"
          />
          <div className="mt-1 text-right text-[11px] text-gray-400">{reason.length}/500</div>

          {voidError && <p className="mt-1 text-sm text-red-600">{voidError}</p>}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setConfirmingVoid(false); setVoidError(null); }}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitVoid}
              disabled={!reason.trim() || voiding}
              className="rounded-lg bg-red-600 px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {voiding ? 'Voiding…' : 'Void entry'}
            </button>
          </div>
        </div>
      )}

      {/* In-context adjust — the shared form, seeded from this entry's accounts
          (amounts blank). Absent once the entry is voided. */}
      {adjustOpen && !isVoided && (
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
