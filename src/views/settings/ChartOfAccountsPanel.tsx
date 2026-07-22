// Chart of accounts tab (s24 U2 — O-S24-3 carry, D-S24-11). Reproduces the
// existing /accounts surface FIELD-FOR-FIELD (staff route stays untouched),
// restyled to the light sibling-tab visuals. Same data layer + payloads as the
// shipped page: useAccounts (GET /api/accounting/accounts/ + AccountFilters),
// useCreateAccount (POST accounts/create/ {code,name,type,normal_balance,
// parent_account_id?,is_active?}), useUpdateAccount (PATCH accounts/{id}/).
// Backend endpoint is require_tier2 + membership, so a Tier 2 owner calling it
// from Settings is legal — surfacing here IS the intended swap (trace flag
// resolved); the old RequireSuperuser route guard is unchanged.
import { type FC, useEffect, useMemo, useState } from 'react';
import {
  useAccounts,
  useOrgMe,
  useCreateAccount,
  useUpdateAccount,
  type Account,
  type AccountType,
  type NormalBalance,
  type CreateAccountPayload,
} from '@/hooks/useAccounts';
import { Card } from '@/components/t2/Card';
import { Spinner } from './ui';

// ─── Constants (identical semantics to the shipped page) ──────────────────────
const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', expense: 'Expenses',
};
const TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const TYPE_COLORS: Record<AccountType, string> = {
  asset:     'bg-blue-50 text-blue-700 border-blue-200',
  liability: 'bg-red-50 text-red-700 border-red-200',
  equity:    'bg-purple-50 text-purple-700 border-purple-200',
  revenue:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  expense:   'bg-amber-50 text-amber-700 border-amber-200',
};

const DEFAULT_NORMAL_BALANCE: Record<AccountType, NormalBalance> = {
  asset: 'debit', expense: 'debit', liability: 'credit', equity: 'credit', revenue: 'credit',
};

const control = (err?: boolean) =>
  `h-[42px] w-full rounded-lg border px-3.5 text-sm text-gray-900 placeholder:text-gray-400 transition ` +
  `focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] ` +
  `${err ? 'border-red-400' : 'border-gray-300'}`;

// ─── Badges ───────────────────────────────────────────────────────────────────
const TypeBadge: FC<{ type: AccountType }> = ({ type }) => (
  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TYPE_COLORS[type]}`}>
    {TYPE_LABELS[type].slice(0, -1)}
  </span>
);

const BalanceBadge: FC<{ balance: NormalBalance }> = ({ balance }) => (
  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
    balance === 'debit' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }`}>
    {balance}
  </span>
);

// ─── Account modal (light) ────────────────────────────────────────────────────
interface ModalProps {
  mode: 'create' | 'edit';
  initial?: Partial<Account>;
  accounts: Account[];
  onClose: () => void;
  onSave: (payload: CreateAccountPayload) => Promise<{ ok: boolean }>;
  isSubmitting: boolean;
  serverErrors: Record<string, string[]> | null;
}

