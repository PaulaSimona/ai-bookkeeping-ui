// t2/HeroStatCard — the dark-navy headline figure (§14 14-B restyle, s22 B1).
// A navy @theme surface with a soft radial primary glow (a blurred primary
// disc — not a hex gradient) and a mono figure. Presentational only; added for
// the dashboard's Cash-on-hand hero rather than editing the shipped t2/StatCard.
// Zero hex: navy / primary / mono come from the @theme tokens; everything else
// is Tailwind's white+opacity and neutral scales.
import { type FC } from 'react';

interface HeroStatCardProps {
  label: string;
  value: string;
  sub?: string;
}

export const HeroStatCard: FC<HeroStatCardProps> = ({ label, value, sub }) => (
  <div className="relative overflow-hidden rounded-2xl bg-[var(--color-navy)] p-6 shadow-sm">
    {/* Radial primary glow — a blurred, token-colored primary disc. */}
    <div
      aria-hidden
      className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-25 blur-3xl"
    />
    <div className="relative">
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-white/60">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-semibold text-white font-[var(--font-family-mono)]">
        {value}
      </div>
      {sub && <div className="mt-1 text-[13px] text-white/50">{sub}</div>}
    </div>
  </div>
);
