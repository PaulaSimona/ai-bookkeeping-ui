// Money helpers (S98 P1d item 9): string in, string out; the one integer-cents
// hint and its safe-integer guard.
import { describe, expect, it } from 'vitest';
import {
  MONEY_STRING_RE,
  centsToMoneyString,
  enteredVsTarget,
  isMoneyString,
  isPositiveMoneyString,
  moneyStringToCents,
  normaliseMoneyString,
} from './moneyString';

describe('validating an amount', () => {
  it('is the pattern of the fence: digits, then at most two decimals', () => {
    expect(MONEY_STRING_RE.source).toBe('^\\d+(\\.\\d{1,2})?$');
  });

  it.each(['0', '7', '12.5', '12.50', '1000000.01', ' 12.50 '])('accepts %j', (text) => {
    expect(isMoneyString(text)).toBe(true);
  });

  it.each(['', ' ', '.5', '12.', '12.345', '-1', '+1', '1e3', '1,000.00', '12.5.0', 'abc', 'NaN', '0x10'])(
    'refuses %j',
    (text) => {
      expect(isMoneyString(text)).toBe(false);
      expect(normaliseMoneyString(text)).toBeNull();
      expect(moneyStringToCents(text)).toBeNull();
    },
  );
});

describe('normalising to two decimals', () => {
  it.each([
    ['7', '7.00'],
    ['12.5', '12.50'],
    ['12.50', '12.50'],
    [' 3.07 ', '3.07'],
    ['007.1', '7.10'],
    ['0', '0.00'],
    ['000', '0.00'],
    ['0.5', '0.50'],
  ])('%j → %j', (text, expected) => {
    const result = normaliseMoneyString(text);
    expect(result).toBe(expected);
    expect(typeof result).toBe('string');
  });

  it('keeps every digit of an amount no float could hold', () => {
    // 2^53 is 9007199254740992: a float would lose the last digits.
    expect(normaliseMoneyString('90071992547409935.1')).toBe('90071992547409935.10');
    expect(normaliseMoneyString('0.1')).toBe('0.10');
    expect(normaliseMoneyString('1234567890123456789012345678.99')).toBe(
      '1234567890123456789012345678.99',
    );
  });
});

describe('an amount above zero', () => {
  it.each(['0.01', '1', '10.00'])('%j is positive', (text) => {
    expect(isPositiveMoneyString(text)).toBe(true);
  });

  it.each(['0', '0.0', '0.00', '000', '', 'abc', '-5'])('%j is not', (text) => {
    expect(isPositiveMoneyString(text)).toBe(false);
  });
});

describe('integer cents, for the display-only hint', () => {
  it('reads cents without a float: 0.1 + 0.2 is 30 cents', () => {
    expect(moneyStringToCents('0.1')).toBe(10);
    expect(moneyStringToCents('0.2')).toBe(20);
    expect(moneyStringToCents('1.1')).toBe(110);
    expect(moneyStringToCents('19.99')).toBe(1999);
    expect(enteredVsTarget(['0.1', '0.2'], '0.3')).toEqual({
      entered: '0.30',
      target: '0.30',
      matches: true,
    });
  });

  it('the safe-integer guard: an amount too large to hold exactly is no hint at all', () => {
    expect(moneyStringToCents('9999999999999.99')).toBe(999999999999999);
    expect(moneyStringToCents('99999999999999.99')).toBeNull();
    expect(moneyStringToCents('90071992547409935.10')).toBeNull();
    expect(enteredVsTarget(['99999999999999.99'], '1.00')).toBeNull();
    expect(enteredVsTarget(['1.00'], '99999999999999.99')).toBeNull();
    expect(centsToMoneyString(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  it('a sum that leaves the safe range is no hint', () => {
    const big = '9999999999999.99';
    expect(enteredVsTarget(Array.from({ length: 10 }, () => big), '1.00')).toBeNull();
  });

  it('cents back to text', () => {
    expect(centsToMoneyString(0)).toBe('0.00');
    expect(centsToMoneyString(5)).toBe('0.05');
    expect(centsToMoneyString(1999)).toBe('19.99');
    expect(centsToMoneyString(11300)).toBe('113.00');
    expect(centsToMoneyString(-1)).toBeNull();
    expect(centsToMoneyString(1.5)).toBeNull();
  });
});

describe('entered vs target', () => {
  it('says when the entered lines come to the target, and when they do not', () => {
    expect(enteredVsTarget(['100.00', '13.00'], '113.00')).toEqual({
      entered: '113.00',
      target: '113.00',
      matches: true,
    });
    expect(enteredVsTarget(['100', '12.5'], '113.00')).toEqual({
      entered: '112.50',
      target: '113.00',
      matches: false,
    });
  });

  it('is silent while any amount is not valid', () => {
    expect(enteredVsTarget(['100.00', ''], '113.00')).toBeNull();
    expect(enteredVsTarget(['100.00', '1.234'], '113.00')).toBeNull();
    expect(enteredVsTarget(['100.00'], 'n/a')).toBeNull();
  });

  it('with no lines the entered sum is zero', () => {
    expect(enteredVsTarget([], '5.00')).toEqual({ entered: '0.00', target: '5.00', matches: false });
  });
});
