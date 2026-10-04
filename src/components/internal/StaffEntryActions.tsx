// StaffEntryActions (S69 E8, O-S69-1 / O-S69-10a / D-S69-17; S70 3c, O-S70-8;
// S84/S85, D-S84-5 / D-S85-12 / D-S85-13) — the staff writes reachable from the
// client view. Mounted on BOTH staff pages: the expanded row on
// InternalClientEntries (F-S69-9) and the LedgerTable drawerActions slot on
// InternalClientAccountLedger.
//
// The panel shows the entry and one button per write the rule module allows
// (entryStatus allowedActions — the chain's LIVE entry only). Each button
// opens its own editor; each editor has ONE save, followed by a confirm pop-up
// that says what it does:
//   Correct              PostedCorrectionEditor → POST staff/entries/<id>/correct/
//   Change counterparty  set, replace or clear   → POST staff/entries/<id>/attribute/
//
// `entry` is the entry the page's panel shows (id, number, current
// counterparty, registry fields) — the page owns it and refetches it after a
// save, so what this panel shows as "current" is always the server's value,
// never a local guess. The reused CounterpartyPicker runs with
// allowCreate={false}: no "+ New", so no second write.
import { type FC, useEffect, useState } from 'react';

import { CounterpartyPicker } from '@/components/internal/CounterpartyPicker';
import { PostedCorrectionEditor } from '@/components/internal/PostedCorrectionEditor';
import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  Toast,
  useToast,
} from '@/components/internal/ui';
import { attributeStaffEntry, useStaffOrgCounterparties } from '@/hooks/useStaffResolution';
import {
  allowedActions,
  formatEntryNumber,
  nonLiveNote,
  type EntryLinkSource,
  type EntryRef,
} from '@/utils/entryStatus';

// The registry fields (EntryLinkSource: display_status, live_entry, …) decide
// which writes are offered. The entries page passes its row; the account-ledger
// page passes the entry DETAIL (useStaffEntryDetail), never the LedgerLine.
export interface StaffEntryActionsEntry extends EntryLinkSource {
  entry_number: number | null;
  entry_number_display?: string | null;
  counterparty: { id: string; name: string } | null;
}

export const REASON_MAX = 500;

const fieldCls =
  'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

const actionBtnCls =
  'rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 ' +
  'hover:text-white disabled:opacity-50';

type Notify = (message: string, type: 'success' | 'error') => void;

// ─── Change counterparty ───────────────────────────────────────────────────────
// One Save, then a confirm that names the change — on set, replace AND clear
// (D-S85-12). Nothing is written until the confirm.

