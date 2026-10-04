// StaffEntryActions (S69 E8, O-S69-1 / O-S69-10a / D-S69-17; S70 3c, O-S70-8;
// S84/S85, D-S84-5 / D-S84-7 / D-S85-12..14) — the staff writes reachable from
// the client view. Mounted on BOTH staff pages: the expanded row on
// InternalClientEntries (F-S69-9) and the LedgerTable drawerActions slot on
// InternalClientAccountLedger.
//
// The panel shows the entry and one button per write the rule module allows
// (entryStatus allowedActions — the chain's LIVE entry only). Each button
// opens its own editor; each editor has ONE save, followed by a confirm pop-up
// that says what it does:
//   Correct              PostedCorrectionEditor → POST staff/entries/<id>/correct/
//   Change counterparty  set, replace or clear   → POST staff/entries/<id>/attribute/
//   Reverse              an entry nothing links to → POST staff/entries/<id>/reverse/
//   Merge into…          the page's pick mode     → POST staff/entries/<id>/merge-into/
//   Attach document      a typed document id      → POST staff/entries/<id>/attach-document/
//
// `entry` is the entry the page's panel shows (id, number, current
// counterparty, registry fields) — the page owns it and refetches it after a
// save, so what this panel shows as "current" is always the server's value,
// never a local guess. The reused CounterpartyPicker runs with
// allowCreate={false}: no "+ New", so no second write.
//
// Every server refusal is shown by its code with the server's own detail
// (RemediationRefusalView).
import { type FC, type ReactNode, useEffect, useState } from 'react';

import { CounterpartyPicker } from '@/components/internal/CounterpartyPicker';
import { PostedCorrectionEditor } from '@/components/internal/PostedCorrectionEditor';
import {
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  Toast,
  formatMoney,
  useToast,
} from '@/components/internal/ui';
import {
  REMEDIATION_REASON_MAX,
  attachStaffDocument,
  attributeStaffEntry,
  mergeStaffEntry,
  remediationSummary,
  reverseStaffEntry,
  useStaffOrgCounterparties,
  type RemediationRefusal,
} from '@/hooks/useStaffResolution';
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

const linkBtnCls = 'text-xs font-medium text-[#4DA6FF] underline underline-offset-2 hover:text-white';

type Notify = (message: string, type: 'success' | 'error') => void;

// ─── Refusals ──────────────────────────────────────────────────────────────────
// A refusal as the server sent it: its `detail` verbatim, and what its code
// carries — the refused entry (`field`), the links that block a reversal, the
// two totals of a mismatch, the entry a document is tied to, the adjustment
// entry that blocks a merge. 404 is the staff lane's "Not found" state.

const LINK_LABELS: Record<string, string> = {
  bank_state: 'a bank transaction is recorded against it',
  active_match: 'a bank match is active on one of its lines',
  document_state: 'a document is attached to it',
};

const DOCUMENT_ENTRY_CODES = new Set(['document_has_open_draft', 'document_attached_to_live_entry']);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

