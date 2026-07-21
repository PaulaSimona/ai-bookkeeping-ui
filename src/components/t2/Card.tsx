// t2/Card — Tier 2 light surface (§14, D-14C2-11/-13, O-14C-3). Presentational
// only: no data, no routing, no store. Brand colours come from the @theme CSS
// vars; structural neutrals use Tailwind's gray scale (no hex literals here).
import { type FC, type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean; // opt-in inner padding (StatCard and simple panels use it)
}

export const Card: FC<CardProps> = ({ children, className = '', padding = false }) => (
  <div
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${
      padding ? 'p-6' : ''
    } ${className}`}
  >
    {children}
  </div>
);
