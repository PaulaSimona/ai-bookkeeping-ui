// t2/StatusBadge — pill badge (§14, D-14C2-13). Variants mirror the ledger
// badge severity language (neutral/info/success/warning/danger) with
// token-tinted bg+text pairs from Tailwind's palette. Presentational only.
import { type FC, type ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const VARIANT: Record<BadgeVariant, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
};

interface StatusBadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ variant = 'neutral', children }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${VARIANT[variant]}`}
  >
    {children}
  </span>
);
