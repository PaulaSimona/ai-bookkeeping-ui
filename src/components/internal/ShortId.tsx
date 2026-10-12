import { type FC } from 'react';

// An id on screen: its first eight characters, the whole id kept in the title.
// Always monospace; `className` is the colour and size the place it sits in
// wants. Shared by the plan previews, the bank-rows screen and the card change
// dialog (N-S87-6).
export const ShortId: FC<{ id: string; className?: string }> = ({ id, className }) => (
  <span title={id} className={className ? `font-mono ${className}` : 'font-mono'}>
    {id.slice(0, 8)}
  </span>
);