const CounterpartyEditor: FC<{
  orgId: string;
  entry: StaffEntryActionsEntry;
  entryNo: string;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
}> = ({ orgId, entry, entryNo, onClose, onChanged, notify }) => {
  const current = entry.counterparty?.id ?? '';
  const currentName = entry.counterparty?.name ?? '';
  const [selected, setSelected] = useState(current);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ status?: number; code?: string; detail: string } | null>(null);
  // The picker hands back an id; the confirm names the counterparty.
  const { counterparties } = useStaffOrgCounterparties(orgId, { archived: false });
  const selectedName =
    counterparties.find((c) => c.id === selected)?.name ?? 'the selected counterparty';

  const dirty = selected !== current;
  const change: 'set' | 'replace' | 'clear' =
    selected === '' ? 'clear' : current === '' ? 'set' : 'replace';

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res = await attributeStaffEntry(
      entry.id, selected === '' ? null : selected, reason.trim() || undefined,
    );
    setSaving(false);
    setConfirming(false);
    if (res.ok) {
      notify(res.data?.changed === false ? 'No change' : 'Counterparty updated', 'success');
      onChanged();                       // refetch ledger + entry — no local mutation
      onClose();
    } else {
      setError({ status: res.status, code: res.code, detail: res.errorDetail ?? 'Attribution failed.' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Change counterparty · {entryNo}
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

      {/* A server refusal, by code, with the server's own words (409
          not_editable, a counterparty the org does not have, …). */}
      {error && (error.status === 404 ? (
        <EmptyState
          title="Not found"
          description="This entry is not on a client assigned to you, or it no longer exists."
        />
      ) : (
        <ErrorBanner message={error.detail} />
      ))}

      <div className="flex items-center gap-3">
        <PrimaryButton onClick={() => setConfirming(true)} disabled={!dirty || saving} busy={saving}>
          Save
        </PrimaryButton>
        <SecondaryButton onClick={onClose} disabled={saving}>
          Cancel
        </SecondaryButton>
      </div>

      {confirming && (
        <ConfirmModal
          title={
            change === 'clear'
              ? 'Remove counterparty?'
              : change === 'set'
                ? 'Set counterparty?'
                : 'Replace counterparty?'
          }
          onClose={() => !saving && setConfirming(false)}
        >
          <p className="text-sm text-white/70">
            {change === 'clear' && (
              <>Removes {currentName} from {entryNo}. </>
            )}
            {change === 'set' && (
              <>Sets the counterparty of {entryNo} to {selectedName}. </>
            )}
            {change === 'replace' && (
              <>Replaces the counterparty of {entryNo}: {currentName} → {selectedName}. </>
            )}
            The entry keeps its lines and amounts; only the attribution changes, and the change
            is audited.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void submit()} disabled={saving} busy={saving}>
              Confirm
            </PrimaryButton>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};

// ─── Panel ─────────────────────────────────────────────────────────────────────

type Mode = 'correct' | 'counterparty' | null;

export const StaffEntryActions: FC<{
  orgId: string;
  entry: StaffEntryActionsEntry;
  onChanged: () => void;
  // Opens another entry of the chain in the page's panel — the correction
  // editor offers it when the entry turns out not to be the live one.
  onOpenEntry?: (entry: EntryRef) => void;
}> = ({ orgId, entry, onChanged, onOpenEntry }) => {
  const [mode, setMode] = useState<Mode>(null);
  const { toast, showToast } = useToast();

  // An editor belongs to the entry it was opened on.
  useEffect(() => { setMode(null); }, [entry.id]);

  // A5: the display form ("JE-0071"), never the bare "#<n>" — prefer the API's
  // entry_number_display, else format the integer the same way the backend does.
  const entryNo =
    entry.entry_number_display ?? formatEntryNumber(entry.entry_number) ?? 'this entry';

  // D-S85-13: what the staff lane may do with this entry — nothing unless it
  // is the chain's live entry.
  const actions = allowedActions('staff', entry);
  const note = nonLiveNote(entry);

  return (
    <div className="border-t border-white/10 bg-[#0f172a] px-5 py-4">
      <div
        className={`${mode === 'correct' ? 'max-w-4xl' : 'max-w-xl'} space-y-3 rounded-md border border-white/10 bg-white/5 p-3`}
      >
        {mode === 'correct' ? (
          // S70 3c (O-S70-8): the editor re-reads the entry and gates on ITS
          // standing (O-S70-2) — the button only opens it.
          <PostedCorrectionEditor
            orgId={orgId}
            entry={{ id: entry.id, entry_number: entry.entry_number }}
            onClose={() => setMode(null)}
            onChanged={onChanged}
            notify={showToast}
            onOpenEntry={onOpenEntry}
          />
        ) : mode === 'counterparty' ? (
          <CounterpartyEditor
            orgId={orgId}
            entry={entry}
            entryNo={entryNo}
            onClose={() => setMode(null)}
            onChanged={onChanged}
            notify={showToast}
          />
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
              Posted entry · {entryNo}
            </div>
            <div className="text-sm text-white/80">
              Counterparty: <span className="text-white">{entry.counterparty?.name ?? '—'}</span>
            </div>
            {actions.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {actions.includes('correct') && (
                    <button type="button" onClick={() => setMode('correct')} className={actionBtnCls}>
                      Correct
                    </button>
                  )}
                  {actions.includes('change_counterparty') && (
                    <button type="button" onClick={() => setMode('counterparty')} className={actionBtnCls}>
                      Change counterparty
                    </button>
                  )}
                </div>
                {actions.includes('correct') && (
                  <p className="text-[11px] text-white/40">
                    Posts one new entry that corrects {entryNo}. Audited; cannot be undone.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-amber-200/80">
                {note ?? 'Changes are made on the live entry of this chain.'}
              </p>
            )}
          </>
        )}
      </div>

      <Toast toast={toast} />
    </div>
  );
};
