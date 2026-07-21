// t2/StatCard — labelled headline figure, built on t2/Card (§14, D-14C2-13).
// Value renders in the mono @theme font. `tone` colours the label only, using
// the same severity language as the ledger badges. Presentational only.
import { type FC } from 'react';
import { Card } from './Card';

type StatTone = 'default' | 'success' | 'warning' | 'danger';

const TONE: Record<StatTone, string> = {
  default: 'text-gray-500',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

interface StatCardProps {
  label: string;
  value: string;
  tone?: StatTone;
}

export const StatCard: FC<StatCardProps> = ({ label, value, tone = 'default' }) => (
  <Card padding>
    <div className={`text-[11.5px] font-semibold uppercase tracking-wider ${TONE[tone]}`}>
      {label}
    </div>
    <div className="mt-1.5 text-[19px] font-semibold text-gray-900 font-[var(--font-family-mono)]">
      {value}
    </div>
  </Card>
);
