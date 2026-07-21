// t2/FilterChip — toggle chip (§14, D-14C2-13). Active = navy @theme fill,
// white text; inactive = white with a hairline border and muted text.
// Presentational only — the caller owns the toggle state.
import { type FC, type ReactNode } from 'react';

interface FilterChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export const FilterChip: FC<FilterChipProps> = ({ active = false, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-8 rounded-lg px-3 text-[13px] font-medium transition-colors ${
      active
        ? 'bg-[var(--color-navy)] text-white'
        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
);
