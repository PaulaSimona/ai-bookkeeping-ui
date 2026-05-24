import { type FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  date?: string;
  vendor?: string;
  description?: string;
  category?: string;
  amount?: number;
  tax_amount?: number;
  currency?: string;
  low_confidence?: boolean;
}

interface Doc {
  id: number;
  name: string;
  created_at: string;
  extraction_status: 'pending' | 'done' | 'failed' | 'needs_clarification' | 'unreadable';
  extracted_data: LineItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n);

const docTotal = (doc: Doc) => {
  const items = doc.extracted_data ?? [];
  const totalRow = items.find((i) => i.description === '_total');
  if (totalRow && typeof totalRow.amount === 'number') return totalRow.amount;
  return items
    .filter((i) => i.description !== '_total')
    .reduce((s, item) => s + (typeof item.amount === 'number' ? item.amount : 0), 0);
};

const docTax = (doc: Doc) =>
  (doc.extracted_data ?? []).reduce((s, item) => s + (typeof item.tax_amount === 'number' ? item.tax_amount : 0), 0);

const docDate = (doc: Doc) => {
  const raw = doc.extracted_data?.[0]?.date;
  const d = raw ? new Date(raw) : new Date(doc.created_at);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

const docVendor = (doc: Doc) =>
  doc.extracted_data?.[0]?.vendor?.trim() ||
  doc.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');

const docCategory = (doc: Doc) =>
  doc.extracted_data?.[0]?.category ?? '—';

const timeSaved = (docCount: number): string => {
  const totalMinutes = docCount * 2.5;
  if (totalMinutes < 60) return `${Math.floor(totalMinutes)} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins  = Math.round(totalMinutes % 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const isThisMonth = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const UploadIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}

const StatCard: FC<StatCardProps> = ({ label, value, sub, icon, accent = 'bg-blue-50 text-[#0066FF]' }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      </div>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
        {icon}
      </div>
    </div>
  </div>
);

const StatusBadge: FC<{ status: Doc['extraction_status'] }> = ({ status }) => {
  const map: Record<Doc['extraction_status'], { label: string; cls: string }> = {
    done:                { label: 'Categorized', cls: 'bg-emerald-50 text-emerald-700' },
    failed:              { label: 'Failed',      cls: 'bg-red-50 text-red-700'         },
    pending:             { label: 'Processing',  cls: 'bg-amber-50 text-amber-700'     },
    needs_clarification: { label: 'Needs review',cls: 'bg-blue-50 text-blue-700'      },
    unreadable:          { label: 'Unreadable',  cls: 'bg-orange-50 text-orange-700'  },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

const SkeletonRow = () => (
  <tr>
    {[60, 120, 100, 80, 90].map((w, i) => (
      <td key={i} className="px-6 py-4">
        <div className={`h-3.5 bg-gray-100 rounded animate-pulse`} style={{ width: w }} />
      </td>
    ))}
  </tr>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const Dashboard: FC = () => {
  const auth = useSelector((s: RootState) => s.auth);
  const firstName: string = auth.user?.user?.first_name ?? auth.user?.first_name ?? '';

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/api/documents/')
      .then((res) => {
        if (Array.isArray(res?.data)) setDocs(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Stats
  const monthDocs  = docs.filter((d) => isThisMonth(d.created_at));
  const totalExp   = docs.reduce((s, d) => s + docTotal(d), 0);
  const totalTax   = docs.reduce((s, d) => s + docTax(d), 0);
  const recent     = [...docs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting()}{firstName ? `, ${firstName}` : ''} 👋
            </h1>
            <p className="mt-1 text-sm text-gray-500">Here's your financial overview</p>
          </div>
          <Link
            to="/documents"
            className="flex items-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
          >
            <UploadIcon />
            Upload document
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Documents this month"
            value={loading ? '—' : String(monthDocs.length)}
            sub={loading ? '' : `${docs.length} total`}
            accent="bg-blue-50 text-[#0066FF]"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatCard
            label="Total expenses"
            value={loading ? '—' : fmt(totalExp)}
            sub="All documents"
            accent="bg-violet-50 text-violet-600"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="ITC / Tax claimable"
            value={loading ? '—' : totalTax > 0 ? fmt(totalTax) : 'See Reports'}
            sub={totalTax > 0 ? 'From extracted receipts' : 'Run a tax report'}
            accent="bg-emerald-50 text-emerald-600"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
              </svg>
            }
          />
          <StatCard
            label="Time saved"
            value={loading ? '—' : timeSaved(docs.length)}
            sub="vs. manual data entry"
            accent="bg-amber-50 text-amber-600"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            }
          />
        </div>

        {/* Recent documents table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent Documents</h2>
            <Link to="/documents" className="text-sm text-[#0066FF] hover:underline font-medium">
              View all
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Date', 'Vendor', 'Category', 'Amount', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                      No documents yet.{' '}
                      <Link to="/documents" className="text-[#0066FF] hover:underline">
                        Upload your first one →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  recent.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{docDate(doc)}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 max-w-[180px] truncate">
                        {docVendor(doc)}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{docCategory(doc)}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 tabular-nums whitespace-nowrap">
                        {docTotal(doc) > 0 ? fmt(docTotal(doc)) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={doc.extraction_status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
