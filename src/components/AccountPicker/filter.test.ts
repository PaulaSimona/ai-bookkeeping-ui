// Option logic of the AccountPicker (D-S84-6, D-S85-3).
import { describe, expect, it } from 'vitest';
import type { CurrentAccount, PickerAccount } from '@/types/account';
import {
  accountLabel,
  buildOptions,
  dedupeById,
  defaultHighlightKey,
  matchesQuery,
} from './filter';

const acct = (
  code: string,
  name: string,
  type: PickerAccount['type'],
): PickerAccount => ({
  id: `id-${code}`,
  org_id: 'org-1',
  code,
  name,
  type,
  is_active: true,
});

// Deliberately out of order, and holding both 2110 and 21100 so a code that is
// a prefix of a longer code is always in play.
const ACCOUNTS: PickerAccount[] = [
  acct('5000', 'Rent Expense', 'expense'),
  acct('2110', 'Credit Card Payable', 'liability'),
  acct('1000', 'Cash', 'asset'),
  acct('4000', 'Sales Revenue', 'revenue'),
  acct('21100', 'Visa Card Payable', 'liability'),
  acct('3000', 'Owner Equity', 'equity'),
  acct('2100', 'Accounts Payable', 'liability'),
  acct('1200', 'Accounts Receivable', 'asset'),
  acct('2200', 'Sales Tax Payable', 'liability'),
  acct('5100', 'Office Supplies', 'expense'),
];

const codes = (query: string, extra: Partial<Parameters<typeof buildOptions>[0]> = {}) =>
  buildOptions({ accounts: ACCOUNTS, query, ...extra }).options.map(
    (o) => o.account.code,
  );

describe('accountLabel', () => {
  it('is "code — name" with an em dash', () => {
    expect(accountLabel({ code: '2110', name: 'Credit Card Payable' })).toBe(
      '2110 — Credit Card Payable',
    );
  });
});

describe('code-prefix queries', () => {
  it('narrows with each of the prefixes 2, 21 and 2110', () => {
    expect(codes('2')).toEqual(['2100', '2110', '21100', '2200']);
    expect(codes('21')).toEqual(['2100', '2110', '21100']);
    expect(codes('2110')).toEqual(['2110', '21100']);
  });

  it('matches a digits-only query at the START of the code only', () => {
    expect(codes('110')).toEqual([]);
    expect(codes('100')).toEqual(['1000']);
  });

  it('never matches a digits-only query against the name', () => {
    const k401 = { code: '6000', name: '401k Match' };
    expect(matchesQuery(k401, '401')).toBe(false);
    expect(matchesQuery(k401, '401k')).toBe(true);
  });

  it('ignores surrounding spaces and treats an empty query as "everything"', () => {
    expect(codes('  21  ')).toEqual(['2100', '2110', '21100']);
    expect(codes('')).toHaveLength(ACCOUNTS.length);
    expect(codes('   ')).toHaveLength(ACCOUNTS.length);
  });
});

describe('name queries', () => {
  it('matches a name fragment case-insensitively', () => {
    expect(codes('rent')).toEqual(['5000']);
    expect(codes('RENT')).toEqual(['5000']);
    expect(codes('ReN')).toEqual(['5000']);
    expect(codes('payable')).toEqual(['2100', '2110', '21100', '2200']);
  });

  it('returns nothing for a fragment no account has', () => {
    expect(codes('zzz')).toEqual([]);
  });
});

describe('grouping and order', () => {
  it('groups by type in the order asset, liability, equity, revenue, expense', () => {
    const { groups } = buildOptions({ accounts: ACCOUNTS, query: '' });
    expect(groups.map((g) => g.label)).toEqual([
      'Assets',
      'Liabilities',
      'Equity',
      'Revenue',
      'Expenses',
    ]);
  });

  it('orders by code within a group and labels every option "code — name"', () => {
    const { groups } = buildOptions({ accounts: ACCOUNTS, query: '' });
    expect(groups.map((g) => g.options.map((o) => o.label))).toEqual([
      ['1000 — Cash', '1200 — Accounts Receivable'],
      [
        '2100 — Accounts Payable',
        '2110 — Credit Card Payable',
        '21100 — Visa Card Payable',
        '2200 — Sales Tax Payable',
      ],
      ['3000 — Owner Equity'],
      ['4000 — Sales Revenue'],
      ['5000 — Rent Expense', '5100 — Office Supplies'],
    ]);
  });

  it('leaves out a group that has no match', () => {
    const { groups } = buildOptions({ accounts: ACCOUNTS, query: '21' });
    expect(groups.map((g) => g.label)).toEqual(['Liabilities']);
  });

  it('still offers an account whose type is none of the five', () => {
    const odd = { ...acct('9000', 'Suspense', 'asset'), type: 'memo' } as unknown as PickerAccount;
    const { groups } = buildOptions({ accounts: [...ACCOUNTS, odd], query: '' });
    expect(groups[groups.length - 1].label).toBe('Other');
    expect(groups[groups.length - 1].options.map((o) => o.account.code)).toEqual(['9000']);
  });
});

