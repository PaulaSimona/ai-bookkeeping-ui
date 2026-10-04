// Option logic for the AccountPicker (D-S84-6, D-S85-3). Pure: no React, no
// network. Which accounts show, in what order, under which group, and which
// one starts highlighted are all decided here so they can be tested directly.
import type {
  AccountType,
  CurrentAccount,
  PickerAccount,
} from '@/types/account';

export const TYPE_ORDER: AccountType[] = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
];

export const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

// Groups that sit after the five account types.
const OTHER_GROUP = 'other';
const CURRENT_GROUP = 'current';

export interface PickerOption {
  key: string; // the account id — unique within one option list
  account: PickerAccount | CurrentAccount;
  label: string;
}

export interface OptionGroup {
  key: string;
  label: string;
  options: PickerOption[];
}

export interface BuiltOptions {
  groups: OptionGroup[];
  // Every option in display order. Group headers are NOT in this list, which
  // is what makes arrow-key movement skip them.
  options: PickerOption[];
  // The option whose code equals the query, if there is one.
  exact: PickerOption | null;
}

export interface BuildOptionsInput {
  accounts: PickerAccount[];
  query: string;
  allowedTypes?: AccountType[];
  filter?: (account: PickerAccount) => boolean;
  currentAccount?: CurrentAccount | null;
}

// The one label format: code — name (em dash).
export const accountLabel = (a: { code: string; name: string }): string =>
  `${a.code} — ${a.name}`;

// First occurrence wins. The list endpoints return a child account both as its
// own row and nested under its parent; a caller that merged the two would hand
// the same id in twice, and it must still show once.
export const dedupeById = <T extends { id: string }>(rows: T[]): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
};

const DIGITS_ONLY = /^\d+$/;

// A digits-only query is a code PREFIX (2, 21, 2110). Anything else matches
// case-insensitively anywhere in the label, which covers a name fragment and a
// fragment of a non-numeric code alike. An empty query matches everything.
export const matchesQuery = (
  a: { code: string; name: string },
  query: string,
): boolean => {
  const q = query.trim();
  if (!q) return true;
  if (DIGITS_ONLY.test(q)) return a.code.startsWith(q);
  return accountLabel(a).toLowerCase().includes(q.toLowerCase());
};

export const isExactCode = (a: { code: string }, query: string): boolean => {
  const q = query.trim();
  return q !== '' && a.code.toLowerCase() === q.toLowerCase();
};

const byCode = (
  a: { code: string; name: string },
  b: { code: string; name: string },
): number => a.code.localeCompare(b.code) || a.name.localeCompare(b.name);

const toOption = (account: PickerAccount | CurrentAccount): PickerOption => ({
  key: account.id,
  account,
  label: accountLabel(account),
});

export const buildOptions = ({
  accounts,
  query,
  allowedTypes,
  filter,
  currentAccount,
}: BuildOptionsInput): BuiltOptions => {
  const candidates = dedupeById(accounts).filter(
    (a) =>
      (!allowedTypes || allowedTypes.includes(a.type)) &&
      (!filter || filter(a)),
  );
  const matched = candidates.filter((a) => matchesQuery(a, query));

  const groups: OptionGroup[] = [];
  for (const type of TYPE_ORDER) {
    const rows = matched.filter((a) => a.type === type).sort(byCode);
    if (rows.length) {
      groups.push({
        key: type,
        label: TYPE_LABELS[type],
        options: rows.map(toOption),
      });
    }
  }

  // An account whose type is none of the five is still offered — dropping it
  // would silently shorten the list.
  const other = matched.filter((a) => !TYPE_ORDER.includes(a.type)).sort(byCode);
  if (other.length) {
    groups.push({
      key: OTHER_GROUP,
      label: 'Other',
      options: other.map(toOption),
    });
  }

  // The current value, when the candidate list does not hold it (inactive, or
  // outside the allowed types): shown in its own trailing group, selectable.
  if (
    currentAccount &&
    !candidates.some((a) => a.id === currentAccount.id) &&
    matchesQuery(currentAccount, query)
  ) {
    groups.push({
      key: CURRENT_GROUP,
      label: 'Current',
      options: [toOption(currentAccount)],
    });
  }

  const options = groups.flatMap((g) => g.options);
  const exact = options.find((o) => isExactCode(o.account, query)) ?? null;
  return { groups, options, exact };
};

// Which option starts highlighted before the user moves with the arrow keys:
//   • an exact code match always (D-S85-3) — highlighted, never committed;
//   • otherwise, while a query is typed, the first match;
//   • with no query, the current value if it is in the list, else nothing —
//     so a stray Enter on an untouched field cannot pick the first account.
export const defaultHighlightKey = (
  built: BuiltOptions,
  query: string,
  selectedKey: string | null,
): string | null => {
  if (built.exact) return built.exact.key;
  if (query.trim()) return built.options[0]?.key ?? null;
  if (selectedKey !== null && built.options.some((o) => o.key === selectedKey)) {
    return selectedKey;
  }
  return null;
};
