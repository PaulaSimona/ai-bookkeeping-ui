// EntryChain (UI2-U1, O-S84-1): order, the current marker, the truncated note
// and the link to the live entry.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatIsoDate } from '@/utils/dates';
import { type ChainMember } from '@/utils/entryStatus';
import { EntryChain } from './EntryChain';

// JE-0068 was corrected by JE-0102, which JE-0110 corrected again: the chain as
// the registry sends it, in entry-number order.
const CHAIN: ChainMember[] = [
  { id: 'e-68', number: 'JE-0068', date: '2026-09-30', role: 'original', display_status: 'corrected' },
  { id: 'e-102', number: 'JE-0102', date: '2026-10-02', role: 'correction', display_status: 'corrected' },
  { id: 'e-110', number: 'JE-0110', date: '2026-10-03', role: 'correction', display_status: 'posted' },
];
const LIVE = { id: 'e-110', number: 'JE-0110' };

// A reversed entry, its reversal, and the restore that reversed the reversal.
const RESTORED: ChainMember[] = [
  { id: 'e-70', number: 'JE-0070', date: '2026-09-01', role: 'original', display_status: 'posted' },
  { id: 'e-71', number: 'JE-0071', date: '2026-09-02', role: 'reversal', display_status: 'reversal' },
  { id: 'e-72', number: 'JE-0072', date: '2026-09-03', role: 'restore', display_status: 'reversal' },
];

const rows = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('EntryChain', () => {
  it('lists every entry of the chain in the order the server sent', () => {
    render(<EntryChain chain={CHAIN} currentId="e-68" liveEntry={LIVE} />);

    const items = rows();
    expect(items).toHaveLength(3);
    expect(items.map((li) => within(li).getByText(/^JE-\d{4}$/).textContent)).toEqual([
      'JE-0068',
      'JE-0102',
      'JE-0110',
    ]);
    // Each row shows its date, its role and its status.
    expect(items[0]).toHaveTextContent(formatIsoDate('2026-09-30'));
    expect(items[0]).toHaveTextContent('Original');
    expect(items[0]).toHaveTextContent('Corrected');
    expect(items[1]).toHaveTextContent('Correction');
    expect(items[1]).toHaveTextContent('Corrected');
    expect(items[2]).toHaveTextContent('Correction');
    expect(items[2]).toHaveTextContent('Posted');
  });

  it('does not reorder the chain', () => {
    // The server owns the order; a chain handed over in another order stays so.
    render(<EntryChain chain={[...CHAIN].reverse()} currentId="e-68" liveEntry={LIVE} />);
    expect(rows().map((li) => within(li).getByText(/^JE-\d{4}$/).textContent)).toEqual([
      'JE-0110',
      'JE-0102',
      'JE-0068',
    ]);
  });

  it('names the roles reversal and restore', () => {
    render(<EntryChain chain={RESTORED} currentId="e-70" liveEntry={{ id: 'e-70', number: 'JE-0070' }} />);
    const items = rows();
    expect(items[1]).toHaveTextContent('Reversal');
    expect(items[2]).toHaveTextContent('Restore');
    // A reversal's status is "Reversal" as well — it is said once, not twice.
    expect(within(items[1]).getAllByText('Reversal')).toHaveLength(1);
  });

  it('marks the current entry, and only it', () => {
    render(<EntryChain chain={CHAIN} currentId="e-102" liveEntry={LIVE} />);

    const items = rows();
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(items[1]).toHaveTextContent('This entry');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[2]).not.toHaveAttribute('aria-current');
    expect(screen.getAllByText('This entry')).toHaveLength(1);
  });

  it('tags the live entry', () => {
    render(<EntryChain chain={CHAIN} currentId="e-68" liveEntry={LIVE} />);
    const items = rows();
    expect(within(items[2]).getByText('Live')).toBeInTheDocument();
    expect(screen.getAllByText('Live')).toHaveLength(1);
  });

  it('shows the truncated note only when the chain was cut short', () => {
    const { rerender } = render(<EntryChain chain={CHAIN} currentId="e-68" liveEntry={null} truncated />);
    expect(screen.getByRole('note')).toHaveTextContent('This chain is longer than what is shown here.');
    // A cut chain has no known live entry; that is not reported as "none".
    expect(screen.queryByText('This chain has no live entry.')).not.toBeInTheDocument();

    rerender(<EntryChain chain={CHAIN} currentId="e-68" liveEntry={LIVE} />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('opens the live entry through the handler', async () => {
    const onOpenEntry = vi.fn();
    render(<EntryChain chain={CHAIN} currentId="e-68" liveEntry={LIVE} onOpenEntry={onOpenEntry} />);

    expect(screen.getByText('The live entry is JE-0110.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open JE-0110' }));
    expect(onOpenEntry).toHaveBeenCalledTimes(1);
    expect(onOpenEntry).toHaveBeenCalledWith(LIVE);
  });

  it('offers no link when the current entry is the live one', () => {
    render(<EntryChain chain={CHAIN} currentId="e-110" liveEntry={LIVE} onOpenEntry={vi.fn()} />);
    expect(screen.getByText('This is the live entry.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('names the live entry without a button when no handler is given', () => {
    render(<EntryChain chain={CHAIN} currentId="e-68" liveEntry={LIVE} />);
    expect(screen.getByText('The live entry is JE-0110.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says so when the chain has no live entry', () => {
    const reversed: ChainMember[] = [
      { id: 'e-70', number: 'JE-0070', date: '2026-09-01', role: 'original', display_status: 'reversed' },
      { id: 'e-71', number: 'JE-0071', date: '2026-09-02', role: 'reversal', display_status: 'reversal' },
    ];
    render(<EntryChain chain={reversed} currentId="e-70" liveEntry={null} onOpenEntry={vi.fn()} />);
    expect(screen.getByText('This chain has no live entry.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing for an entry that was never corrected or reversed', () => {
    const lone: ChainMember[] = [
      { id: 'e-1', number: 'JE-0001', date: '2026-09-01', role: 'original', display_status: 'posted' },
    ];
    const { container, rerender } = render(
      <EntryChain chain={lone} currentId="e-1" liveEntry={{ id: 'e-1', number: 'JE-0001' }} />,
    );
    expect(container).toBeEmptyDOMElement();

    // …and for a payload that carries no chain at all (a write response).
    rerender(<EntryChain currentId="e-1" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<EntryChain chain={[]} currentId="e-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders in the staff console tone', () => {
    render(<EntryChain chain={CHAIN} currentId="e-68" liveEntry={LIVE} tone="dark" onOpenEntry={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Entry history' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open JE-0110' })).toBeInTheDocument();
  });
});
