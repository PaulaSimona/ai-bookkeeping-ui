// §INV action bar + dialogs (S41 UI). Issue / void / payment / credit-note /
// send / PDF. Every WRITE action gates on canWrite; PDF (a read) is always
// available. Mutations status-check the resolved response and surface
// res.data.detail. Money is display-only.
import { type FC, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/t2/Card';
import { useAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/hooks/useToast';
import { useInvoicePdf } from '@/hooks/useInvoicePdf';
import {
  issueInvoice,
  voidInvoice,
  recordInvoicePayment,
  createCreditNote,
  sendInvoice,
  inputCls,
  primaryBtn,
  secondaryBtn,
} from '@/hooks/useSalesInvoices';
import type { InvoiceLineInput, SalesInvoice, TaxTreatment } from '@/types/salesInvoice';

type Dialog = null | 'issue' | 'void' | 'payment' | 'credit' | 'send';

interface Props {
  invoice: SalesInvoice;
  canWrite: boolean;
  counterpartyEmail?: string;
  onChanged: () => void;
}

const detailOf = (res: any, fallback = 'That action could not be completed.'): string =>
  res?.data?.detail ?? fallback;

export const InvoiceActionBar: FC<Props> = ({ invoice, canWrite, counterpartyEmail, onChanged }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { openPdf, isOpening } = useInvoicePdf();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  const isDraft = invoice.status === 'draft';
  const isVoided = invoice.status === 'voided';
  const isIssuedLike = ['issued', 'sent', 'partial', 'paid'].includes(invoice.status);
  const canVoid = invoice.status === 'issued' || invoice.status === 'sent';
  const canPay = ['issued', 'sent', 'partial'].includes(invoice.status);

  const pdfLabel = isDraft ? 'Preview (draft)' : 'PDF';

  const run = async (fn: () => Promise<any>, okMsg: string, after?: (data: any) => void) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res == null) { showToast({ title: 'Error', message: 'Request cancelled — retry.', variant: 'danger' }); return; }
      if (res.status >= 200 && res.status < 300) {
        showToast({ title: 'Done', message: okMsg, variant: 'success' });
        setDialog(null);
        if (after) after(res.data); else onChanged();
      } else {
        showToast({ title: 'Error', message: detailOf(res), variant: 'danger' });
      }
    } finally {
      setBusy(false);
    }
  };

  const doPdf = async () => {
    const r = await openPdf(invoice.id);
    if (!r.ok) showToast({ title: 'Error', message: r.detail ?? 'Could not open the PDF.', variant: 'danger' });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={secondaryBtn} onClick={doPdf} disabled={isOpening}>{pdfLabel}</button>

      {canWrite && isDraft && (
        <>
          <button className={secondaryBtn} onClick={() => navigate(`/accounting/invoices/${invoice.id}/edit`)}>Edit</button>
          <button className={primaryBtn} onClick={() => setDialog('issue')}>Issue</button>
        </>
      )}
      {canWrite && isIssuedLike && (
        <>
          <button className={secondaryBtn} onClick={() => setDialog('send')}>Send</button>
          {canPay && <button className={secondaryBtn} onClick={() => setDialog('payment')}>Record payment</button>}
          <button className={secondaryBtn} onClick={() => setDialog('credit')}>Credit note</button>
          {canVoid && <button className={secondaryBtn} onClick={() => setDialog('void')}>Void</button>}
        </>
      )}
      {isVoided && <span className="text-sm text-gray-400">Voided — no further actions.</span>}

      {dialog === 'issue' && (
        <Modal title="Issue invoice" onClose={() => setDialog(null)}>
          <p className="text-sm text-gray-600">
            Issuing assigns a permanent invoice number and posts the entry. This cannot be undone
            (corrections are made with a credit note). Continue?
          </p>
          <DialogButtons
            busy={busy}
            confirmLabel="Issue"
            onCancel={() => setDialog(null)}
            onConfirm={() => run(() => issueInvoice(invoice.id), 'Invoice issued.')}
          />
        </Modal>
      )}

      {dialog === 'void' && (
        <VoidDialog busy={busy} onClose={() => setDialog(null)}
          onConfirm={(reason) => run(() => voidInvoice(invoice.id, reason), 'Invoice voided.')} />
      )}

      {dialog === 'payment' && (
        <PaymentDialog busy={busy} onClose={() => setDialog(null)}
          onConfirm={(p) => run(() => recordInvoicePayment(invoice.id, p), 'Payment recorded.')} />
      )}

      {dialog === 'credit' && (
        <CreditNoteDialog busy={busy} onClose={() => setDialog(null)}
          onConfirm={(lines) => run(
            () => createCreditNote(invoice.id, lines),
            'Credit note created.',
            (data) => { setDialog(null); navigate(`/accounting/invoices/${data?.id}`); },
          )} />
      )}

      {dialog === 'send' && (
        <SendDialog busy={busy} placeholder={counterpartyEmail} onClose={() => setDialog(null)}
          onConfirm={(recipient) => run(() => sendInvoice(invoice.id, recipient || undefined), 'Send queued.')} />
      )}
    </div>
  );
};

