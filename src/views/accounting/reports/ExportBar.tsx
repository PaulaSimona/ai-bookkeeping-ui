// ExportBar (S68 E4, O-S68-31) — Export PDF / Export Excel / Print for one
// report surface. Downloads go through useReportExport (blob via the shared api
// client — never an <a href> to the API); Print is window.print() against the
// scoped @media print block (index.css, `.reports-print`). Errors surface
// inline in the PeriodControls red-text pattern; the page banners stay untouched.
// The bar itself is `no-print` so it never appears on paper.
import { type FC, useState } from 'react';
import { type ReportPeriod } from '@/hooks/useReports';
import { type ExportFormat, type ExportKind, useReportExport } from '@/hooks/useReportExport';

const btnCls =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60';

export const ExportBar: FC<{ kind: ExportKind; period: ReportPeriod; code?: string }> = ({
  kind, period, code,
}) => {
  const { exportReport, busy } = useReportExport();
  const [error, setError] = useState<string | null>(null);

  const run = async (fmt: ExportFormat) => {
    setError(null);
    const r = await exportReport(kind, fmt, period, code);
    if (!r.ok) setError(r.message);
  };

  return (
    <div className="no-print flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnCls} disabled={busy !== null} onClick={() => run('pdf')}>
          {busy === 'pdf' ? 'Preparing…' : 'Export PDF'}
        </button>
        <button type="button" className={btnCls} disabled={busy !== null} onClick={() => run('xlsx')}>
          {busy === 'xlsx' ? 'Preparing…' : 'Export Excel'}
        </button>
        <button type="button" className={btnCls} onClick={() => window.print()}>
          Print
        </button>
      </div>
      {error && <span className="text-[12px] text-red-600">{error}</span>}
    </div>
  );
};