export const RemediationRefusalView: FC<{
  refusal: RemediationRefusal;
  // What the action called its entries, so `field` can name the refused one.
  entryLabel?: string;
  survivorLabel?: string;
  onOpenEntry?: (entry: EntryRef) => void;
  children?: ReactNode;
}> = ({ refusal, entryLabel, survivorLabel, onOpenEntry, children }) => {
  if (refusal.status === 404) {
    return (
      <EmptyState
        title="Not found"
        description="This is not on a client assigned to you, or it no longer exists."
      />
    );
  }
  const ctx = refusal.context;
  const field = text(ctx.field);
  const refused =
    field === 'entry' ? entryLabel : field === 'survivor_entry_id' ? survivorLabel : undefined;
  const links = Array.isArray(ctx.links) ? ctx.links.map((l) => String(l)) : [];
  const documentEntryId =
    refusal.code && DOCUMENT_ENTRY_CODES.has(refusal.code) ? text(ctx.entry_id) : null;
  const adjustmentEntryId = text(ctx.adjustment_entry_id);
  const duplicateTotal = text(ctx.duplicate_total);
  const survivorTotal = text(ctx.survivor_total);

  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
    >
      <p>{refusal.detail}</p>
      {refused && (
        <p className="text-xs">
          Refused entry: <span className="font-semibold text-white">{refused}</span>
        </p>
      )}
      {links.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          {links.map((link) => (
            <li key={link}>{LINK_LABELS[link] ?? link.replace(/_/g, ' ')}</li>
          ))}
        </ul>
      )}
      {refusal.code === 'amount_mismatch' && duplicateTotal && survivorTotal && (
        <p className="text-xs">
          Duplicate total {formatMoney(duplicateTotal)} · surviving entry total{' '}
          {formatMoney(survivorTotal)}
        </p>
      )}
      {documentEntryId && onOpenEntry && (
        <button
          type="button"
          onClick={() => onOpenEntry({ id: documentEntryId, number: null })}
          className={linkBtnCls}
        >
          Open that entry
        </button>
      )}
      {adjustmentEntryId && onOpenEntry && (
        <button
          type="button"
          onClick={() => onOpenEntry({ id: adjustmentEntryId, number: null })}
          className={linkBtnCls}
        >
          Open the adjustment entry
        </button>
      )}
      {children}
    </div>
  );
};

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

// ─── Reverse (D-S84-7) ─────────────────────────────────────────────────────────
// A live entry that NOTHING is linked to. A linked entry is refused (409
// entry_has_links): the panel lists the links and points to Merge or Correct.

const ReverseEditor: FC<{
  entry: StaffEntryActionsEntry;
  entryNo: string;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
  onCorrect: () => void;
  onMerge?: () => void;
}> = ({ entry, entryNo, onClose, onChanged, notify, onCorrect, onMerge }) => {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);

  const submit = async () => {
    setBusy(true);
    setRefusal(null);
    const res = await reverseStaffEntry(entry.id, reason.trim());
    setBusy(false);
    setConfirming(false);
    if (res.ok) {
      notify(remediationSummary(res.result), 'success');
      onChanged();
      onClose();
    } else {
      setRefusal(res.refusal);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Reverse {entryNo}
      </div>
      <p className="text-[11px] text-white/40">
        Posts a reversal entry that offsets {entryNo}. Only for an entry that no bank
        transaction or document is linked to.
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REMEDIATION_REASON_MAX}
        placeholder="Reason (required)"
        aria-label="Reason"
        disabled={busy}
        className={fieldCls}
      />

      {refusal && (
        <RemediationRefusalView refusal={refusal} entryLabel={entryNo}>
          {refusal.code === 'entry_has_links' && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span>Use instead:</span>
              {onMerge && (
                <button type="button" onClick={onMerge} className={linkBtnCls}>
                  Merge into…
                </button>
              )}
              <button type="button" onClick={onCorrect} className={linkBtnCls}>
                Correct
              </button>
            </div>
          )}
        </RemediationRefusalView>
      )}

      <div className="flex items-center gap-3">
        <PrimaryButton onClick={() => setConfirming(true)} disabled={!reason.trim() || busy} busy={busy}>
          Reverse
        </PrimaryButton>
        <SecondaryButton onClick={onClose} disabled={busy}>
          Cancel
        </SecondaryButton>
      </div>

      {confirming && (
        <ConfirmModal title={`Reverse ${entryNo}?`} onClose={() => !busy && setConfirming(false)}>
          <p className="text-sm text-white/70">
            Posts a reversal entry that offsets {entryNo}. Audited; cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void submit()} disabled={busy} busy={busy}>
              Confirm
            </PrimaryButton>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};

// ─── Attach document (D-S85-14) ────────────────────────────────────────────────
// A typed document id. The server refuses a document outside the client's org
// with the same 404 as one that does not exist.

