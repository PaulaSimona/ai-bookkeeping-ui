import { type FC, useEffect, useState } from 'react';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Doc {
  id: number;
  created_at: string;
  extraction_status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ─── Icons ────────────────────────────────────────────────────────────────────

const DownloadIcon: FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const SpreadsheetIcon: FC = () => (
  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m7.5-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m13.5-9.75h-7.5c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h7.5c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125z" />
  </svg>
);

// ─── Workbook page ────────────────────────────────────────────────────────────

export const Workbook: FC = () => {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState('');

  useEffect(() => {
    api
      .get('/api/documents/')
      .then((res) => { if (Array.isArray(res?.data)) setDocs(res.data); })
      .finally(() => setLoadingDocs(false));
  }, []);

  // Docs for the selected year
  const yearDocs = docs.filter((d) => new Date(d.created_at).getFullYear() === year);
  const isEmpty = yearDocs.length === 0;

  // Unique months with entries
  const activeMonths = [
    ...new Set(yearDocs.map((d) => new Date(d.created_at).getMonth())),
  ].sort((a, b) => a - b);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadErr('');
    try {
      const res = await api.get(`/api/documents/workbook/?year=${year}`, {
        responseType: 'blob',
      } as any);

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookkeeping-${year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadErr('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Available years: 2023 → current
  const years = Array.from(
    { length: CURRENT_YEAR - 2022 },
    (_, i) => CURRENT_YEAR - i,
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto px-8 py-8 max-w-3xl">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Workbook</h1>
          <p className="mt-1 text-sm text-gray-500">
            Download your annual bookkeeping workbook as an Excel file.
          </p>
        </div>

        {/* Explanation card */}
        <div className="flex gap-4 bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-5 mb-6">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <SpreadsheetIcon />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Master workbook</p>
            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
              Your master workbook is an Excel file with one tab per month and a
              Year Summary tab, updated automatically every time you upload a document.
              Download it at any time to review your expenses in Excel.
            </p>
          </div>
        </div>

        {/* Year selector + stats */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Select year</h2>
            <div className="flex gap-1.5">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    y === year
                      ? 'bg-[#0066FF] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Documents</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {loadingDocs ? '—' : yearDocs.length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Months active</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {loadingDocs ? '—' : activeMonths.length}
              </p>
              {activeMonths.length > 0 && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {activeMonths.map((m) => MONTH_NAMES[m]).join(', ')}
                </p>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Workbook tabs</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {loadingDocs ? '—' : activeMonths.length + (activeMonths.length > 0 ? 1 : 0)}
              </p>
              {activeMonths.length > 0 && (
                <p className="mt-0.5 text-xs text-gray-400">+ Year Summary</p>
              )}
            </div>
          </div>

          {/* Empty state note */}
          {!loadingDocs && isEmpty && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-amber-700">
                No documents for {year} yet — upload your first receipt to populate the workbook.
                You can still download an empty workbook with headers.
              </p>
            </div>
          )}
        </div>

        {/* Download section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                bookkeeping-{year}.xlsx
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isEmpty
                  ? 'Header-only workbook — ready for your first upload'
                  : `${yearDocs.length} document${yearDocs.length !== 1 ? 's' : ''} · ${activeMonths.length} month${activeMonths.length !== 1 ? 's' : ''} of data`}
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Downloading…
                </>
              ) : (
                <>
                  <DownloadIcon />
                  Download Excel
                </>
              )}
            </button>
          </div>

          {downloadErr && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">
              {downloadErr}
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
