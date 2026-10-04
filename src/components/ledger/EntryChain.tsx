// EntryChain (UI2-U1, O-S84-1) — the story of one entry: the original and every
// entry that later corrected, reversed or restored it, in the order the registry
// sends them (entry-number order). The entry being looked at is marked, and the
// chain's LIVE entry — the one the books currently stand on — gets an "Open"
// button when it is a different entry.
//
// Display only: nothing here derives a chain. It renders `chain`, `live_entry`
// and `chain_truncated` exactly as the server resolved them
// (accounting/ledger_chain.py resolve_chains). An entry that was never
// corrected or reversed is a chain of one and has no story to tell, so nothing
// renders for it.
import { type FC } from 'react';
import { formatIsoDate } from '@/utils/dates';
import { entryStatusLabel, type ChainMember, type EntryRef } from '@/utils/entryStatus';

export interface EntryChainProps {
  chain?: ChainMember[];
  // The entry this panel belongs to.
  currentId: string;
  liveEntry?: EntryRef | null;
  truncated?: boolean;
  // Opens another entry of the chain. Absent → the live entry is named but not
  // linked.
  onOpenEntry?: (entry: EntryRef) => void;
  // light = the owner and accountant surfaces; dark = the staff console.
  tone?: 'light' | 'dark';
  // Spacing from the host (the panel renders nothing for a chain of one, so
  // the margin belongs on the panel itself, not on a wrapper).
  className?: string;
}

const ROLE_LABELS: Record<string, string> = {
  original: 'Original',
  correction: 'Correction',
  reversal: 'Reversal',
  restore: 'Restore',
};

const humanize = (value: string): string => {
  const text = value.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
};

const roleLabel = (role: string): string => ROLE_LABELS[role] ?? humanize(role);

// The chain date is a calendar date; anything else is shown as sent.
const memberDate = (iso: string): string => {
  try {
    return formatIsoDate(iso);
  } catch {
    return iso;
  }
};

const TONES = {
  light: {
    box: 'rounded-xl border border-gray-100 bg-white',
    title: 'border-b border-gray-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400',
    row: 'flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-50 px-4 py-2 text-[13px] text-gray-700',
    current: 'bg-gray-50',
    number: 'font-[var(--font-family-mono)] tabular-nums font-semibold text-gray-900',
    muted: 'text-gray-500',
    tag: 'rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600',
    liveTag: 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700',
    foot: 'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-[12.5px] text-gray-600',
    button:
      'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50',
  },
  dark: {
    box: 'rounded-lg border border-white/10 bg-white/[0.02]',
    title: 'border-b border-white/10 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-white/30',
    row: 'flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/5 px-3 py-2 text-sm text-white/70',
    current: 'bg-white/5',
    number: 'font-mono font-semibold text-white/90',
    muted: 'text-white/50',
    tag: 'rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70',
    liveTag: 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300',
    foot: 'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm text-white/60',
    button:
      'rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/5',
  },
} as const;

export const EntryChain: FC<EntryChainProps> = ({
  chain, currentId, liveEntry = null, truncated = false, onOpenEntry, tone = 'light',
  className = '',
}) => {
  if (!chain || chain.length === 0) return null;
  if (chain.length === 1 && !truncated) return null;

  const t = TONES[tone];
  const currentIsLive = liveEntry != null && liveEntry.id === currentId;
  const liveNumber = liveEntry?.number ?? 'the live entry';

  return (
    <section aria-label="Entry history" className={`${t.box} ${className}`}>
      <div className={t.title}>Entry history</div>
      <ol>
        {chain.map((member) => {
          const isCurrent = member.id === currentId;
          const isLive = liveEntry != null && member.id === liveEntry.id;
          const role = roleLabel(member.role);
          const status = entryStatusLabel({
            status: member.display_status,
            display_status: member.display_status,
          });
          return (
            <li
              key={member.id}
              aria-current={isCurrent ? 'true' : undefined}
              className={`${t.row} ${isCurrent ? t.current : ''}`}
            >
              <span className={t.number}>{member.number ?? '—'}</span>
              <span className={t.muted}>{memberDate(member.date)}</span>
              <span>{role}</span>
              {/* A reversal entry's status is "Reversal" too — said once. */}
              {status !== role && <span className={t.muted}>{status}</span>}
              {isLive && <span className={t.liveTag}>Live</span>}
              {isCurrent && <span className={t.tag}>This entry</span>}
            </li>
          );
        })}
      </ol>
      <div className={t.foot}>
        {truncated && (
          <span role="note">This chain is longer than what is shown here.</span>
        )}
        {liveEntry == null ? (
          // Reversed and not restored — or cut short, which the note above says.
          !truncated && <span>This chain has no live entry.</span>
        ) : currentIsLive ? (
          <span>This is the live entry.</span>
        ) : (
          <>
            <span>The live entry is {liveNumber}.</span>
            {onOpenEntry && (
              <button type="button" onClick={() => onOpenEntry(liveEntry)} className={t.button}>
                Open {liveNumber}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
};
