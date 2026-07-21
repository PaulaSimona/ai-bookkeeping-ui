// Taxes page (§14 14-C-3 B5, O-14C3-1/-2/-3) — the Tier 2 owner's GST/HST
// position from the tax-summary endpoint (seam 33). Own data layer (useReports);
// presentational bits from src/components/t2 only. Tokens only — no hex, no dark
// gradient (O-14C-3). Two shapes: unregistered (calm one-liner, no zeros) and
// registered (net-owing hero + collected/ITC split + optional next-filing card).
import { type FC, type ReactNode } from 'react';

import { Card } from '@/components/t2/Card';
import { PageHeader } from '@/components/t2/PageHeader';
import { StatusBadge } from '@/components/t2/StatusBadge';
import { useTaxSummary, type TaxSummaryRegistered } from '@/hooks/useReports';

const fmtMoney = (s: string): string => {
  const n = Number(s);
  if (Number.isNaN(n)) return `$${s}`;
  const abs = Math.abs(n).toLocaleString('en-CA', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

const MONO = 'font-[var(--font-family-mono)] tabular-nums';

const StateNote: FC<{ children: ReactNode; tone?: 'muted' | 'error' }> = ({
  children, tone = 'muted',
}) => (
  <div className={`text-[13.5px] ${tone === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
    {children}
  </div>
);

// Display-only: whole days from local today to the (date-only) ISO deadline.
const daysAway = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

const dueLabel = (days: number): string =>
  days > 0 ? `${days} days away` : days === 0 ? 'Due today' : `${-days} days overdue`;

const dueTone = (days: number): 'neutral' | 'warning' | 'danger' =>
  days < 0 ? 'danger' : days <= 14 ? 'warning' : 'neutral';

const RegisteredTaxes: FC<{ data: TaxSummaryRegistered }> = ({ data }) => {
  const period = data.period;
  return (
    <div className="space-y-6">
      {/* Net-owing hero — house Card + tokens (no prototype gradient). */}
      <Card padding className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
            Net GST/HST owing
          </span>
          {period && <StatusBadge variant="info">{period.period_label}</StatusBadge>}
        </div>
        <div className={`text-[34px] font-semibold text-gray-900 ${MONO}`}>
          {fmtMoney(data.net)}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] text-gray-600">
          <span>
            Collected on sales{' '}
            <span className={`text-gray-900 ${MONO}`}>{fmtMoney(data.collected)}</span>
          </span>
          <span>
            Input tax credits{' '}
            <span className={`text-gray-900 ${MONO}`}>−{fmtMoney(data.itc)}</span>
          </span>
        </div>
      </Card>

      {/* Next filing — only when a period AND a deadline are present. */}
      {period && period.deadline && (
        <Card padding className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
              Next filing due
            </div>
            <div className="mt-1 text-[16px] font-medium text-gray-900">
              {fmtDate(period.deadline)}
            </div>
          </div>
          <StatusBadge variant={dueTone(daysAway(period.deadline))}>
            {dueLabel(daysAway(period.deadline))}
          </StatusBadge>
        </Card>
      )}
    </div>
  );
};

export const Taxes: FC = () => {
  const { data, isLoading, error } = useTaxSummary();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <PageHeader
          title="Taxes"
          subtitle={
            data && !error && data.registered
              ? "What you've collected and what you can claim back."
              : undefined
          }
        />

        {isLoading && <Card padding><StateNote>Loading…</StateNote></Card>}
        {error && <Card padding><StateNote tone="error">{error}</StateNote></Card>}

        {data && !error && !data.registered && (
          <Card padding>
            <p className="text-[14.5px] text-gray-600">
              This business isn't registered for GST/HST, so there's nothing owing to
              track here.
            </p>
          </Card>
        )}

        {data && !error && data.registered && <RegisteredTaxes data={data} />}
      </div>
    </div>
  );
};
