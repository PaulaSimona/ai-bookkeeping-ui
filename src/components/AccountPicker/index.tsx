// AccountPicker (D-S84-6, D-S85-3) — the one shared GL-account chooser, meant
// to replace the per-screen <select> dropdowns. Presentational: it is handed
// the account list (see hooks/useAllAccounts) and never touches the network.
//
// Behaviour, in one place:
//   • Typing filters: a digits-only query is a code prefix, anything else
//     matches the label. Options are grouped by account type and labelled
//     "code — name". The option logic is in ./filter.
//   • ArrowDown / ArrowUp move through the options; group headers are skipped.
//   • Enter commits the highlighted option and ALWAYS swallows the key, so it
//     can never submit a surrounding <form>.
//   • An exact code is highlighted but never committed by itself. Tab commits
//     it; Tab on anything else commits nothing.
//   • Escape closes an open list and stops there; with the list closed it
//     propagates, so a parent's own Escape handling still runs.
//   • Leaving the field without committing restores the last committed value.
//     Typed text is never emitted as a value.
//
// The option list is portalled to <body> and fixed-positioned against the
// input, because several call sites sit inside scrolling tables and modals
// that would clip an in-flow popup.
import {
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  AccountType,
  CurrentAccount,
  PickerAccount,
} from '@/types/account';
import { buildOptions, defaultHighlightKey } from './filter';

type Tone = 'light' | 'dark';

// A field needs an accessible name: either a visible label rendered here, or
// an aria-label when the screen supplies its own (a table header, say).
type Labelling =
  | { label: string; ariaLabel?: undefined }
  | { label?: undefined; ariaLabel: string };

export type AccountPickerProps = Labelling & {
  id: string;
  // '' means nothing chosen. Otherwise the account's id — or its code when
  // valueKey is 'code'.
  value: string;
  onChange: (
    value: string,
    account: PickerAccount | CurrentAccount | null,
  ) => void;
  accounts: PickerAccount[];
  loading?: boolean;
  error?: string | null;
  valueKey?: 'id' | 'code';
  allowedTypes?: AccountType[];
  filter?: (account: PickerAccount) => boolean;
  // The current value when the list may not hold it (an inactive account on
  // an existing line). It is displayed and stays selectable.
  currentAccount?: CurrentAccount | null;
  disabled?: boolean;
  required?: boolean;
  // Adds a first row that sets the value back to ''. Its text is `placeholder`.
  clearable?: boolean;
  placeholder?: string;
  tone?: Tone;
};

// Every class below is already in use on a neighbouring screen: dark is the
// internal console's field (RejectCorrectEditor inputCls), light is the Tier 2
// form field (AdjustmentForm inputCls).
const TONES: Record<Tone, Record<string, string>> = {
  dark: {
    label: 'block text-xs font-medium text-white/60 mb-1',
    star: 'text-red-400',
    input:
      'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
      'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF] disabled:opacity-50',
    status: 'mt-1 text-xs text-white/40',
    error: 'mt-1 text-xs text-red-300',
    list: 'rounded-lg border border-white/10 bg-[#0A1628] p-1 shadow-2xl overflow-y-auto',
    header:
      'px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/40',
    option: 'cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-white/70',
    optionActive:
      'cursor-pointer rounded-md px-2.5 py-1.5 text-sm bg-white/10 text-white',
    empty: 'px-2.5 py-1.5 text-xs text-white/40',
  },
  light: {
    label: 'mb-1.5 block text-sm font-medium text-gray-700',
    star: 'text-red-500',
    input:
      'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
      'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent ' +
      'transition disabled:bg-gray-50 disabled:text-gray-400',
    status: 'mt-1 text-xs text-gray-500',
    error: 'mt-1 text-xs text-red-600',
    list: 'rounded-lg border border-gray-200 bg-white p-1 shadow-2xl overflow-y-auto',
    header:
      'px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500',
    option: 'cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-gray-700',
    optionActive:
      'cursor-pointer rounded-md px-2.5 py-1.5 text-sm bg-gray-100 text-gray-900',
    empty: 'px-2.5 py-1.5 text-xs text-gray-500',
  },
};

