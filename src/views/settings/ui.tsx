// Page-local Settings primitives (s24 U1 restyle — O-S24-1am, D-S24-8). The
// tab bar and form controls (Field/Input/Select/Toggle/SaveButton) do NOT exist
// in t2/ and must not be promoted there — they live here, styled with brand
// tokens (var(--color-navy|primary|primary-light|primary-hover),
// var(--font-family-mono)) + Tailwind neutrals/palette utilities. ZERO raw hex.
import {
  type FC,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Card } from '@/components/t2/Card';

// ─── Spinner ────────────────────────────────────────────────────────────────
export const Spinner: FC<{ light?: boolean }> = ({ light }) => (
  <div
    className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
      light ? 'border-white' : 'border-[var(--color-primary)]'
    }`}
  />
);

// ─── Toast ──────────────────────────────────────────────────────────────────
interface Toast { message: string; type: 'success' | 'error' }

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (message: string, type: Toast['type']) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 3500);
  };

  return {
    toast,
    showSuccess: (m: string) => show(m, 'success'),
    showError: (m: string) => show(m, 'error'),
  };
}

export const ToastBanner: FC<{ toast: Toast | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div
      className={`fixed right-5 top-5 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium text-white shadow-lg transition-all ${
        toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {toast.type === 'success' ? (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {toast.message}
    </div>
  );
};

// ─── Tab bar (bottom-border + active state) ───────────────────────────────────
export interface TabDef { id: string; label: string }

export const TabBar: FC<{ tabs: TabDef[]; active: string; onChange: (id: string) => void }> = ({
  tabs, active, onChange,
}) => {
  // When the row can't fit every tab (narrow viewport → overflow-x-auto), keep
  // the active tab in view instead of silently clipping it (F-S24-2). block:
  // 'nearest' prevents any vertical page jog; at desktop widths where all tabs
  // fit, there is nothing to scroll and this is a no-op.
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [active]);

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex gap-5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={active === t.id ? activeRef : undefined}
            type="button"
            onClick={() => onChange(t.id)}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors ${
              active === t.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

// ─── Section card (t2/Card surface + header) ──────────────────────────────────
export const Section: FC<{ title: string; description?: string; children: ReactNode }> = ({
  title, description, children,
}) => (
  <Card>
    <div className="border-b border-gray-100 px-6 py-5">
      <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-[13.5px] text-gray-500">{description}</p>}
    </div>
    <div className="px-6 py-6">{children}</div>
  </Card>
);

// ─── Form controls (42px inputs, focus ring, 8px radius) ──────────────────────
export const Field: FC<{ label: string; required?: boolean; children: ReactNode }> = ({
  label, required, children,
}) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-gray-700">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const CONTROL =
  'h-[42px] w-full rounded-lg border border-gray-300 px-3.5 text-sm text-gray-900 transition ' +
  'placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 ' +
  'focus:ring-[color:var(--color-primary)] disabled:bg-gray-50 disabled:text-gray-400';

export const Input: FC<InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`${CONTROL} ${className}`} />
);

export const Select: FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
  <select {...props} className={`${CONTROL} bg-white ${className}`}>
    {children}
  </select>
);

// Toggle switch — built page-local for the tier-2 tabs (U2); brand-primary when on.
export const Toggle: FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({
  checked, onChange, label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

export const SaveButton: FC<{ saving: boolean; label?: string }> = ({ saving, label = 'Save changes' }) => (
  <button
    type="submit"
    disabled={saving}
    className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
  >
    {saving && <Spinner light />}
    {saving ? 'Saving…' : label}
  </button>
);