describe('highlighting', () => {
  it('highlights an exact code first, ahead of a longer code it prefixes', () => {
    const built = buildOptions({ accounts: ACCOUNTS, query: '2110' });
    expect(built.exact?.account.code).toBe('2110');
    expect(defaultHighlightKey(built, '2110', null)).toBe('id-2110');
  });

  it('highlights the exact code even when it is not the first option listed', () => {
    // An ASSET that shares the prefix sorts into an earlier group.
    const accounts = [...ACCOUNTS, acct('21109', 'Prepaid Card Float', 'asset')];
    const built = buildOptions({ accounts, query: '2110' });
    expect(built.options.map((o) => o.account.code)).toEqual(['21109', '2110', '21100']);
    expect(defaultHighlightKey(built, '2110', null)).toBe('id-2110');
  });

  it('highlights the first match while a query that is not an exact code is typed', () => {
    const built = buildOptions({ accounts: ACCOUNTS, query: '21' });
    expect(built.exact).toBeNull();
    expect(defaultHighlightKey(built, '21', 'id-5000')).toBe('id-2100');
  });

  it('highlights the current value when there is no query, else nothing', () => {
    const built = buildOptions({ accounts: ACCOUNTS, query: '' });
    expect(defaultHighlightKey(built, '', 'id-4000')).toBe('id-4000');
    expect(defaultHighlightKey(built, '', null)).toBeNull();
    expect(defaultHighlightKey(built, '', 'id-not-listed')).toBeNull();
  });

  it('highlights nothing when nothing matches', () => {
    const built = buildOptions({ accounts: ACCOUNTS, query: 'zzz' });
    expect(defaultHighlightKey(built, 'zzz', 'id-4000')).toBeNull();
  });
});

describe('narrowing the candidates', () => {
  it('keeps only the allowed types', () => {
    expect(codes('', { allowedTypes: ['revenue'] })).toEqual(['4000']);
    expect(codes('', { allowedTypes: ['liability', 'equity'] })).toEqual([
      '2100',
      '2110',
      '21100',
      '2200',
      '3000',
    ]);
  });

  it('applies the site predicate', () => {
    expect(
      codes('', { allowedTypes: ['liability'], filter: (a) => !a.code.startsWith('22') }),
    ).toEqual(['2100', '2110', '21100']);
  });
});

describe('duplicates', () => {
  it('dedupes by id, first occurrence winning', () => {
    const twice = [acct('1000', 'Cash', 'asset'), acct('1000', 'Cash (again)', 'asset')];
    expect(dedupeById(twice)).toEqual([twice[0]]);
  });

  it('shows an account once when it arrives both flat and as a child of its parent', () => {
    // What a caller would hand over if it flattened `children` on top of the
    // already-flat list: 1010 twice.
    const parent = acct('1000', 'Cash', 'asset');
    const child = acct('1010', 'Chequing', 'asset');
    const built = buildOptions({ accounts: [parent, child, child], query: '' });
    expect(built.options.map((o) => o.account.code)).toEqual(['1000', '1010']);
  });
});

describe('currentAccount', () => {
  const inactive: CurrentAccount = { id: 'id-1999', code: '1999', name: 'Old Clearing' };

  it('adds a value the list does not hold as a trailing "Current" option', () => {
    const { groups, options } = buildOptions({
      accounts: ACCOUNTS,
      query: '',
      currentAccount: inactive,
    });
    expect(groups[groups.length - 1].label).toBe('Current');
    expect(options[options.length - 1].label).toBe('1999 — Old Clearing');
  });

  it('adds nothing when the list already holds it', () => {
    const { groups } = buildOptions({
      accounts: ACCOUNTS,
      query: '',
      currentAccount: { id: 'id-1000', code: '1000', name: 'Cash' },
    });
    expect(groups.map((g) => g.label)).not.toContain('Current');
  });

  it('keeps it selectable when it is outside the allowed types', () => {
    const built = buildOptions({
      accounts: ACCOUNTS,
      query: '',
      allowedTypes: ['revenue'],
      currentAccount: { id: 'id-1000', code: '1000', name: 'Cash' },
    });
    expect(built.options.map((o) => o.account.code)).toEqual(['4000', '1000']);
  });

  it('is subject to the query like any other option', () => {
    expect(codes('19', { currentAccount: inactive })).toEqual(['1999']);
    expect(codes('rent', { currentAccount: inactive })).toEqual(['5000']);
  });
});
