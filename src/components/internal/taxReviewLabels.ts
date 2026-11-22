import { humanizeCode } from '@/components/internal/ui';

// Staff words for the server's tax-condition kinds (S98 P1d). A kind this map
// does not know is shown humanized, never hidden.
const KIND_LABELS = new Map<string, string>([
  ['tax_unverified', 'Tax unverified'],
  ['tax_kind_not_recoverable', 'Tax kind not recoverable'],
  ['tax_unexplained_amount', 'Unexplained amount'],
]);

export const taxKindLabel = (kind: string): string => KIND_LABELS.get(kind) ?? humanizeCode(kind);

// money_in / money_out in words; anything else as the server sent it.
export const directionLabel = (direction: string): string => {
  if (direction === 'money_in') return 'Money in';
  if (direction === 'money_out') return 'Money out';
  return direction;
};
