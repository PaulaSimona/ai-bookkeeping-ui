import { type FC, type PropsWithChildren, type ReactNode, useState, useCallback } from 'react';

/**
 * Local Tailwind primitives for the internal staff console. Mirrors the Tier 2
 * dark language used by ReviewerManagement / AccountingReview (bg-[#0f172a] page,
 * bg-[#0A1628] cards, border-white/10, #0066FF primary) — deliberately NOT the
 * legacy react-bootstrap shared components (Button/Card/Badge are @ts-nocheck
 * Tier 1). No PII is ever passed to console.* here.
 */

export const PageContainer: FC<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}> = ({ title, subtitle, actions, children }) => (
  <div className="max-w-6xl mx-auto px-6 py-8">
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-white/50 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
    <div className="space-y-6">{children}</div>
  </div>
);

export const SectionCard: FC<{
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ title, description, actions, className, children }) => (
  <div className={`bg-[#0A1628] border border-white/10 rounded-xl ${className ?? ''}`}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10">
        <div>
          {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
          {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const PILL_TONES: Record<PillTone, string> = {
  neutral: 'bg-white/10 text-white/70',
  info: 'bg-[#0066FF]/20 text-[#4DA6FF]',
  success: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
  danger: 'bg-red-500/15 text-red-300',
};

export const Pill: FC<PropsWithChildren<{ tone?: PillTone }>> = ({ tone = 'neutral', children }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PILL_TONES[tone]}`}
  >
    {children}
  </span>
);

export const Spinner: FC<{ className?: string }> = ({ className }) => (
  <div
    className={`inline-block border-2 border-current border-t-transparent rounded-full animate-spin ${
      className ?? 'w-5 h-5'
    }`}
  />
);

export const CenteredSpinner: FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/50">
    <Spinner className="w-6 h-6 text-[#0066FF]" />
    {label && <span className="text-sm">{label}</span>}
  </div>
);

export const EmptyState: FC<{ title: string; description?: string; children?: ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <div className="flex flex-col items-center justify-center text-center gap-2 py-16">
    <svg
      className="w-8 h-8 text-white/20"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
    <p className="text-sm font-medium text-white/70">{title}</p>
    {description && <p className="text-xs text-white/40 max-w-md">{description}</p>}
    {children}
  </div>
);

export const ErrorBanner: FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
    <p className="text-sm text-red-200">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-medium text-red-100 underline underline-offset-2 hover:text-white"
      >
        Retry
      </button>
    )}
  </div>
);

/**
 * Calm "not permitted" state for a 403 from a can_administer surface — never a
 * crash / white screen.
 */
export const NotPermitted: FC<{ message?: string }> = ({ message }) => (
  <SectionCard>
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
      <svg
        className="w-8 h-8 text-white/20"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
        />
      </svg>
      <p className="text-sm font-medium text-white/70">Not permitted</p>
      <p className="text-xs text-white/40 max-w-md">
        {message ?? 'This area is limited to super users.'}
      </p>
    </div>
  </SectionCard>
);

// ─── Buttons ──────────────────────────────────────────────────────────────────

export const PrimaryButton: FC<
  PropsWithChildren<{ onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; busy?: boolean }>
> = ({ onClick, disabled, type = 'button', busy, children }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || busy}
    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0052cc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {busy && <Spinner className="w-4 h-4" />}
    {children}
  </button>
);

export const SecondaryButton: FC<
  PropsWithChildren<{ onClick?: () => void; disabled?: boolean; tone?: 'default' | 'danger' }>
> = ({ onClick, disabled, tone = 'default', children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      tone === 'danger'
        ? 'border-red-500/40 text-red-200 hover:bg-red-500/10'
        : 'border-white/15 text-white/80 hover:bg-white/5'
    }`}
  >
    {children}
  </button>
);

// ─── Toast ────────────────────────────────────────────────────────────────────

export interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, showToast };
};

export const Toast: FC<{ toast: ToastState | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div
      className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
        toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {toast.message}
    </div>
  );
};

// ─── Formatting (display-only; never do money math in JS) ──────────────────────

/** Format a backend Decimal (string|number) for display. Display only. */
export const formatMoney = (value: string | number | null | undefined): string => {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Relative age from an ISO timestamp — e.g. "3d", "5h", "12m". Display only. */
export const formatAge = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

/** Backend routing_reason / reason codes → readable label. */
export const humanizeCode = (code: string | null | undefined): string => {
  if (!code) return '—';
  return code
    .split('_')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
};
