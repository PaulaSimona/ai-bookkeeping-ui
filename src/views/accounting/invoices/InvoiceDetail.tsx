// §INV detail (S41 UI). Header (number + status + overdue), customer, dates,
// line items, server-computed totals, payments, and the action bar. Money is
// display-only. Write actions gate on canWrite; PDF is a read (always shown).
import { type FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { StatusBadge } from '@/components/t2/StatusBadge';
import { TableShell, TableRow, type T2Column } from '@/components/t2/TableShell';
import { useOrgMe } from '@/hooks/useAccounts';
import {
  fmtMoney,
  invoiceNumberLabel,
  statusMeta,
  useSalesInvoice,
  useCounterpartyOptions,
  secondaryBtn,
} from '@/hooks/useSalesInvoices';
import { InvoiceActionBar } from './InvoiceActions';

const LINE_COLS: T2Column[] = [
  { label: 'Description', fr: 2.2 },
  { label: 'Account', fr: 1.6 },
  { label: 'Qty', fr: 0.6, align: 'right' },
  { label: 'Unit price', fr: 1, align: 'right' },
  { label: 'Tax', fr: 1, align: 'right' },
];

const PAY_COLS: T2Column[] = [
  { label: 'Date', fr: 1 },
  { label: 'Method', fr: 1 },
  { label: 'Amount', fr: 1, align: 'right' },
];

export const InvoiceDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useOrgMe();
  const canWrite = role === 'owner' || role === 'accountant';
  const { invoice, isLoading, error, refetch } = useSalesInvoice(id);
  const { byId } = useCounterpartyOptions();

  if (isLoading) return <div className="min-h-screen bg-gray-50 px-6 py-8 text-gray-500">Loading…</div>;
  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error ?? 'Invoice not found.'}</div>
          <button className={secondaryBtn + ' mt-4'} onClick={() => navigate('/accounting/invoices')}>Back to invoices</button>
        </div>
      </div>
    );
  }

  const cp = byId[invoice.counterparty];
  const meta = statusMeta(invoice.status, invoice.is_overdue);
  const isCredit = invoice.kind === 'credit_note';
  const cur = invoice.currency;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <button className="mb-4 text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate('/accounting/invoices')}>
          ← Invoices
        </button>

        <PageHeader
          title={`${isCredit ? 'Credit note' : 'Invoice'} ${invoiceNumberLabel(invoice)}`}
          subtitle={cp?.name}
          right={<InvoiceActionBar invoice={invoice} canWrite={canWrite} counterpartyEmail={cp?.email} onChanged={refetch} />}
        />

        <div className="mt-4 flex items-center gap-3">
          <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
          {invoice.related_invoice && (
            <button className="text-xs text-blue-600 hover:underline" onClick={() => navigate(`/accounting/invoices/${invoice.related_invoice}`)}>
              View related invoice
            </button>
          )}
        </div>

        <Card padding className="mt-5">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Meta label="Customer" value={cp?.name ?? '—'} />
            <Meta label="Issue date" value={invoice.issue_date ?? '—'} />
            <Meta label="Due date" value={invoice.due_date ?? '—'} />
            <Meta label="Terms" value={invoice.payment_terms || '—'} />
          </div>
        </Card>

        <Card className="mt-4">
          <TableShell columns={LINE_COLS} isEmpty={invoice.lines.length === 0} empty="No lines.">
            {invoice.lines.map((l) => (
              <TableRow
                key={l.id}
                columns={LINE_COLS}
                cells={[
                  l.description,
                  <span className="text-gray-500">{l.account_code} {l.account_name}</span>,
                  <span className="tabular-nums">{l.quantity}</span>,
                  <span className="tabular-nums">{fmtMoney(l.unit_price, cur)}</span>,
                  <span className="tabular-nums">{l.tax_amount != null ? fmtMoney(l.tax_amount, cur) : (l.tax_treatment === 'taxable' ? '—' : l.tax_treatment.replace('_', '-'))}</span>,
                ]}
              />
            ))}
          </TableShell>
          <div className="flex justify-end border-t border-gray-100 px-4 py-4">
            <div className="w-64 space-y-1 text-sm">
              <Total label="Subtotal" value={fmtMoney(invoice.subtotal, cur)} />
              <Total label="Tax" value={fmtMoney(invoice.tax_total, cur)} />
              <div className="border-t border-gray-100 pt-1" />
              <Total label="Total" value={fmtMoney(invoice.total, cur)} bold />
            </div>
          </div>
        </Card>

        {invoice.payments.length > 0 && (
          <Card className="mt-4">
            <div className="px-4 pt-3 text-sm font-semibold text-gray-700">Payments</div>
            <TableShell columns={PAY_COLS}>
              {invoice.payments.map((p) => (
                <TableRow
                  key={p.id}
                  columns={PAY_COLS}
                  cells={[p.payment_date, p.method || '—', <span className="tabular-nums">{fmtMoney(p.amount, cur)}</span>]}
                />
              ))}
            </TableShell>
          </Card>
        )}

        {(invoice.notes || invoice.payment_instructions) && (
          <Card padding className="mt-4 text-sm text-gray-600">
            {invoice.notes && <p className="whitespace-pre-wrap">{invoice.notes}</p>}
            {invoice.payment_instructions && <p className="mt-2 whitespace-pre-wrap text-gray-500">{invoice.payment_instructions}</p>}
          </Card>
        )}
      </div>
    </div>
  );
};

const Meta: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs font-medium text-gray-400">{label}</div>
    <div className="mt-0.5 text-gray-800">{value}</div>
  </div>
);

const Total: FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div className={`flex justify-between ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

export default InvoiceDetail;
