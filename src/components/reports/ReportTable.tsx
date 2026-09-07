// ReportTable (S69 E5-UI, O-S69-15) — the coded-row list of a P&L / Balance
// Sheet section, lifted VERBATIM out of Reports.tsx (the rows that became
// drill-down <Link>s in O-S68-30). Pure/presentational: the drill target is
// injected via `accountHref`, so the owner page points rows at its own
// /accounting/reports/account/:code URL and a staff page can point them
// elsewhere without a second copy of the row markup. Optional: with no
// `accountHref` every row renders static (the pre-O-S68-30 shape).
import { type FC } from 'react';
import { Link } from 'react-router-dom';

import { type ReportRow } from '@/hooks/useReports';
import { fmtMoney, MONO } from '@/views/accounting/reports/format';

const Chevron: FC = () => (
  <svg
    className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

export const ReportTable: FC<{ rows: ReportRow[]; accountHref?: (code: string) => string }> = ({
  rows, accountHref: linkTo,
}) =>
  rows.length === 0 ? (
    <div className="py-2 text-[13px] text-gray-400">No activity in this period.</div>
  ) : (
    <>
      {rows.map((r) =>
        // Coded rows drill into the account ledger (O-S68-30); the computed
        // Current-year-earnings row has code=null → name only, static.
        r.code !== null && linkTo ? (
          <Link
            key={r.code}
            to={linkTo(r.code)}
            className="group flex cursor-pointer items-center justify-between py-1.5"
          >
            <span className="text-[14px] text-gray-700">{r.name}</span>
            <span className="flex items-center gap-2">
              <span className={`text-[14px] text-gray-900 ${MONO}`}>{fmtMoney(r.amount)}</span>
              <Chevron />
            </span>
          </Link>
        ) : (
          <div key={r.code ?? r.name} className="flex items-center justify-between py-1.5">
            <span className="text-[14px] text-gray-700">{r.name}</span>
            <span className={`text-[14px] text-gray-900 ${MONO}`}>{fmtMoney(r.amount)}</span>
          </div>
        ),
      )}
    </>
  );
