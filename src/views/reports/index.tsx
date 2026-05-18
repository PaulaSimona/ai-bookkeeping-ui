import { type FC, useEffect, useState } from 'react';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Doc { id: number; created_at: string; extraction_status: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const CA_PROVINCES = new Set(['ON','QC','NS','NB','MB','BC','PE','SK','AB','NL']);
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const downloadBlob = async (url: string, filename: string): Promise<void> => {
  const res = await api.get(url, { responseType: 'blob' } as any);
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};

// ─── Year pills ───────────────────────────────────────────────────────────────

const YearPills: FC<{ value: number; onChange: (y: number) => void }> = ({ value, onChange }) => (
  <div className="flex gap-1.5 flex-wrap">
    {YEARS.map((y) => (
      <button
        key={y}
        onClick={() => onChange(y)}
        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
          y === value ? 'bg-[#0066FF] text-white' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {y}
      </button>
    ))}
  </div>
);

// ─── Report card ──────────────────────────────────────────────────────────────

interface ReportCardProps {
  title: string;
  description: string;
  endpoint: string;
  filename: (year: number) => string;
  docsByYear: Record<number, number>;
  loadingDocs: boolean;
}

const ReportCard: FC<ReportCardProps> = ({
  title, description, endpoint, filename, docsByYear, loadingDocs,
}) => {
  const [year, setYear]           = useState(CURRENT_YEAR);
  const [downloading, setDown]    = useState(false);
  const [downloadErr, setErr]     = useState('');

  const docCount = docsByYear[year] ?? 0;
  const isEmpty  = !loadingDocs && docCount === 0;

  const handleDownload = async () => {
    setDown(true);
    setErr('');
    try {
      await downloadBlob(`${endpoint}?year=${year}`, filename(year));
    } catch {
      setErr('Download failed. Please try again.');
    } finally {
      setDown(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-5 space-y-5">
        {/* Year selector */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Year</p>
          <YearPills value={year} onChange={setYear} />
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-amber-700">
              No data for {year} yet — upload your first receipt to generate this report.
            </p>
          </div>
        )}

        {!isEmpty && !loadingDocs && (
          <p className="text-xs text-gray-400">
            Based on {docCount} document{docCount !== 1 ? 's' : ''} in {year}
          </p>
        )}

        {downloadErr && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{downloadErr}</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6">
        <button
          onClick={handleDownload}
          disabled={downloading || loadingDocs}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {downloading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Downloading…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download Excel
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Reports page ─────────────────────────────────────────────────────────────

export const Reports: FC = () => {
  const [docs, setDocs]           = useState<Doc[]>([]);
  const [loadingDocs, setLoading] = useState(true);
  const [isCanada, setIsCanada]   = useState(true); // default CA until profile loads

  // Load documents + profile in parallel
  useEffect(() => {
    api.get('/api/documents/').then((res) => {
      if (Array.isArray(res?.data)) setDocs(res.data);
    }).finally(() => setLoading(false));

    api.get('/api/user/profile').then((res) => {
      const province = res?.data?.company?.province ?? '';
      setIsCanada(CA_PROVINCES.has(province) || province === '');
    });
  }, []);

  // Map year → done-doc count
  const docsByYear = docs
    .filter((d) => d.extraction_status === 'done')
    .reduce<Record<number, number>>((acc, d) => {
      const y = new Date(d.created_at).getFullYear();
      acc[y] = (acc[y] ?? 0) + 1;
      return acc;
    }, {});

  const docCount = (year: number) => docsByYear[year] ?? 0;

  const taxTitle = isCanada
    ? 'GST/HST Input Tax Credit Summary'
    : 'Expense Deduction Summary';

  const taxDescription = isCanada
    ? 'Input tax credits claimable on your GST/HST return, broken down by document and reporting period.'
    : 'Deductible expenses organized by Schedule C category, ready for your US tax return.';

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto px-8 py-8">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generated on demand from your uploaded documents. Download as Excel at any time.
          </p>
        </div>

        {/* Report cards — side by side on md+, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <ReportCard
            title="Expense by Category"
            description="Total spending grouped by bookkeeping category for the year, with deductibility flags highlighted."
            endpoint="/api/reports/expense-summary/"
            filename={(y) => `expense-by-category-${y}.xlsx`}
            docsByYear={docsByYear}
            loadingDocs={loadingDocs}
          />
          <ReportCard
            title={taxTitle}
            description={taxDescription}
            endpoint="/api/reports/tax-summary/"
            filename={(y) => `tax-summary-${y}.xlsx`}
            docsByYear={docsByYear}
            loadingDocs={loadingDocs}
          />
        </div>

      </div>
    </div>
  );
};
