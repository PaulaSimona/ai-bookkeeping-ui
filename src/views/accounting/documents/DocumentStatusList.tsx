// Tier 2 document list (§14 14A-3, D-14A3-4/5/6; Release E2, O-S89-E5/E7).
// PRESENTATIONAL: the list state (filters, page, open row) is lifted into
// DocumentsPage and held in the URL; this component renders rows, badges and
// the pager from props, and asks the server only for a file URL or a delete.
//
// Columns (O-S89-E7): document date · name (with its supplier, or the name
// the model read) · type · total · status. The table sits in its own frame
// that scrolls both ways and fills the height it is given (flex-1 min-h-0
// overflow-auto); its header sticks inside that frame; the table never
// shrinks below 56rem, so columns keep their minimums and the FRAME scrolls
// sideways, never the page. Every amount is the server's string, shown as
// sent (never formatMoney).
//
// D-14A3-5: raw routing_reason text is NEVER rendered — it only steers which
// calm badge shows. The open row is marked (aria-selected) and reported to the
// page; what it opens is the page's drawer.
import { type FC, type KeyboardEvent, useState } from 'react';
import { Card } from '@/components/t2/Card';
import api from '@/utils/api';
import { useToast } from '@/hooks/useToast';
import { documentTypeLabel, renameDocument, type DocumentRow } from '@/hooks/useDocumentList';

// O-S30-3: the terminal, entry-unlinked statuses a client may dispose of. Must
// mirror the backend eligibility ({not_source_document, rejected, failed}); the
// backend is the authority — the button just avoids offering an action that
// would 400. (Entry-linked terminal docs still 400 server-side.)
const DELETABLE_STATUSES = new Set(['not_source_document', 'rejected', 'failed']);

// Kept for the page and the upload zone, which name the row by this type.
export type DocumentStatusRow = DocumentRow;

interface Props {
  items: DocumentRow[];
  count: number;
  page: number;
  setPage: (n: number) => void;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  // Optional override for the empty-rows message (14-C-4 U2: a filtered chip
  // shows "No <status> documents." instead of the first-upload prompt). Absent
  // → the original unfiltered copy, byte-preserved.
  emptyMessage?: string;
  // O-S30-3: called after a successful (204) delete so the parent refreshes the
  // list AND the status-count tiles (the tile drops with the row).
  onDeleted?: () => void;
  // The open row (O-S89-E7), and how a click changes it.
  open?: number | null;
  onOpen?: (documentId: number | null) => void;
  // O-S89-E4: a rename the server carried out — the row it answered with.
  onRenamed?: (row: DocumentRow) => void;
}

const RENAME_GONE = 'This document is no longer available.';

// D-14A3-5 badge precedence — routing_reason wins, then accounting_status;
// unknown/future statuses fall through to a safe "Processing" (never a crash).
export const badgeFor = (row: DocumentRow): { label: string; cls: string } => {
  if (row.routing_reason === 'no_tax_profile') {
    return { label: 'Waiting for setup', cls: 'bg-amber-50 text-amber-700' };
  }
  // O-S30-1 / F-S30-7: a bank/credit-card statement is STRUCTURALLY refused on
  // the document path (accounting_status=not_source_document, routing_reason=
  // bank_statement) — it is not an error and not "processing". Amber, matching
  // the no_tax_profile "needs your attention" pill. Either signal alone
  // qualifies (the backend sets both, but be robust to either).
  if (row.routing_reason === 'bank_statement'
      || row.accounting_status === 'not_source_document') {
    return { label: 'Not a source document', cls: 'bg-amber-50 text-amber-700' };
  }
  switch (row.accounting_status) {
    case 'pending':
    case 'processing':
      return { label: 'Processing', cls: 'bg-gray-100 text-gray-600' };
    case 'posted':
      return { label: 'Posted', cls: 'bg-emerald-50 text-emerald-700' };
    case 'needs_review':
    case 'failed':
      return { label: 'In review', cls: 'bg-blue-50 text-blue-700' };
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-red-50 text-red-700' };
    default:
      return { label: 'Processing', cls: 'bg-gray-100 text-gray-600' };
  }
};

// A date as the server sent it (YYYY-MM-DD), or a dash.
const dateText = (value: string | null | undefined): string => value || '—';

