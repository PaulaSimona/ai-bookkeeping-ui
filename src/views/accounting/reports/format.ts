// Display-only formatting shared by the Reports page and its drill-down
// (S68 E3). The backend two-decimal STRINGS stay the source of truth; Number()
// only hands a numeric to the locale formatter. Negatives read naturally
// (-$50.00); no red/green — sign does not imply status (calm).
export const fmtMoney = (s: string | null | undefined): string => {
  if (s == null || s === '') return '';
  const n = Number(s);
  if (Number.isNaN(n)) return `$${s}`;
  const abs = Math.abs(n).toLocaleString('en-CA', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

export const MONO = 'font-[var(--font-family-mono)] tabular-nums';