// The "set back to nothing" row. Not an account id, so it cannot collide.
const CLEAR_KEY = '__clear__';

// Popup geometry, in px.
const GAP = 4;
const EDGE = 8;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 288;
// Above the app's modals (z-50) and toasts (z-[100]).
const Z_INDEX = 1000;

export const AccountPicker: FC<AccountPickerProps> = ({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  accounts,
  loading = false,
  error = null,
  valueKey = 'id',
  allowedTypes,
  filter,
  currentAccount = null,
  disabled = false,
  required = false,
  clearable = false,
  placeholder,
  tone = 'light',
}) => {
  const t = TONES[tone];
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  // null = not editing: the field shows the committed value's label.
  const [query, setQuery] = useState<string | null>(null);
  // The option the user moved to (arrows / hover). null = use the default.
  const [movedKey, setMovedKey] = useState<string | null>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  // Every selectable option, unfiltered — resolves the committed value.
  const all = useMemo(
    () =>
      buildOptions({ accounts, query: '', allowedTypes, filter, currentAccount }),
    [accounts, allowedTypes, filter, currentAccount],
  );
  const typed = query ?? '';
  const hasQuery = typed.trim() !== '';
  const built = useMemo(
    () =>
      hasQuery
        ? buildOptions({
            accounts,
            query: typed,
            allowedTypes,
            filter,
            currentAccount,
          })
        : all,
    [hasQuery, typed, all, accounts, allowedTypes, filter, currentAccount],
  );

  const selected =
    value === ''
      ? null
      : (all.options.find((o) => o.account[valueKey] === value) ?? null);

  const showClear = clearable && !hasQuery;
  const navKeys = useMemo(
    () => [
      ...(showClear ? [CLEAR_KEY] : []),
      ...built.options.map((o) => o.key),
    ],
    [showClear, built],
  );

  const defaultKey = defaultHighlightKey(built, typed, selected?.key ?? null);
  const activeKey =
    movedKey !== null && navKeys.includes(movedKey) ? movedKey : defaultKey;

  // With an error there is no trustworthy list, so nothing is offered. While
  // the first load is in flight there is nothing to show yet either.
  const blocked = disabled || !!error;
  const isOpen = open && !blocked && !(loading && navKeys.length === 0);

  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const optionId = (key: string) => `${id}-opt-${key}`;

  const close = useCallback(() => {
    setOpen(false);
    setQuery(null);
    setMovedKey(null);
  }, []);

  const commit = (key: string) => {
    if (key === CLEAR_KEY) {
      if (value !== '') onChange('', null);
    } else {
      const option = built.options.find((o) => o.key === key);
      if (option) {
        const next = option.account[valueKey];
        if (next !== value) onChange(next, option.account);
      }
    }
    close();
  };

  // While not editing, keep the whole label selected in a focused field, so
  // the next keystroke replaces it instead of appending to it.
  const selectedLabel = selected?.label ?? '';
  useEffect(() => {
    const el = inputRef.current;
    if (query === null && el && document.activeElement === el) el.select();
  }, [query, selectedLabel]);

  // Fixed-position the list against the input: below it, or above when the
  // space below is too short. Recomputed on any scroll (capture phase, so a
  // scrolling table or modal counts) and on a viewport size change.
  const reposition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const openUp = below < MIN_HEIGHT && above > below;
    const width = Math.min(
      Math.max(rect.width, MIN_WIDTH),
      window.innerWidth - 2 * EDGE,
    );
    const left = Math.max(
      EDGE,
      Math.min(rect.left, window.innerWidth - width - EDGE),
    );
    const maxHeight = Math.max(
      MIN_HEIGHT,
      Math.min(MAX_HEIGHT, openUp ? above : below),
    );
    setPosition({
      position: 'fixed',
      zIndex: Z_INDEX,
      left,
      width,
      maxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, reposition]);

  // A press outside both the field and the list closes it, uncommitted.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen, close]);

  // Keep the highlighted option in view while moving through a long list.
  useEffect(() => {
    if (!isOpen || activeKey === null) return;
    const el = document.getElementById(`${id}-opt-${activeKey}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, activeKey, id]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        if (blocked) return;
        const last = navKeys.length - 1;
        const down = e.key === 'ArrowDown';
        if (!isOpen) {
          // Opening keeps the current value highlighted; with none, the
          // first option (ArrowDown) or the last (ArrowUp).
          setOpen(true);
          if (activeKey === null && last >= 0) {
            setMovedKey(navKeys[down ? 0 : last]);
          }
          return;
        }
        if (last < 0) return;
        const at = activeKey === null ? -1 : navKeys.indexOf(activeKey);
        const next =
          at === -1
            ? down
              ? 0
              : last
            : Math.max(0, Math.min(last, at + (down ? 1 : -1)));
        setMovedKey(navKeys[next]);
        return;
      }
      case 'Enter':
        // Swallowed unconditionally — list open or closed, option or none —
        // so Enter in this field can never submit a surrounding form.
        e.preventDefault();
        if (isOpen && activeKey !== null && !e.nativeEvent.isComposing) {
          commit(activeKey);
        }
        return;
      case 'Tab':
        // Commits only an exact code that is still the highlighted option.
        // Anything else is left uncommitted; focus moves on regardless and
        // leaving the field restores the previous value.
        if (
          isOpen &&
          query !== null &&
          built.exact !== null &&
          activeKey === built.exact.key
        ) {
          commit(built.exact.key);
        }
        return;
      case 'Escape':
        // Open: close the list and stop here. Closed: let it propagate (the
        // posted-correction editor closes itself on Escape).
        if (isOpen) {
          e.stopPropagation();
          close();
        }
        return;
    }
  };

  const renderOption = (key: string, text: string) => {
    const active = key === activeKey;
    return (
      <div
        key={key}
        id={optionId(key)}
        role="option"
        aria-selected={active}
        className={active ? t.optionActive : t.option}
        onMouseEnter={() => setMovedKey(key)}
        onClick={() => commit(key)}
      >
        {text}
      </div>
    );
  };

  return (
    <div ref={wrapRef}>
      {label && (
        <label htmlFor={id} className={t.label}>
          {label}
          {required && <span className={t.star}> *</span>}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && activeKey !== null ? optionId(activeKey) : undefined
        }
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={query ?? selectedLabel}
        className={t.input}
        onChange={(e) => {
          setQuery(e.target.value);
          setMovedKey(null);
          setOpen(true);
        }}
        onFocus={(e) => {
          if (query === null) e.currentTarget.select();
        }}
        onClick={(e) => {
          if (blocked) return;
          // A click places the caret after focus has selected the label, so
          // select it again unless the user is already editing a query.
          if (query === null) e.currentTarget.select();
          setOpen(true);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      {loading && !error && (
        <p role="status" className={t.status}>
          Loading accounts…
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={t.error}>
          {error}
        </p>
      )}
      {isOpen &&
        position &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label ?? ariaLabel}
            style={position}
            className={t.list}
            // Keep focus in the input while the list is pressed, so a click
            // on an option is not preceded by the field losing focus.
            onMouseDown={(e) => e.preventDefault()}
          >
            {showClear && renderOption(CLEAR_KEY, placeholder ?? 'None')}
            {built.groups.map((group) => (
              <div
                key={group.key}
                role="group"
                aria-labelledby={`${id}-grp-${group.key}`}
              >
                <div
                  id={`${id}-grp-${group.key}`}
                  role="presentation"
                  className={t.header}
                >
                  {group.label}
                </div>
                {group.options.map((o) => renderOption(o.key, o.label))}
              </div>
            ))}
            {navKeys.length === 0 && (
              <div className={t.empty}>No matching accounts</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