const AccountModal: FC<ModalProps> = ({ mode, initial, accounts, onClose, onSave, isSubmitting, serverErrors }) => {
  const [code, setCode]                   = useState(initial?.code ?? '');
  const [name, setName]                   = useState(initial?.name ?? '');
  const [type, setType]                   = useState<AccountType>(initial?.type ?? 'expense');
  const [normalBalance, setNormalBalance] = useState<NormalBalance>(initial?.normal_balance ?? DEFAULT_NORMAL_BALANCE['expense']);
  const [parentId, setParentId]           = useState<string>(initial?.parent_account_id ?? '');
  const [isActive, setIsActive]           = useState(initial?.is_active ?? true);

  // Auto-set normal balance when type changes (identical to shipped page).
  useEffect(() => { setNormalBalance(DEFAULT_NORMAL_BALANCE[type]); }, [type]);

  const fieldError = (field: string) => serverErrors?.[field]?.[0] ?? serverErrors?.['detail']?.[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateAccountPayload = {
      code, name, type,
      normal_balance: normalBalance,
      parent_account_id: parentId || null,
      is_active: isActive,
    };
    const res = await onSave(payload);
    if (res.ok) onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-gray-100 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
            <h2 className="text-sm font-semibold text-gray-900">{mode === 'create' ? 'Add account' : 'Edit account'}</h2>
            <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-700" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {fieldError('detail') && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fieldError('detail')}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Code *</label>
                <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 5999" className={control(!!fieldError('code'))} />
                {fieldError('code') && <p className="mt-1 text-xs text-red-600">{fieldError('code')}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Name *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" className={control(!!fieldError('name'))} />
                {fieldError('name') && <p className="mt-1 text-xs text-red-600">{fieldError('name')}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={`${control()} bg-white`}>
                {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Normal balance</label>
              <div className="flex gap-4">
                {(['debit', 'credit'] as NormalBalance[]).map((b) => (
                  <label key={b} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="normal_balance" value={b} checked={normalBalance === b} onChange={() => setNormalBalance(b)} className="accent-[var(--color-primary)]" />
                    <span className="text-sm capitalize text-gray-700">{b}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Parent account</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={`${control()} bg-white`}>
                <option value="">— None (top-level) —</option>
                {accounts
                  .filter((a) => a.type === type && a.id !== initial?.id)
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>

            {mode === 'edit' && (
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)]" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
                {isSubmitting && <Spinner light />}
                {mode === 'create' ? 'Create account' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

// ─── Rows ─────────────────────────────────────────────────────────────────────
const SectionHeader: FC<{ type: AccountType; count: number; isOpen: boolean; onToggle: () => void }> = ({
  type, count, isOpen, onToggle,
}) => (
  <tr>
    <td colSpan={6}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50">
        <svg className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{TYPE_LABELS[type]}</span>
        <span className="text-xs text-gray-400">{count}</span>
      </button>
    </td>
  </tr>
);

const AccountRow: FC<{ account: Account; depth: number; canEdit: boolean; onEdit: (a: Account) => void }> = ({
  account, depth, canEdit, onEdit,
}) => (
  <tr className="group border-b border-gray-50 transition-colors hover:bg-gray-50">
    <td className="px-4 py-2.5"><span className="font-[var(--font-family-mono)] text-xs text-gray-500">{account.code}</span></td>
    <td className="px-4 py-2.5">
      <div className="flex items-center" style={{ paddingLeft: depth * 24 }}>
        {depth > 0 && <div className="mr-2 h-3.5 w-px shrink-0 bg-gray-200" />}
        <span className={`text-sm ${account.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{account.name}</span>
      </div>
    </td>
    <td className="px-4 py-2.5"><TypeBadge type={account.type} /></td>
    <td className="px-4 py-2.5"><BalanceBadge balance={account.normal_balance} /></td>
    <td className="px-4 py-2.5">
      <span className={`flex items-center gap-1.5 text-xs font-medium ${account.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${account.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
        {account.is_active ? 'Active' : 'Inactive'}
      </span>
    </td>
    <td className="w-10 px-4 py-2.5">
      {canEdit && (
        <button onClick={() => onEdit(account)} className="rounded p-1 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100" aria-label={`Edit ${account.name}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      )}
    </td>
  </tr>
);

// ─── Panel ────────────────────────────────────────────────────────────────────
export const ChartOfAccountsPanel: FC = () => {
  const { role } = useOrgMe();
  const canEdit = role === 'owner' || role === 'accountant';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState<AccountType | ''>('');
  const [openSections, setOpenSections] = useState<Set<AccountType>>(new Set(TYPE_ORDER));

  const [modalMode, setModalMode]   = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Account | null>(null);

  const { accounts, isLoading, error, refetch } = useAccounts(
    typeFilter || search ? { type: typeFilter || undefined, search: search || undefined } : undefined,
  );

  const { createAccount, isSubmitting: isCreating, errors: createErrors, clearErrors: clearCreate } = useCreateAccount(refetch);
  const { updateAccount, isSubmitting: isUpdating, errors: updateErrors, clearErrors: clearUpdate } = useUpdateAccount(editTarget?.id ?? '', refetch);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleSection = (type: AccountType) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const openCreate = () => { setEditTarget(null); clearCreate(); setModalMode('create'); };
  const openEdit = (account: Account) => { setEditTarget(account); clearUpdate(); setModalMode('edit'); };
  const closeModal = () => setModalMode(null);

  const depthMap = useMemo(() => {
    const map = new Map<string, number>();
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const getDepth = (a: Account): number => {
      if (!a.parent_account_id) return 0;
      const parent = byId.get(a.parent_account_id);
      if (!parent) return 1;
      return 1 + getDepth(parent);
    };
    accounts.forEach((a) => map.set(a.id, getDepth(a)));
    return map;
  }, [accounts]);

  const grouped = useMemo(() => {
    const g: Record<AccountType, Account[]> = { asset: [], liability: [], equity: [], revenue: [], expense: [] };
    accounts.forEach((a) => g[a.type].push(a));
    return g;
  }, [accounts]);

  const totalCount = accounts.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search code or name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-[42px] w-full rounded-lg border border-gray-300 pl-9 pr-3.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AccountType | '')}
          className="h-[42px] rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
        >
          <option value="">All types</option>
          {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>

        {canEdit && (
          <button
            onClick={openCreate}
            className="ml-auto inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add account
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button onClick={refetch} className="text-xs text-red-700 underline hover:text-red-800">Retry</button>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-24 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="w-28 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="w-24 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Balance</th>
                <th className="w-20 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {[130, 220, 80, 80, 60, 40].map((w, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3 animate-pulse rounded bg-gray-100" style={{ width: w }} /></td>
                  ))}
                </tr>
              ))}

              {!isLoading && !error && totalCount === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-400">
                    No accounts found.{' '}
                    {!search && !typeFilter
                      ? 'Your chart of accounts is seeded automatically when your organization is set up.'
                      : 'Try a different search or filter.'}
                  </td>
                </tr>
              )}

              {!isLoading && !error && TYPE_ORDER.map((type) => {
                const section = grouped[type];
                if (section.length === 0) return null;
                const isOpen = openSections.has(type);
                return (
                  <>
                    <SectionHeader key={`header-${type}`} type={type} count={section.length} isOpen={isOpen} onToggle={() => toggleSection(type)} />
                    {isOpen && section.map((acct) => (
                      <AccountRow key={acct.id} account={acct} depth={depthMap.get(acct.id) ?? 0} canEdit={canEdit} onEdit={openEdit} />
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {modalMode === 'create' && (
        <AccountModal mode="create" accounts={accounts} onClose={closeModal} onSave={createAccount} isSubmitting={isCreating} serverErrors={createErrors} />
      )}
      {modalMode === 'edit' && editTarget && (
        <AccountModal mode="edit" initial={editTarget} accounts={accounts} onClose={closeModal} onSave={(payload) => updateAccount(payload)} isSubmitting={isUpdating} serverErrors={updateErrors} />
      )}
    </div>
  );
};
