// Tier 2 document-status list (§14 14A-3, D-14A3-4/5/6). PRESENTATIONAL:
// usePaginatedList is LIFTED into DocumentsPage (the simpler wiring) so the
// upload zone's onUploaded and this list share one refetch without a ref or
// imperative handle — the 30s freshness interval also lives in the parent.
// This component only renders rows + badges + pager from props.
//
// D-14A3-5: raw routing_reason text is NEVER rendered — it only steers which
// calm badge shows. No row actions of any kind (read-only surface).
//
// s22 B2: restyled onto the t2/ table look (t2/Card surface, letter-spaced
// headers, StatusBadge-style pills built locally — t2/StatusBadge is not edited).
// The prop shape, pagination behavior, and every loading/error/empty branch are
// preserved exactly.
import { type FC } from 'react';
import { Card } from '@/components/t2/Card';
import api from '@/utils/api';
import { useToast } from '@/hooks/useToast';

export interface DocumentStatusRow {
  document_id: number;
  name: string;
  created_at: string;
  extraction_status: string;
  accounting_status: string;
  routing_reason: string | null;
}

interface Props {
  items: DocumentStatusRow[];
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
}

// D-14A3-5 badge precedence — routing_reason wins, then accounting_status;
// unknown/future statuses fall through to a safe "Processing" (never a crash).
const badgeFor = (row: DocumentStatusRow): { label: string; cls: string } => {
  if (row.routing_reason === 'no_tax_profile') {
    return { label: 'Waiting for setup', cls: 'bg-amber-50 text-amber-700' };
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

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

// Local StatusBadge-style pill (t2/StatusBadge is edit-forbidden). Colour pair
// comes from badgeFor; shape matches the shipped t2 pill.
const Badge: FC<{ row: DocumentStatusRow }> = ({ row }) => {
  const { label, cls } = badgeFor(row);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
};

const SkeletonRow: FC = () => (
  <tr>
    {[160, 90, 70, 40].map((w, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-3.5 animate-pulse rounded bg-gray-100" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

const HEADERS = ['Document', 'Uploaded', 'Status', ''];

export const DocumentStatusList: FC<Props> = ({
  items, count, page, setPage, pageSize, isLoading, error, emptyMessage,
}) => {
  const { showToast } = useToast();
  const showPager = count > pageSize;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

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
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                >
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
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                  Couldn't load document status — retrying shortly.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                  {emptyMessage ?? 'No documents yet — upload your first receipt above.'}
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.document_id} className="transition-colors hover:bg-gray-50">
                  <td className="max-w-[320px] truncate px-6 py-4 font-medium text-gray-900">{row.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-gray-500">{fmtDate(row.created_at)}</td>
                  <td className="px-6 py-4"><Badge row={row} /></td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => viewDocument(row.document_id)}
                      className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
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