// Local StatusBadge-style pill (t2/StatusBadge is edit-forbidden). Colour pair
// comes from badgeFor; shape matches the shipped t2 pill.
const Badge: FC<{ row: DocumentRow }> = ({ row }) => {
  const { label, cls } = badgeFor(row);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
};

// The name's second line: the supplier it was filed under, or the name the
// model read when no supplier matched (O-S89-E3 "Read as").
const NameDetail: FC<{ row: DocumentRow }> = ({ row }) => {
  if (row.display_name_source === 'supplier' && row.counterparty) {
    return <div className="truncate text-xs text-gray-500">Supplier · {row.counterparty.name}</div>;
  }
  if (row.read_as) {
    return <div className="truncate text-xs text-gray-500">Read as · {row.read_as}</div>;
  }
  return null;
};

// O-S89-E6: the document this one duplicates, by the name the page shows for
// it — "Already uploaded as" when this one was rejected for it, "Possible
// duplicate of" while it is still the soft rule's suspicion — and a way to
// open the original (the page's open row).
const DuplicateLine: FC<{ row: DocumentRow; onOpen?: (documentId: number | null) => void }> = ({ row, onOpen }) => {
  if (!row.duplicate_of) return null;
  const wording = row.accounting_status === 'rejected' ? 'Already uploaded as' : 'Possible duplicate of';
  return (
    <div className="truncate text-xs text-amber-700">
      {wording}{' '}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen?.(row.duplicate_of!.id); }}
        className="font-semibold underline underline-offset-2 hover:text-gray-900"
      >
        {row.duplicate_of.name}
      </button>
    </div>
  );
};