const AttachDocumentEditor: FC<{
  entry: StaffEntryActionsEntry;
  entryNo: string;
  onClose: () => void;
  onChanged: () => void;
  notify: Notify;
  onOpenEntry?: (entry: EntryRef) => void;
}> = ({ entry, entryNo, onClose, onChanged, notify, onOpenEntry }) => {
  const [documentId, setDocumentId] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);

  const idText = documentId.trim();
  const validId = /^\d+$/.test(idText) && Number(idText) >= 1;
  const canSave = validId && !!reason.trim() && !busy;

  const submit = async () => {
    setBusy(true);
    setRefusal(null);
    const res = await attachStaffDocument(entry.id, Number(idText), reason.trim());
    setBusy(false);
    setConfirming(false);
    if (res.ok) {
      notify(remediationSummary(res.result), 'success');
      onChanged();
      onClose();
    } else {
      setRefusal(res.refusal);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Attach document · {entryNo}
      </div>
      <input
        value={documentId}
        onChange={(e) => setDocumentId(e.target.value)}
        inputMode="numeric"
        placeholder="Document id"
        aria-label="Document id"
        disabled={busy}
        className={`${fieldCls} ${idText && !validId ? 'border-red-500/60' : ''}`}
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REMEDIATION_REASON_MAX}
        placeholder="Reason (required)"
        aria-label="Reason"
        disabled={busy}
        className={fieldCls}
      />

      {refusal && (
        <RemediationRefusalView refusal={refusal} entryLabel={entryNo} onOpenEntry={onOpenEntry} />
      )}

      <div className="flex items-center gap-3">
        <PrimaryButton onClick={() => setConfirming(true)} disabled={!canSave} busy={busy}>
          Attach
        </PrimaryButton>
        <SecondaryButton onClick={onClose} disabled={busy}>
          Cancel
        </SecondaryButton>
      </div>

      {confirming && (
        <ConfirmModal title="Attach document?" onClose={() => !busy && setConfirming(false)}>
          <p className="text-sm text-white/70">
            Attaches document {idText} to {entryNo}. Audited; cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void submit()} disabled={busy} busy={busy}>
              Confirm
            </PrimaryButton>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};

// ─── Merge into… (D-S85-14) ────────────────────────────────────────────────────
// Rendered by the staff client-entries page while its list is in pick mode:
// "Merge into…" on the duplicate's panel starts it, clicking a row picks the
// survivor, and the confirm names both entries and both totals.

export interface MergeParty {
  id: string;
  number: string; // "JE-0068"
  total: string | null; // the entry's total debits, as listed
}

export const MergeEditor: FC<{
  duplicate: MergeParty;
  survivor: MergeParty | null;
  onCancel: () => void;
  onMerged: (summary: string) => void;
  onOpenEntry?: (entry: EntryRef) => void;
}> = ({ duplicate, survivor, onCancel, onMerged, onOpenEntry }) => {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<RemediationRefusal | null>(null);

  // A refusal belongs to the pair it was given for.
  useEffect(() => { setRefusal(null); }, [survivor?.id]);

  const refusedField = typeof refusal?.context.field === 'string' ? refusal.context.field : null;
  const partyCls = (refused: boolean) =>
    `flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm ${
      refused ? 'border-red-500/60 bg-red-500/10' : 'border-white/10 bg-white/5'
    }`;

  const submit = async () => {
    if (!survivor) return;
    setBusy(true);
    setRefusal(null);
    const res = await mergeStaffEntry(duplicate.id, survivor.id, reason.trim());
    setBusy(false);
    setConfirming(false);
    if (res.ok) onMerged(remediationSummary(res.result));
    else setRefusal(res.refusal);
  };

  return (
    <div className="space-y-3 rounded-md border border-[#0066FF]/40 bg-[#0066FF]/10 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
        Merge {duplicate.number} into…
      </div>
      <div className={partyCls(refusedField === 'entry')}>
        <span className="text-white/50">Duplicate</span>
        <span className="font-mono font-semibold text-white">{duplicate.number}</span>
        <span className="text-white/70">total {formatMoney(duplicate.total)}</span>
      </div>
      {survivor ? (
        <div className={partyCls(refusedField === 'survivor_entry_id')}>
          <span className="text-white/50">Surviving entry</span>
          <span className="font-mono font-semibold text-white">{survivor.number}</span>
          <span className="text-white/70">total {formatMoney(survivor.total)}</span>
        </div>
      ) : (
        <p className="text-sm text-white/70">
          Click the entry that should survive in the list below.
        </p>
      )}

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={REMEDIATION_REASON_MAX}
        placeholder="Reason (required)"
        aria-label="Reason"
        disabled={busy}
        className={fieldCls}
      />

      {refusal && (
        <RemediationRefusalView
          refusal={refusal}
          entryLabel={duplicate.number}
          survivorLabel={survivor?.number}
          onOpenEntry={onOpenEntry}
        />
      )}

      <div className="flex items-center gap-3">
        <PrimaryButton
          onClick={() => setConfirming(true)}
          disabled={!survivor || !reason.trim() || busy}
          busy={busy}
        >
          Merge
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={busy}>
          Cancel
        </SecondaryButton>
      </div>

      {confirming && survivor && (
        <ConfirmModal
          title={`Merge ${duplicate.number} into ${survivor.number}?`}
          onClose={() => !busy && setConfirming(false)}
        >
          <p className="text-sm text-white/70">
            {duplicate.number} (total {formatMoney(duplicate.total)}) is reversed as a duplicate,
            and its bank links and documents move to {survivor.number} (total{' '}
            {formatMoney(survivor.total)}). Audited; cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={() => void submit()} disabled={busy} busy={busy}>
              Confirm
            </PrimaryButton>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};

// ─── Panel ─────────────────────────────────────────────────────────────────────

type Mode = 'correct' | 'counterparty' | 'reverse' | 'attach' | null;

export const StaffEntryActions: FC<{
  orgId: string;
  entry: StaffEntryActionsEntry;
  onChanged: () => void;
  // Opens another entry of the chain in the page's panel — the correction
  // editor offers it when the entry turns out not to be the live one, and a
  // refusal links the entry it names.
  onOpenEntry?: (entry: EntryRef) => void;
  // Puts the page's entry list into pick mode with this entry as the
  // duplicate. Absent (a page with no entry list) → "Merge into…" is not
  // offered.
  onStartMerge?: () => void;
  // The page's toast. A save refetches the page, which can unmount this
  // panel, so a page that wants the confirmation to outlive it passes its own.
  notify?: Notify;
}> = ({ orgId, entry, onChanged, onOpenEntry, onStartMerge, notify }) => {
  const [mode, setMode] = useState<Mode>(null);
  const { toast, showToast } = useToast();
  const say = notify ?? showToast;

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
  const canMerge = actions.includes('merge') && !!onStartMerge;

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
            notify={say}
            onOpenEntry={onOpenEntry}
          />
        ) : mode === 'counterparty' ? (
          <CounterpartyEditor
            orgId={orgId}
            entry={entry}
            entryNo={entryNo}
            onClose={() => setMode(null)}
            onChanged={onChanged}
            notify={say}
          />
        ) : mode === 'reverse' ? (
          <ReverseEditor
            entry={entry}
            entryNo={entryNo}
            onClose={() => setMode(null)}
            onChanged={onChanged}
            notify={say}
            onCorrect={() => setMode('correct')}
            onMerge={canMerge ? onStartMerge : undefined}
          />
        ) : mode === 'attach' ? (
          <AttachDocumentEditor
            entry={entry}
            entryNo={entryNo}
            onClose={() => setMode(null)}
            onChanged={onChanged}
            notify={say}
            onOpenEntry={onOpenEntry}
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
                  {actions.includes('reverse') && (
                    <button type="button" onClick={() => setMode('reverse')} className={actionBtnCls}>
                      Reverse
                    </button>
                  )}
                  {canMerge && (
                    <button type="button" onClick={onStartMerge} className={actionBtnCls}>
                      Merge into…
                    </button>
                  )}
                  {actions.includes('attach_document') && (
                    <button type="button" onClick={() => setMode('attach')} className={actionBtnCls}>
                      Attach document
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

      {!notify && <Toast toast={toast} />}
    </div>
  );
};
