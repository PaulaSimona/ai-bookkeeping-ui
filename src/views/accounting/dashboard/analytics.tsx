// Page-local dashboard analytics widgets (§14 14-C-4 U1, D-S23-1/2/4/6/8).
// PAGE-LOCAL to the Tier 2 dashboard — NOT shared t2/ components (the shipped
// t2/ set is edit-forbidden). Presentation only: brand tokens + Tailwind
// palette utilities, zero hex, no chart library (hand-built divs/SVG). No
// red/green semantic coloring tied to sign — In/Out bar colours are CATEGORICAL
// direction markers (the shipped FlowCard convention), not profit/loss sign.
import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/t2/Card';
import type {
  CashFlowMonth,
  DashboardAttention,
  RecentActivityRow,
} from '@/hooks/useDashboardSummary';

const MONO = 'font-[var(--font-family-mono)]';

// Presentation geometry ONLY: maps a two-decimal money STRING to a pixel height
// / sparkline point. No financial figure is derived, displayed, or persisted
// from this (D-S23: no financial math in the client) — the ledger and reports
// remain the source of truth. Non-numeric input coalesces to 0.
const toNum = (s: string): number => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// ── Sparkline: net (inflow−outflow) per month, baseline-rendered, neutral. ────
const SPARK_W = 140;
const SPARK_H = 40;

const Sparkline: FC<{ values: number[] }> = ({ values }) => {
  const n = values.length;
  if (n === 0) return null;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const x = (i: number) => (n === 1 ? SPARK_W / 2 : (i / (n - 1)) * SPARK_W);
  const y = (v: number) => SPARK_H - ((v - min) / range) * SPARK_H;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const baselineY = y(0).toFixed(1); // net = 0 reference line

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="h-10 w-full text-white/70"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="0" y1={baselineY} x2={SPARK_W} y2={baselineY}
        className="text-white/25" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3"
      />
      <polyline
        points={points} fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
      />
    </svg>
  );
};

// ── Hero cash card: navy hero (mirrors the t2/HeroStatCard look, which stays
// untouched) + net sparkline + optional connected-accounts line. ─────────────
export const HeroCashCard: FC<{
  label: string;
  value: string;
  months: CashFlowMonth[];
  connectedAccounts: number;
}> = ({ label, value, months, connectedAccounts }) => {
  const netSeries = months.map((m) => toNum(m.inflow) - toNum(m.outflow));
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--color-navy)] p-6 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-25 blur-3xl"
      />
      <div className="relative">
        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
        <div className={`mt-2 text-[28px] font-semibold text-white ${MONO}`}>{value}</div>
        {connectedAccounts > 0 && (
          <div className="mt-1 text-[13px] text-white/50">
            Across {connectedAccounts} connected account{connectedAccounts === 1 ? '' : 's'}
          </div>
        )}
        <div className="mt-3">
          <Sparkline values={netSeries} />
        </div>
      </div>
    </div>
  );
};

// ── Cash-flow chart: 6 months, In/Out bar pairs, client-normalized heights. ──
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const monthLabel = (ym: string): string => {
  const m = Number(ym.slice(5, 7));
  return MONTH_ABBR[m - 1] ?? ym;
};

const BAR_MAX_PX = 96;

export const CashFlowChartCard: FC<{ months: CashFlowMonth[] }> = ({ months }) => {
  const ins = months.map((m) => toNum(m.inflow));
  const outs = months.map((m) => toNum(m.outflow));
  const peak = Math.max(0, ...ins, ...outs);
  const allZero = peak === 0;
  const h = (v: number) => (allZero ? 0 : Math.round((v / peak) * BAR_MAX_PX));

  return (
    <Card padding>
      <div className="flex items-center justify-between">
        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
          Cash flow · last 6 months
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden /> In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden /> Out
          </span>
        </div>
      </div>

      {/* Bars — normalized to the peak In/Out across the window (presentation). */}
      <div className="mt-5 flex items-end gap-2" style={{ height: BAR_MAX_PX }}>
        {months.map((m) => (
          <div
            key={m.month}
            className="flex flex-1 items-end justify-center gap-1"
            style={{ height: BAR_MAX_PX }}
          >
            <div className="w-3 rounded-t bg-emerald-500" style={{ height: h(toNum(m.inflow)) }} aria-hidden />
            <div className="w-3 rounded-t bg-amber-500" style={{ height: h(toNum(m.outflow)) }} aria-hidden />
          </div>
        ))}
      </div>

      {/* Month labels — aligned to the same 6 equal columns. */}
      <div className="mt-2 flex gap-2">
        {months.map((m) => (
          <div key={m.month} className="flex-1 text-center text-[11px] text-gray-400">
            {monthLabel(m.month)}
          </div>
        ))}
      </div>

      {allZero && (
        <div className="mt-3 text-center text-[12.5px] text-gray-400">
          No cash activity in the last 6 months
        </div>
      )}
    </Card>
  );
};

// ── Needs-attention: only surfaces items with a positive count; all-zero is a
// calm one-liner (no empty red/amber chrome, D-S23-1). ───────────────────────
export const NeedsAttentionCard: FC<{ attention: DashboardAttention }> = ({ attention }) => {
  const items = [
    { count: attention.entries_needs_review, label: 'entries need review', to: '/accounting/ledger' },
    { count: attention.entries_unassigned, label: 'unassigned entries', to: '/accounting/ledger' },
    { count: attention.documents_processing, label: 'documents processing', to: '/accounting/documents' },
  ].filter((it) => it.count > 0);

  return (
    <Card padding>
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
        Needs attention
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-[13.5px] text-gray-400">Nothing needs your attention.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map((it) => (
            <li key={it.label}>
              <Link
                to={it.to}
                className="group -mx-2 flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
              >
                <span className="flex items-center gap-2.5 text-[13.5px] text-gray-700">
                  <span className={`inline-flex min-w-[22px] justify-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[12px] font-semibold text-gray-700 ${MONO}`}>
                    {it.count}
                  </span>
                  {it.label}
                </span>
                <span className="text-[13px] text-[var(--color-primary)] group-hover:underline">View</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

// ── Recent activity: ≤5 posted entries, newest first; quiet empty state. ─────
export const RecentActivityCard: FC<{
  rows: RecentActivityRow[];
  fmtAmount: (v: string) => string;
  fmtDate: (iso: string) => string;
}> = ({ rows, fmtAmount, fmtDate }) => (
  <Card padding>
    <div className="flex items-center justify-between">
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
        Recent activity
      </div>
      <Link to="/accounting/ledger" className="text-[13px] text-[var(--color-primary)] hover:underline">
        View ledger
      </Link>
    </div>
    {rows.length === 0 ? (
      <p className="mt-3 text-[13.5px] text-gray-400">No recent activity yet.</p>
    ) : (
      <ul className="mt-3 divide-y divide-gray-50">
        {rows.map((r) => (
          <li key={r.entry_number} className="flex items-center gap-3 py-2.5">
            <span className={`shrink-0 text-[12px] text-gray-400 ${MONO}`}>#{r.entry_number}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] text-gray-800">{r.description}</div>
              <div className="text-[12px] text-gray-400">{fmtDate(r.entry_date)}</div>
            </div>
            <span className={`shrink-0 text-[13.5px] text-gray-900 ${MONO}`}>{fmtAmount(r.amount)}</span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);