const SkeletonRow: FC = () => (
  <tr>
    {[80, 200, 70, 60, 70, 40].map((w, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-3.5 animate-pulse rounded bg-gray-100" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

const HEADERS = ['Document date', 'Name', 'Type', 'Total', 'Status', ''];
const headCls = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500';

export const DocumentStatusList: FC<Props> = ({
  items, count, page, setPage, pageSize, isLoading, error, emptyMessage,
  onDeleted, open = null, onOpen, onRenamed,
}) => {
  const { showToast } = useToast();
  // O-S89-E4: the row being renamed, what has been typed, and whether the
  // request is out. What the row shows afterwards is the SERVER's row
  // (renamed), never the typed name — the executed guard of this screen.
  const [renaming, setRenaming] = useState<{ id: number; draft: string } | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renamed, setRenamed] = useState<Record<number, DocumentRow>>({});

  const startRename = (row: DocumentRow) => {
    if (renameBusy) return;
    setRenaming({ id: row.document_id, draft: row.display_name });
  };
  const cancelRename = () => {
    if (!renameBusy) setRenaming(null);
  };
  const saveRename = async () => {
    if (!renaming || renameBusy) return;
    setRenameBusy(true);
    const outcome = await renameDocument(renaming.id, renaming.draft);
    setRenameBusy(false);
    if (outcome.ok) {
      setRenamed((prev) => ({ ...prev, [outcome.row.document_id]: outcome.row }));
      setRenaming(null);
      onRenamed?.(outcome.row);
      return;
    }
    if (outcome.status === 404) {
      // Gone: the list is read again, and the field closes with the row.
      setRenaming(null);
      showToast({ title: 'Could not rename document', message: RENAME_GONE, variant: 'danger' });
      onDeleted?.();
      return;
    }
    // Refused, or no answer: the field stays open with what was typed.
    showToast({ title: 'Could not rename document', message: outcome.detail, variant: 'danger' });
  };
  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void saveRename(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
  };
  // Optimistic removal: hide a just-deleted row immediately (before the parent's
  // refetch lands). The subsequent refresh reconciles list + counts from the
  // server; a stale id lingering here is harmless (the row is already gone).
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const visibleItems = items
    .filter((r) => !deletedIds.has(r.document_id))
    // A renamed row shows the server's answer until the list is read again.
    .map((r) => renamed[r.document_id] ?? r);
  const showPager = count > pageSize;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  // O-S30-3: dispose of a terminal, entry-unlinked document. window.confirm
  // (D3) carries the name + "This cannot be undone."; on 204 the row is removed
  // optimistically and the parent refreshes counts so the tile drops with it; a
  // 400 is toasted with a message keyed by the backend's returned code.
  const deleteDocument = async (row: DocumentRow) => {
    if (deletingId !== null) return;
    if (!window.confirm(`Delete "${row.display_name}"? This cannot be undone.`)) return;
    setDeletingId(row.document_id);
    try {
      const res = await api.delete(`/api/accounting/documents/${row.document_id}/`);
      if (res?.status === 204) {
        setDeletedIds((prev) => new Set(prev).add(row.document_id));
        if (open === row.document_id) onOpen?.(null);
        onDeleted?.();
      } else {
        const code = res?.data?.code;
        const message =
          code === 'document_has_entry'
            ? 'This document has a linked journal entry and can’t be deleted.'
            : code === 'document_not_terminal'
              ? 'This document can’t be deleted in its current status.'
              : res?.data?.detail ?? 'Please try again in a moment.';
        showToast({ title: 'Could not delete document', message, variant: 'danger' });
      }
    } catch (e: any) {
      showToast({
        title: 'Could not delete document',
        message: e?.response?.data?.detail ?? 'Please try again in a moment.',
        variant: 'danger',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // View action (Session-25 Phase E, O-S25-3): fetch a short-lived signed URL on
  // click — NEVER prefetched for the whole list — then open it in a new tab. The
  // tab is opened synchronously (before the await) so the popup blocker allows
  // it, and detached (opener = null) so the signed URL can't reach this window.
  const viewDocument = async (documentId: number) => {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const res = await api.get(`/api/accounting/documents/${documentId}/file-url/`);
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

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      {/* The one scrolling frame (O-S89-E7): both ways, filling the height
          the page gives it; the header sticks inside it. */}
      <div className="min-h-0 flex-1 overflow-auto" data-testid="document-table-frame">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_0_theme(colors.gray.100)]">
            <tr>
              {HEADERS.map((h, i) => (
                <th key={h || i} className={`${headCls} ${h === 'Total' ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  Couldn't load document status — retrying shortly.
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  {emptyMessage ?? 'No documents yet — upload your first receipt above.'}
                </td>
              </tr>
            ) : (
              visibleItems.map((row) => {
                const isOpen = open === row.document_id;
                return (
                  <tr
                    key={row.document_id}
                    aria-selected={isOpen}
                    onClick={() => onOpen?.(isOpen ? null : row.document_id)}
                    className={`cursor-pointer transition-colors ${
                      isOpen ? 'bg-[var(--color-primary-light)]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{dateText(row.document_date)}</td>
                    {/* The column that gives way: it takes the width the
                        others leave, and its text is cut short to fit. */}
                    <td className="w-full max-w-0 px-4 py-3">
                      {renaming?.id === row.document_id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            aria-label="Document name"
                            value={renaming.draft}
                            maxLength={200}
                            disabled={renameBusy}
                            autoFocus
                            onChange={(e) => setRenaming({ id: row.document_id, draft: e.target.value })}
                            onKeyDown={onRenameKey}
                            className="h-8 w-full rounded-lg border border-gray-200 px-2.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() => void saveRename()}
                            disabled={renameBusy}
                            className="text-[13px] font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            disabled={renameBusy}
                            className="text-[13px] font-medium text-gray-500 hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="truncate font-medium text-gray-900" title={row.display_name}>
                            {row.display_name}
                          </div>
                          <NameDetail row={row} />
                          <DuplicateLine row={row} onOpen={onOpen} />
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{documentTypeLabel(row.document_type)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-900">
                      {row.total != null ? `${row.total} ${row.currency ?? ''}`.trim() : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3"><Badge row={row} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-4">
                        {/* O-S89-E4: rename in place — owner or accountant; the server decides. */}
                        {renaming?.id !== row.document_id && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); startRename(row); }}
                            disabled={renameBusy}
                            className="text-[13px] font-medium text-gray-600 hover:underline disabled:opacity-50"
                          >
                            Rename
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); viewDocument(row.document_id); }}
                          className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          View
                        </button>
                        {/* O-S30-3: Delete only on terminal, disposable statuses —
                            never rendered on any other status. */}
                        {DELETABLE_STATUSES.has(row.accounting_status) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteDocument(row); }}
                            disabled={deletingId === row.document_id}
                            className="text-[13px] font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingId === row.document_id ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pager — only when there is more than one page. */}
      {showPager && !isLoading && !error && (
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
          <span className="text-xs text-gray-500">{from}–{to} of {count}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * pageSize >= count}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
