// Money as decimal strings (S98 P1d item 9). An amount typed on a staff
// screen is validated and normalised as TEXT and sent as a string: it is never
// a JS float on its way to the server, and the server is the only source of
// totals, tax credits and entry lines.
//
// The one piece of arithmetic here is `enteredVsTarget`: a DISPLAY-ONLY hint in
// integer cents. Its result is shown beside the form and is never sent.

// A non-negative amount with at most two decimals: "12", "12.5", "12.50".
export const MONEY_STRING_RE = /^\d+(\.\d{1,2})?$/;

export const isMoneyString = (raw: string): boolean => MONEY_STRING_RE.test(raw.trim());

/**
 * "12.5" → "12.50", "7" → "7.00", "007.1" → "7.10". String operations only.
 * null when the text is not a valid amount — the caller keeps what was typed.
 */
export const normaliseMoneyString = (raw: string): string | null => {
  const text = raw.trim();
  if (!MONEY_STRING_RE.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const trimmed = whole.replace(/^0+(?=\d)/, '');
  return `${trimmed}.${(fraction + '00').slice(0, 2)}`;
};

// A valid amount above zero ("0", "0.0" and "0.00" are not).
export const isPositiveMoneyString = (raw: string): boolean => {
  const normalised = normaliseMoneyString(raw);
  return normalised !== null && /[1-9]/.test(normalised);
};

/**
 * Integer cents of a VALID amount string, for the display-only hint. null for
 * text that is not an amount and for an amount too large to hold exactly.
 */
export const moneyStringToCents = (raw: string): number | null => {
  const normalised = normaliseMoneyString(raw);
  if (normalised === null) return null;
  const [whole, fraction] = normalised.split('.');
  // At most 13 whole digits keeps whole * 100 + cents inside the safe range
  // before any arithmetic happens.
  if (whole.length > 13) return null;
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction, 10);
  return Number.isSafeInteger(cents) ? cents : null;
};

// Integer cents back to a 2-dp string, by string operations on the integer.
export const centsToMoneyString = (cents: number): string | null => {
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  const digits = String(cents).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
};

export interface EnteredVsTarget {
  entered: string; // the sum of the entered amounts, 2 dp
  target: string; // the amount they are compared with, 2 dp
  matches: boolean;
}

/**
 * The "entered vs target" hint: the sum of the entered amounts beside the
 * amount they should come to. DISPLAY ONLY — never sent, never a gate; the
 * server's dry run decides. null as soon as any amount is not valid or a sum
 * would leave the safe-integer range, so a hint is never shown from a guess.
 */
export const enteredVsTarget = (amounts: string[], target: string): EnteredVsTarget | null => {
  const targetCents = moneyStringToCents(target);
  if (targetCents === null) return null;
  let sum = 0;
  for (const amount of amounts) {
    const cents = moneyStringToCents(amount);
    if (cents === null) return null;
    sum += cents;
    if (!Number.isSafeInteger(sum)) return null;
  }
  const entered = centsToMoneyString(sum);
  const targetText = centsToMoneyString(targetCents);
  if (entered === null || targetText === null) return null;
  return { entered, target: targetText, matches: sum === targetCents };
};
