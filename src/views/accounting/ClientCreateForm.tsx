// Shared client/supplier create form (O-S41-7). Extracted VERBATIM from
// CounterpartyManager's former inline form (same fields, same submit path via
// createCounterparty, same error surfacing) so both the counterparty pages and
// the §INV entry points open ONE form with no duplicated form logic.
//
// - ClientCreateForm: the bare form body (grid + errors + Save/Cancel) — used
//   inline by CounterpartyManager inside its existing showForm panel.
// - ClientCreateDialog: a modal wrapper around it — used by the §INV Invoices
//   list header and the invoice form's customer picker.
import { type FC, useState } from 'react';

import { Card } from '@/components/t2/Card';
import { createCounterparty, type CounterpartyRole } from '@/hooks/useCounterparties';
import { inputCls } from '@/hooks/useSalesInvoices';

const TERMS: { value: string; label: string }[] = [
  { value: 'due_on_receipt', label: 'Due on receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
];

const blankForm = {
  name: '', contact_name: '', email: '', city: '', province: '', payment_terms: '',
};

export interface CreatedCounterparty {
  id: string;
  name: string;
  email?: string;
  payment_terms?: string;
}

interface ClientCreateFormProps {
  role: CounterpartyRole;
  noun: string; // 'client' | 'supplier'
  onCreated: (created: CreatedCounterparty) => void;
  onCancel: () => void;
}

export const ClientCreateForm: FC<ClientCreateFormProps> = ({ role, noun, onCreated, onCancel }) => {
  const [form, setForm] = useState(blankForm);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setErrors(null);
    try {
      const flag = role === 'client' ? { is_client: true } : { is_supplier: true };
      const res = await createCounterparty({ ...form, ...flag });
      if (res?.status === 201) {
        setForm(blankForm);
        onCreated(res.data as CreatedCounterparty);
      } else if (res?.status === 400) {
        const d = res.data;
        setErrors(d?.detail ? { detail: [d.detail] } : (d ?? { detail: ['Could not create.'] }));
      } else {
        setErrors({ detail: ['Could not create.'] });
      }
    } catch (e: any) {
      const d = e?.response?.data;
      setErrors(d && typeof d === 'object' ? d : { detail: ['Could not create.'] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Business name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact name</label>
          <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>
          <input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className={`${inputCls} w-full`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment terms</label>
          <select value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className={`${inputCls} w-full`}>
            <option value="">—</option>
            {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {errors && (
        <div className="mt-3 text-sm text-red-600 space-y-0.5">
          {Object.entries(errors).map(([field, msgs]) => (
            <div key={field}>{field === 'detail' ? '' : `${field}: `}{(msgs as string[]).join(' ')}</div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={submitting || !form.name.trim()}
          onClick={submit}
          className="rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition"
        >
          {submitting ? 'Saving…' : `Save ${noun}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </>
  );
};

// Modal wrapper for the §INV entry points.
export const ClientCreateDialog: FC<{
  role?: CounterpartyRole;
  onCreated: (created: CreatedCounterparty) => void;
  onClose: () => void;
}> = ({ role = 'client', onCreated, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
      <Card padding>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">New client</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <ClientCreateForm role={role} noun="client" onCreated={onCreated} onCancel={onClose} />
      </Card>
    </div>
  </div>
);

export default ClientCreateForm;
