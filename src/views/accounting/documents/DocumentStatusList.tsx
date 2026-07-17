// Tier 2 document-status list (§14 14A-3, D-14A3-4/5/6). PRESENTATIONAL:
// usePaginatedList is LIFTED into DocumentsPage (the simpler wiring) so the
// upload zone's onUploaded and this list share one refetch without a ref or
// imperative handle — the 30s freshness interval also lives in the parent.
// This component only renders rows + badges + pager from props.
//
// D-14A3-5: raw routing_reason text is NEVER rendered — it only steers which
// calm badge shows. No row actions of any kind (read-only surface).
import { type FC } from 'react';

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

const Badge: FC<{ row: DocumentStatusRow }> = ({ row }) => {
  const { label, cls } = badgeFor(row);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

const SkeletonRow: FC = () => (
  <tr>
    {[160, 90, 70].map((w, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

export const DocumentStatusList: FC<Props> = ({
  items, count, page, setPage, pageSize, isLoading, error,
}) => {
  const showPager = count > pageSize;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Document', 'Uploaded', 'Status'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
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
                <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                  Couldn't load document status — retrying shortly.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                  No documents yet — upload your first receipt above.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.document_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 max-w-[320px] truncate">{row.name}</td>
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                  <td className="px-6 py-4"><Badge row={row} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pager — only when there is more than one page. */}
      {showPager && !isLoading && !error && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">{from}–{to} of {count}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * pageSize >= count}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
