// StaffEntryActions (S69 E8, O-S69-1 / O-S69-10a / D-S69-17; S70 3c, O-S70-8)
// — the staff writes reachable from the client view: replace or clear an
// entry's counterparty (POST staff/entries/<id>/attribute/) and, since S70 3c,
// correct a POSTED entry (PostedCorrectionEditor → POST
// staff/entries/<id>/correct/). Mounted on BOTH staff pages: the expanded row
// on InternalClientEntries (F-S69-9) and the LedgerTable drawerActions slot on
// InternalClientAccountLedger.
//
// `entry` is the ledger LINE the drawer is open on (id, number, current
// counterparty) — the page owns it and refetches it after a save, so what this
// panel shows as "current" is always the server's value, never a local guess.
// The reused CounterpartyPicker runs with allowCreate={false}: no "+ New", so
// no second write. Clearing asks first (internal ConfirmModal).
import { type FC, useEffect, useState } from 'react';

import { CounterpartyPicker } from '@/components/internal/CounterpartyPicker';
import { PostedCorrectionEditor } from '@/components/internal/PostedCorrectionEditor';
import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  Toast,
  useToast,
} from '@/components/internal/ui';
import { attributeStaffEntry } from '@/hooks/useStaffResolution';

export interface StaffEntryActionsEntry {
  id: string;
  entry_number: number | null;
  counterparty: { id: string; name: string } | null;
}

export const REASON_MAX = 500;

const fieldCls =
  'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

export const StaffEntryActions: FC<{
  orgId: string;
  entry: StaffEntryActionsEntry;
  onChanged: () => void;
}> = ({ orgId, entry, onChanged }) => {
  const current = entry.counterparty?.id ?? '';
  const [selected, setSelected] = useState(current);
  const [reason, setReason] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ status?: number; detail: string } | null>(null);
  const { toast, showToast } = useToast();

  // The row's current value moves only when the page refetches after a save;
  // follow it so "Save" is disabled again once the server agrees.
  useEffect(() => { setSelected(current); }, [current, entry.id]);

  const dirty = selected !== current;
  const entryNo = entry.entry_number != null ? `#${entry.entry_number}` : 'this entry';

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res = await attributeStaffEntry(
      entry.id, selected === '' ? null : selected, reason.trim() || undefined,
    );
    setSaving(false);
    if (res.ok) {
      showToast(res.data?.changed === false ? 'No change' : 'Counterparty updated', 'success');
      setReason('');
      onChanged();                       // refetch ledger + entry — no local mutation
    } else {
      setError({ status: res.status, detail: res.errorDetail ?? 'Attribution failed.' });
    }
  };

  const onSave = () => {
    if (!dirty || saving) return;
    if (selected === '') setConfirmClear(true);   // clearing asks first
    else void submit();
  };

  return (
    <div className="border-t border-white/10 bg-[#0f172a] px-5 py-4">
      <div className="max-w-xl space-y-3 rounded-md border border-white/10 bg-white/5 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
          Counterparty
        </div>
        <div className="text-sm text-white/80">
          Current: <span className="text-white">{entry.counterparty?.name ?? '—'}</span>
        </div>

        <CounterpartyPicker
          orgId={orgId}
          value={selected}
          onChange={setSelected}
          disabled={saving}
          allowCreate={false}
        />
        <p className="text-[11px] text-white/40">
          Leave the picker on “Select a counterparty…” to remove the current one.
        </p>

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX}
          placeholder="Reason (optional)"
          disabled={saving}
          className={fieldCls}
        />

        {error && (error.status === 404 ? (
          <EmptyState
            title="Not found"
            description="This entry is not on a client assigned to you, or it no longer exists."
          />
        ) : (
          <ErrorBanner message={error.detail} />
        ))}

        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="rounded-md bg-[#0066FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0052cc] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* S70 3c (O-S70-8): correct a POSTED entry — reverse + repost through
          the staff correction endpoint. The editor re-reads the entry and
          gates on ITS status (O-S70-2); this button only opens it. */}
      <div className="mt-3 max-w-xl space-y-3 rounded-md border border-white/10 bg-white/5 p-3">
        {correcting ? (
          <PostedCorrectionEditor
            orgId={orgId}
            entry={{ id: entry.id, entry_number: entry.entry_number }}
            onClose={() => setCorrecting(false)}
            onChanged={onChanged}
            notify={showToast}
          />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Posted entry
              </div>
              <p className="text-[11px] text-white/40">
                Reverses {entryNo} and posts a corrected replacement. Audited; cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCorrecting(true)}
              disabled={saving}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white disabled:opacity-50"
            >
              Correct
            </button>
          </div>
        )}
      </div>

      {confirmClear && (
        <ConfirmModal title="Remove counterparty" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-white/70">
            Remove the counterparty from entry {entryNo}? The entry keeps its lines and
            amounts; only the attribution is cleared, and the change is audited.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { setConfirmClear(false); void submit(); }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
            >
              Remove
            </button>
          </div>
        </ConfirmModal>
      )}

      <Toast toast={toast} />
    </div>
  );
};
