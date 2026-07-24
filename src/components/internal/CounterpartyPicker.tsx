import { type FC, useState } from 'react';
import {
  useStaffOrgCounterparties,
  createStaffOrgCounterparty,
} from '@/hooks/useStaffResolution';

/**
 * Active-counterparty picker for the internal console, with a "+ New supplier /
 * client" inline create (name + type minimum) → POST staff counterparties → on
 * 201 select the created counterparty. Shared by the reject-correct editor (§4.2)
 * and the client-entries assign control (§14 14-C-2b). Backend 400s (uniqueness,
 * etc.) surface verbatim.
 */

const fieldCls =
  'w-full rounded-md bg-[#0f172a] border border-white/15 px-2 py-1.5 text-sm text-white ' +
  'placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#0066FF]';

export const CounterpartyPicker: FC<{
  orgId: string;
  value: string; // selected counterparty id ('' = none picked)
  onChange: (id: string) => void;
  disabled?: boolean;
}> = ({ orgId, value, onChange, disabled }) => {
  const { counterparties, isLoading, refetch } = useStaffOrgCounterparties(orgId, { archived: false });
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'supplier' | 'client'>('supplier');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setErr(null);
    const flag = kind === 'client' ? { is_client: true } : { is_supplier: true };
    const res = await createStaffOrgCounterparty(orgId, { name: name.trim(), ...flag });
    setCreating(false);
    if (res.ok && res.data) {
      onChange(res.data.id);
      setShowNew(false);
      setName('');
      refetch();
    } else {
      setErr(res.errorDetail ?? 'Failed to create counterparty.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isLoading}
          className={fieldCls}
        >
          <option value="">{isLoading ? 'Loading…' : 'Select a counterparty…'}</option>
          {counterparties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_client && c.is_supplier
                ? ' (client · supplier)'
                : c.is_client
                  ? ' (client)'
                  : c.is_supplier
                    ? ' (supplier)'
                    : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          disabled={disabled}
          className="shrink-0 text-xs font-medium text-[#4DA6FF] hover:text-white disabled:opacity-40"
        >
          + New
        </button>
      </div>

      {showNew && (
        <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              className={fieldCls}
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'supplier' | 'client')}
              className={`${fieldCls} w-32`}
            >
              <option value="supplier">Supplier</option>
              <option value="client">Client</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-300">{err}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={create}
              disabled={!name.trim() || creating}
              className="rounded-md bg-[#0066FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0052cc] disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create & select'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNew(false);
                setErr(null);
              }}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
