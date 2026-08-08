// §INV list (S41 UI). TableShell + FilterChips (status/kind) + debounced search
// + pagination footer, mirroring CounterpartyManager. Money is display-only;
// write actions (New invoice) gate on canWrite (owner/accountant).
import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { FilterChip } from '@/components/t2/FilterChip';
import { StatusBadge } from '@/components/t2/StatusBadge';
import { TableShell, TableRow, type T2Column } from '@/components/t2/TableShell';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { useOrgMe } from '@/hooks/useAccounts';
import { useToast } from '@/hooks/useToast';
import {
  fmtMoney,
  invoiceNumberLabel,
  statusMeta,
  useCounterpartyOptions,
  primaryBtn,
  secondaryBtn,
  inputCls,
} from '@/hooks/useSalesInvoices';
import { ClientCreateDialog } from '@/views/accounting/ClientCreateForm';
import type { InvoiceStatus, InvoiceKind, SalesInvoice } from '@/types/salesInvoice';

const STATUS_FILTERS: { value: '' | InvoiceStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'voided', label: 'Voided' },
];

const KIND_FILTERS: { value: '' | InvoiceKind; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'credit_note', label: 'Credit notes' },
];

const COLUMNS: T2Column[] = [
  { label: 'Number', fr: 1.1 },
  { label: 'Customer', fr: 1.6 },
  { label: 'Issued', fr: 1 },
  { label: 'Due', fr: 1 },
  { label: 'Status', fr: 1 },
  { label: 'Total', fr: 1, align: 'right' },
];

export const InvoiceList: FC = () => {
  const navigate = useNavigate();
  const { role } = useOrgMe();
  const canWrite = role === 'owner' || role === 'accountant';
  const { byId } = useCounterpartyOptions();
  const { showToast } = useToast();
  const [showAddClient, setShowAddClient] = useState(false);

  const [status, setStatus] = useState<'' | InvoiceStatus>('');
  const [kind, setKind] = useState<'' | InvoiceKind>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (status) p.status = status;
    if (kind) p.kind = kind;
    if (search) p.search = search;
    return p;
  }, [status, kind, search]);

  const { items, count, page, setPage, pageSize, isLoading, error } =
    usePaginatedList<SalesInvoice>('/api/accounting/sales-invoices/', params);

  // Debounce search (300ms) and reset to page 1 on any filter change.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [status, kind, search, setPage]);

  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Invoices"
          subtitle="Sales invoices and credit notes"
          right={canWrite ? (
            <div className="flex items-center gap-2">
              <button className={secondaryBtn} onClick={() => setShowAddClient(true)}>Add client</button>
              <button className={primaryBtn} onClick={() => navigate('/accounting/invoices/new')}>New invoice</button>
            </div>
          ) : undefined}
        />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <FilterChip key={f.value || 'all'} active={status === f.value} onClick={() => setStatus(f.value)}>
              {f.label}
            </FilterChip>
          ))}
          <span className="mx-1 h-6 w-px bg-gray-200" />
          {KIND_FILTERS.map((f) => (
            <FilterChip key={f.value || 'allkind'} active={kind === f.value} onClick={() => setKind(f.value)}>
              {f.label}
            </FilterChip>
          ))}
        </div>

        <div className="mt-3">
          <input
            className={`${inputCls} w-full max-w-sm`}
            placeholder="Search by customer name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card className="mt-4">
          <TableShell
            columns={COLUMNS}
            isEmpty={!isLoading && items.length === 0}
            empty={isLoading ? 'Loading…' : 'No invoices yet.'}
          >
            {items.map((inv) => {
              const meta = statusMeta(inv.status, inv.is_overdue);
              return (
                <TableRow
                  key={inv.id}
                  columns={COLUMNS}
                  onClick={() => navigate(`/accounting/invoices/${inv.id}`)}
                  cells={[
                    <span className="font-medium text-gray-900">{invoiceNumberLabel(inv)}</span>,
                    <span className="truncate">{byId[inv.counterparty]?.name ?? '—'}</span>,
                    inv.issue_date ?? '—',
                    inv.due_date ?? '—',
                    <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>,
                    <span className="tabular-nums">{fmtMoney(inv.total, inv.currency)}</span>,
                  ]}
                />
              );
            })}
          </TableShell>
        </Card>

        <div className="mt-3 flex items-center justify-between text-[13px] text-gray-500">
          <span>{count === 0 ? 'No results' : `${from}–${to} of ${count}`}</span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40"
              onClick={() => setPage(page + 1)}
              disabled={page * pageSize >= count}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showAddClient && (
        <ClientCreateDialog
          onCreated={() => {
            setShowAddClient(false);
            showToast({ title: 'Client added', message: 'The client is now available.', variant: 'success' });
          }}
          onClose={() => setShowAddClient(false)}
        />
      )}
    </div>
  );
};

export default InvoiceList;
