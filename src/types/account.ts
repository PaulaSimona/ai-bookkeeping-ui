// Shared account shapes for the AccountPicker and its loaders (D-S84-6).
// AccountType is re-exported from its existing definition, not redefined. The
// picker reads only the six fields below: it never reads `children`, because
// the list endpoints already return every account as its own flat row.
import type { AccountType } from '@/hooks/useAccounts';

export type { AccountType };

export interface PickerAccount {
  id: string;
  org_id: string;
  code: string;
  name: string;
  type: AccountType;
  is_active: boolean;
}

// A value the picker must still show although it is absent from the loaded
// list — e.g. an inactive account on an existing entry line. A site only holds
// that line's id / code / name, so the remaining fields are optional.
export type CurrentAccount = Pick<PickerAccount, 'id' | 'code' | 'name'> &
  Partial<Pick<PickerAccount, 'org_id' | 'type' | 'is_active'>>;
