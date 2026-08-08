// §INV create / edit-draft form (S41 UI). Line editor is add/remove only. The
// client sends lines (description, quantity, unit_price, account, tax_treatment)
// only — the server computes all money; totals appear on the detail page after
// save. Account picker is filtered to revenue accounts (client convenience;
// server authoritative). Write-gated on owner/accountant.
import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { useOrgMe, useAccounts } from '@/hooks/useAccounts';
import {
  createInvoice,
  patchInvoice,
  useSalesInvoice,
  useCounterpartyOptions,
  inputCls,
  primaryBtn,
  secondaryBtn,
} from '@/hooks/useSalesInvoices';
import { ClientCreateDialog } from '@/views/accounting/ClientCreateForm';
import { BillFromBanner } from '@/components/accounting/BillFromBanner';
import type { InvoiceLineInput, TaxTreatment } from '@/types/salesInvoice';

const TERMS = [
  { value: '', label: 'None' },
  { value: 'due_on_receipt', label: 'Due on receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
];

const TAX_TREATMENTS: { value: TaxTreatment; label: string }[] = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'zero_rated', label: 'Zero-rated' },
  { value: 'exempt', label: 'Exempt' },
];

const blankLine = (): InvoiceLineInput => ({
  description: '', quantity: '1', unit_price: '', account: '', tax_treatment: 'taxable',
});

export const InvoiceForm: FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { role } = useOrgMe();
  const canWrite = role === 'owner' || role === 'accountant';
  const { options: counterparties, refetch: refetchCounterparties } = useCounterpartyOptions();
  const { accounts } = useAccounts({ type: 'revenue', active: true });
  const [showAddClient, setShowAddClient] = useState(false);

  const { invoice, isLoading: loadingExisting } = useSalesInvoice(isEdit ? id : undefined);

  const [counterparty, setCounterparty] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [lines, setLines] = useState<InvoiceLineInput[]>([blankLine()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Prefill from the existing draft (edit mode).
  useEffect(() => {
    if (!isEdit || !invoice) return;
    setCounterparty(invoice.counterparty);
    setPaymentTerms(invoice.payment_terms ?? '');
    setIssueDate(invoice.issue_date ?? '');
    setNotes(invoice.notes ?? '');
    setPaymentInstructions(invoice.payment_instructions ?? '');
    setLines(
      invoice.lines.length
        ? invoice.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            account: l.account,
            tax_treatment: l.tax_treatment,
          }))
        : [blankLine()],
    );
  }, [isEdit, invoice]);

  const editingBlocked = isEdit && invoice != null && invoice.status !== 'draft';

  const setLine = (i: number, patch: Partial<InvoiceLineInput>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const canSubmit = useMemo(
    () => Boolean(counterparty) && lines.every((l) => l.description && l.unit_price && l.account),
    [counterparty, lines],
  );

  const submit = async () => {
    setErrors([]);
    setSubmitting(true);
    try {
      const payload = {
        counterparty,
        payment_terms: paymentTerms || '',
        issue_date: issueDate || null,
        notes,
        payment_instructions: paymentInstructions,
        lines,
      };
      const res = isEdit ? await patchInvoice(id as string, payload) : await createInvoice(payload);
      if (res == null) { setErrors(['Request was cancelled — please retry.']); return; }
      if (res.status === 201 || res.status === 200) {
        const invId = res.data?.id ?? id;
        // Success feedback is the navigation to the saved invoice's detail page.
        navigate(`/accounting/invoices/${invId}`);
      } else {
        const d = res.data;
        setErrors(d?.detail ? [d.detail] : ['Could not save the draft.']);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!canWrite) {
    return <Blocked message="You do not have permission to create invoices." onBack={() => navigate('/accounting/invoices')} />;
  }
  if (isEdit && loadingExisting) {
    return <div className="min-h-screen bg-gray-50 px-6 py-8 text-gray-500">Loading…</div>;
  }
  if (editingBlocked) {
    return <Blocked message="This invoice has been issued and can no longer be edited." onBack={() => navigate(`/accounting/invoices/${id}`)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <PageHeader title={isEdit ? 'Edit draft invoice' : 'New invoice'} />

        {/* O-S41-8: pre-flight bill-from warning (advisory; server guards issue). */}
        <BillFromBanner isOwner={role === 'owner'} />

        {errors.length > 0 && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        <Card padding className="mt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Customer">
              <div className="flex items-center gap-2">
                <select className={`${inputCls} flex-1`} value={counterparty} onChange={(e) => setCounterparty(e.target.value)}>
                  <option value="">Select a customer…</option>
                  {counterparties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50"
                  onClick={() => setShowAddClient(true)}
                >
                  + New client
                </button>
              </div>
            </Field>
            <Field label="Payment terms">
              <select className={inputCls} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Issue date (optional; defaults to today at issue)">
              <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card padding className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Line items</h2>
            <button className={secondaryBtn} onClick={addLine}>Add line</button>
          </div>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  className={`${inputCls} col-span-4`} placeholder="Description"
                  value={l.description} onChange={(e) => setLine(i, { description: e.target.value })}
                />
                <select
                  className={`${inputCls} col-span-3`}
                  value={l.account} onChange={(e) => setLine(i, { account: e.target.value })}
                >
                  <option value="">Revenue account…</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
                <input
                  className={`${inputCls} col-span-1 text-right tabular-nums`} placeholder="Qty" inputMode="decimal"
                  value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })}
                />
                <input
                  className={`${inputCls} col-span-2 text-right tabular-nums`} placeholder="Unit price" inputMode="decimal"
                  value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })}
                />
                <select
                  className={`${inputCls} col-span-1`}
                  value={l.tax_treatment} onChange={(e) => setLine(i, { tax_treatment: e.target.value as TaxTreatment })}
                >
                  {TAX_TREATMENTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button
                  className="col-span-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                  onClick={() => removeLine(i)} disabled={lines.length <= 1} title="Remove line"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Totals and taxes are computed by the server when the invoice is issued.
          </p>
        </Card>

        <Card padding className="mt-4">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Notes (optional)">
              <textarea className={`${inputCls} min-h-[70px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Payment instructions (optional)">
              <textarea className={`${inputCls} min-h-[70px]`} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} />
            </Field>
          </div>
        </Card>

        <div className="mt-6 flex items-center gap-3">
          <button className={primaryBtn} onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? 'Saving…' : 'Save draft'}
          </button>
          <button className={secondaryBtn} onClick={() => navigate(isEdit ? `/accounting/invoices/${id}` : '/accounting/invoices')}>
            Cancel
          </button>
        </div>
      </div>

      {showAddClient && (
        <ClientCreateDialog
          onCreated={(c) => {
            setShowAddClient(false);
            refetchCounterparties();
            setCounterparty(c.id); // auto-select the new client
          }}
          onClose={() => setShowAddClient(false)}
        />
      )}
    </div>
  );
};

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium text-gray-500">{label}</span>
    {children}
  </label>
);

const Blocked: FC<{ message: string; onBack: () => void }> = ({ message, onBack }) => (
  <div className="min-h-screen bg-gray-50 px-6 py-8">
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>
      <button className={secondaryBtn + ' mt-4'} onClick={onBack}>Back</button>
    </div>
  </div>
);

export default InvoiceForm;
