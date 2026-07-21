// t2/AvatarChip — small initials block for counterparty identity (§14,
// D-14C2-13). Tint pairs come from Tailwind's palette (blue/red/green).
// Presentational only.
import { type FC } from 'react';

type AvatarTint = 'blue' | 'red' | 'green';

const TINT: Record<AvatarTint, string> = {
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-700',
  green: 'bg-emerald-50 text-emerald-700',
};

interface AvatarChipProps {
  initials: string;
  tint?: AvatarTint;
}

export const AvatarChip: FC<AvatarChipProps> = ({ initials, tint = 'blue' }) => (
  <span
    className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[13px] font-semibold ${TINT[tint]}`}
  >
    {initials}
  </span>
);