// ── Modal shell + shared buttons ───────────────────────────────────────────────

const Modal: FC<{ title: string; onClose: () => void; children: ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
      <Card padding>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {children}
      </Card>
    </div>
  </div>
);

const DialogButtons: FC<{ busy: boolean; confirmLabel: string; onCancel: () => void; onConfirm: () => void; disabled?: boolean }> =
  ({ busy, confirmLabel, onCancel, onConfirm, disabled }) => (
    <div className="mt-5 flex justify-end gap-2">
      <button className={secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
      <button className={primaryBtn} onClick={onConfirm} disabled={busy || disabled}>
        {busy ? 'Working…' : confirmLabel}
      </button>
    </div>
  );

// ── Void ────────────────────────────────────────────────────────────────────

const VoidDialog: FC<{ busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }> = ({ busy, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Void invoice" onClose={onClose}>
      <p className="mb-2 text-sm text-gray-600">Voiding requires a reason. An invoice with recorded payments cannot be voided.</p>
      <textarea className={`${inputCls} min-h-[80px] w-full`} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <DialogButtons busy={busy} confirmLabel="Void" disabled={!reason.trim()} onCancel={onClose} onConfirm={() => onConfirm(reason.trim())} />
    </Modal>
  );
};

// ── Payment ─────────────────────────────────────────────────────────────────

const PaymentDialog: FC<{ busy: boolean; onClose: () => void; onConfirm: (p: { amount: string; payment_date: string; method?: string }) => void }> = ({ busy, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [method, setMethod] = useState('');
  return (
    <Modal title="Record payment" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Amount</span>
          <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Date</span>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Method (optional)</span>
          <input className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)} />
        </label>
      </div>
      <DialogButtons busy={busy} confirmLabel="Record" disabled={!amount || !date}
        onCancel={onClose} onConfirm={() => onConfirm({ amount, payment_date: date, method: method || undefined })} />
    </Modal>
  );
};

// ── Send ────────────────────────────────────────────────────────────────────

const SendDialog: FC<{ busy: boolean; placeholder?: string; onClose: () => void; onConfirm: (recipient: string) => void }> = ({ busy, placeholder, onClose, onConfirm }) => {
  const [recipient, setRecipient] = useState('');
  return (
    <Modal title="Send invoice" onClose={onClose}>
      <p className="mb-2 text-sm text-gray-600">
        The issued PDF is emailed to the customer. Leave blank to use the customer's invoice email;
        or enter a different address to change the delivery route (the PDF is unchanged).
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Recipient (optional override)</span>
        <input className={inputCls} type="email" placeholder={placeholder || 'customer@example.com'}
          value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      </label>
      <DialogButtons busy={busy} confirmLabel="Send" onCancel={onClose} onConfirm={() => onConfirm(recipient.trim())} />
    </Modal>
  );
};

// ── Credit note (free line-spec form) ─────────────────────────────────────────

const blankLine = (): InvoiceLineInput => ({ description: '', quantity: '1', unit_price: '', account: '', tax_treatment: 'taxable' });

const CreditNoteDialog: FC<{ busy: boolean; onClose: () => void; onConfirm: (lines: InvoiceLineInput[]) => void }> = ({ busy, onClose, onConfirm }) => {
  const { accounts } = useAccounts({ type: 'revenue', active: true });
  const [lines, setLines] = useState<InvoiceLineInput[]>([blankLine()]);
  const setLine = (i: number, patch: Partial<InvoiceLineInput>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const valid = lines.every((l) => l.description && l.unit_price && l.account);
  return (
    <Modal title="Create credit note" onClose={onClose}>
      <p className="mb-3 text-sm text-gray-600">Enter the lines to credit. A linked credit note is issued immediately.</p>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input className={`${inputCls} col-span-4`} placeholder="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
            <select className={`${inputCls} col-span-4`} value={l.account} onChange={(e) => setLine(i, { account: e.target.value })}>
              <option value="">Revenue account…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
            <input className={`${inputCls} col-span-2 text-right tabular-nums`} placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
            <input className={`${inputCls} col-span-2 text-right tabular-nums`} placeholder="Price" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} />
          </div>
        ))}
      </div>
      <button className={secondaryBtn + ' mt-2'} onClick={() => setLines((p) => [...p, blankLine()])}>Add line</button>
      <DialogButtons busy={busy} confirmLabel="Create credit note" disabled={!valid} onCancel={onClose} onConfirm={() => onConfirm(lines)} />
    </Modal>
  );
};

export default InvoiceActionBar;
