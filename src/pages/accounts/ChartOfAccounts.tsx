import { type FC, useState, useMemo, useEffect } from 'react';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AccountType, string> = {
  asset:     'Assets',
  liability: 'Liabilities',
  equity:    'Equity',
  revenue:   'Revenue',
  expense:   'Expenses',
};
const TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const TYPE_COLORS: Record<AccountType, string> = {
  asset:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  liability: 'bg-red-500/10 text-red-400 border-red-500/20',
  equity:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  revenue:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  expense:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const DEFAULT_NORMAL_BALANCE: Record<AccountType, NormalBalance> = {
  asset:     'debit',
  expense:   'debit',
  liability: 'credit',
  equity:    'credit',
  revenue:   'credit',
};

// ─── Small shared components ───────────────────────────────────────────────────

const TypeBadge: FC<{ type: AccountType }> = ({ type }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${TYPE_COLORS[type]}`}>
    {TYPE_LABELS[type].slice(0, -1) /* strip plural s */}
  </span>
);

const BalanceBadge: FC<{ balance: NormalBalance }> = ({ balance }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
    balance === 'debit'
      ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
  }`}>
    {balance}
  </span>
);

const SkeletonRow: FC = () => (
  <tr className="border-b border-white/5">
    {[130, 220, 80, 80, 60, 40].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-3 rounded bg-white/8 animate-pulse" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

// ─── Account Modal ─────────────────────────────────────────────────────────────

interface ModalProps {
  mode: 'create' | 'edit';
  initial?: Partial<Account>;
  accounts: Account[];
  onClose: () => void;
  onSave: (payload: CreateAccountPayload) => Promise<{ ok: boolean }>;
  isSubmitting: boolean;
  serverErrors: Record<string, string[]> | null;
}

const AccountModal: FC<ModalProps> = ({
  mode, initial, accounts, onClose, onSave, isSubmitting, serverErrors,
}) => {
  const [code, setCode]                     = useState(initial?.code ?? '');
  const [name, setName]                     = useState(initial?.name ?? '');
  const [type, setType]                     = useState<AccountType>(initial?.type ?? 'expense');
  const [normalBalance, setNormalBalance]   = useState<NormalBalance>(
    initial?.normal_balance ?? DEFAULT_NORMAL_BALANCE['expense'],
  );
  const [parentId, setParentId]             = useState<string>(initial?.parent_account_id ?? '');
  const [isActive, setIsActive]             = useState(initial?.is_active ?? true);

  // Auto-set normal balance when type changes
  useEffect(() => {
    setNormalBalance(DEFAULT_NORMAL_BALANCE[type]);
  }, [type]);

  const fieldError = (field: string) => serverErrors?.[field]?.[0] ?? serverErrors?.['detail']?.[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateAccountPayload = {
      code,
      name,
      type,
      normal_balance: normalBalance,
      parent_account_id: parentId || null,
      is_active: isActive,
    };
    const res = await onSave(payload);
    if (res.ok) onClose();
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm bg-[#0f172a] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0066FF] transition ${
      fieldError(field) ? 'border-red-500/60' : 'border-white/15'
    }`;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-[#0A1628] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">
              {mode === 'create' ? 'Add Account' : 'Edit Account'}
            </h2>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {fieldError('detail') && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
                {fieldError('detail')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Code *</label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 5999"
                  className={inputClass('code')}
                />
                {fieldError('code') && <p className="mt-1 text-xs text-red-400">{fieldError('code')}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Account name"
                  className={inputClass('name')}
                />
                {fieldError('name') && <p className="mt-1 text-xs text-red-400">{fieldError('name')}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className={inputClass('type')}
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Normal Balance</label>
              <div className="flex gap-3">
                {(['debit', 'credit'] as NormalBalance[]).map((b) => (
                  <label key={b} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="normal_balance"
                      value={b}
                      checked={normalBalance === b}
                      onChange={() => setNormalBalance(b)}
                      className="text-[#0066FF] focus:ring-[#0066FF]"
                    />
                    <span className="text-sm text-white/70 capitalize">{b}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Parent Account</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className={inputClass('parent_account_id')}
              >
                <option value="">— None (top-level) —</option>
                {accounts
                  .filter((a) => a.type === type && a.id !== initial?.id)
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
              </select>
            </div>

            {mode === 'edit' && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 text-[#0066FF] focus:ring-[#0066FF]"
                />
                <span className="text-sm text-white/70">Active</span>
              </label>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {mode === 'create' ? 'Create Account' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

// ─── Section header ────────────────────────────────────────────────────────────

const SectionHeader: FC<{
  type: AccountType;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ type, count, isOpen, onToggle }) => (
  <tr>
    <td colSpan={6}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 text-white/40 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-widest text-white/50">
          {TYPE_LABELS[type]}
        </span>
        <span className="text-xs text-white/30">{count}</span>
      </button>
    </td>
  </tr>
);

// ─── Account row ───────────────────────────────────────────────────────────────

const AccountRow: FC<{
  account: Account;
  depth: number;
  canEdit: boolean;
  onEdit: (a: Account) => void;
}> = ({ account, depth, canEdit, onEdit }) => (
  <tr className="border-b border-white/5 hover:bg-white/2 transition-colors group">
    <td className="px-4 py-2.5">
      <span className="font-mono text-xs text-white/60">{account.code}</span>
    </td>
    <td className="px-4 py-2.5">
      <div className="flex items-center" style={{ paddingLeft: depth * 24 }}>
        {depth > 0 && (
          <div className="w-px h-3.5 bg-white/15 mr-2 shrink-0" />
        )}
        <span className={`text-sm ${account.is_active ? 'text-white' : 'text-white/30 line-through'}`}>
          {account.name}
        </span>
      </div>
    </td>
    <td className="px-4 py-2.5">
      <TypeBadge type={account.type} />
    </td>
    <td className="px-4 py-2.5">
      <BalanceBadge balance={account.normal_balance} />
    </td>
    <td className="px-4 py-2.5">
      <span className={`flex items-center gap-1.5 text-xs font-medium ${
        account.is_active ? 'text-emerald-400' : 'text-white/30'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${
          account.is_active ? 'bg-emerald-400' : 'bg-white/20'
        }`} />
        {account.is_active ? 'Active' : 'Inactive'}
      </span>
    </td>
    <td className="px-4 py-2.5 w-10">
      {canEdit && (
        <button
          onClick={() => onEdit(account)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-white hover:bg-white/8 transition-all"
          aria-label={`Edit ${account.name}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      )}
    </td>
  </tr>
);

// ─── Main page ─────────────────────────────────────────────────────────────────

export const ChartOfAccounts: FC = () => {
  const { orgName, role, isLoading: orgLoading } = useOrgMe();

  const [searchInput, setSearchInput]           = useState('');
  const [search, setSearch]                     = useState('');
  const [typeFilter, setTypeFilter]             = useState<AccountType | ''>('');
  const [openSections, setOpenSections]         = useState<Set<AccountType>>(
    new Set(TYPE_ORDER),
  );

  const [modalMode, setModalMode]               = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget]             = useState<Account | null>(null);

  const { accounts, isLoading, error, refetch } = useAccounts(
    typeFilter || search
      ? { type: typeFilter || undefined, search: search || undefined }
      : undefined,
  );

  const { createAccount, isSubmitting: isCreating, errors: createErrors, clearErrors: clearCreate } = useCreateAccount(refetch);
  const { updateAccount, isSubmitting: isUpdating, errors: updateErrors, clearErrors: clearUpdate } = useUpdateAccount(
    editTarget?.id ?? '',
    refetch,
  );

  const canEdit = role === 'owner' || role === 'accountant';

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleSection = (type: AccountType) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const openCreate = () => {
    setEditTarget(null);
    clearCreate();
    setModalMode('create');
  };

  const openEdit = (account: Account) => {
    setEditTarget(account);
    clearUpdate();
    setModalMode('edit');
  };

  const closeModal = () => setModalMode(null);

  // Build depth map: account id → depth
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

  // Group accounts by type
  const grouped = useMemo(() => {
    const g: Record<AccountType, Account[]> = {
      asset: [], liability: [], equity: [], revenue: [], expense: [],
    };
    accounts.forEach((a) => g[a.type].push(a));
    return g;
  }, [accounts]);

  const totalCount = accounts.length;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-white/50">
            {orgLoading ? 'Loading…' : orgName ?? ''}
            {!isLoading && totalCount > 0 && (
              <span className="ml-2 text-white/30">· {totalCount} accounts</span>
            )}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search code or name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#0A1628] pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0066FF] transition"
            />
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AccountType | '')}
            className="rounded-lg border border-white/15 bg-[#0A1628] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0066FF] transition"
          >
            <option value="">All types</option>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>

          {/* Add Account */}
          {canEdit && (
            <button
              onClick={openCreate}
              className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Account
            </button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3 mb-6">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl bg-[#0A1628] border border-white/10 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-24">Code</th>
                <th className="px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-28">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-24">Balance</th>
                <th className="px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-20">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {/* Loading */}
              {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {/* Empty */}
              {!isLoading && !error && totalCount === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-white/40">
                    No accounts found.{' '}
                    {!search && !typeFilter
                      ? 'Your chart of accounts will be seeded automatically when your organization is set up.'
                      : 'Try a different search or filter.'}
                  </td>
                </tr>
              )}

              {/* Grouped sections */}
              {!isLoading && !error && TYPE_ORDER.map((type) => {
                const section = grouped[type];
                if (section.length === 0) return null;
                const isOpen = openSections.has(type);

                return (
                  <>
                    <SectionHeader
                      key={`header-${type}`}
                      type={type}
                      count={section.length}
                      isOpen={isOpen}
                      onToggle={() => toggleSection(type)}
                    />
                    {isOpen && section.map((acct) => (
                      <AccountRow
                        key={acct.id}
                        account={acct}
                        depth={depthMap.get(acct.id) ?? 0}
                        canEdit={canEdit}
                        onEdit={openEdit}
                      />
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalMode === 'create' && (
        <AccountModal
          mode="create"
          accounts={accounts}
          onClose={closeModal}
          onSave={createAccount}
          isSubmitting={isCreating}
          serverErrors={createErrors}
        />
      )}
      {modalMode === 'edit' && editTarget && (
        <AccountModal
          mode="edit"
          initial={editTarget}
          accounts={accounts}
          onClose={closeModal}
          onSave={(payload) => updateAccount(payload)}
          isSubmitting={isUpdating}
          serverErrors={updateErrors}
        />
      )}
    </div>
  );
};
