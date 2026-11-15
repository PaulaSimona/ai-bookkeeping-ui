// Shared pieces of the two Projects screens (J1c-1): Settings → Projects and
// the Projects page. Client lane only — nothing here is used by a Tier 1
// screen or a staff surface. No data hook lives here: these are the role
// rule, the one banner a refusal is shown in, and small markup helpers.
import { type FC, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { type Refusal } from '@/utils/projectRefusal';

// J1 sheet R22: the owner and the accountant write, any other member reads.
// The server enforces it; the screens only hide the write controls.
export const canWriteProjects = (role: string | null | undefined): boolean =>
  role === 'owner' || role === 'accountant';

export const SETTINGS_PROJECTS_PATH = '/settings?tab=projects';

export const ProjectsSettingsLink: FC = () => (
  <Link to={SETTINGS_PROJECTS_PATH} className="font-medium underline">
    Settings → Projects
  </Link>
);

// ── What a refused write is shown as ─────────────────────────────────────────
// Either the server's own message, or — when the server says Projects is off
// (409 projects_off) — the "turned off" message with the link (R-J1C-4).
export type Notice = { kind: 'error'; text: string } | { kind: 'off' } | null;

export const noticeOf = (refusal: Refusal): Notice => {
  if (refusal.code === 'projects_off') return { kind: 'off' };
  return refusal.banner ? { kind: 'error', text: refusal.banner } : null;
};

export const ErrorBanner: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div role="alert" className={`rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}>
    {children}
  </div>
);

export const NoticeBanner: FC<{ notice: Notice; className?: string }> = ({ notice, className }) => {
  if (notice === null) return null;
  return (
    <ErrorBanner className={className}>
      {notice.kind === 'off' ? (
        <>
          Projects is turned off. Turn it on in <ProjectsSettingsLink />.
        </>
      ) : (
        notice.text
      )}
    </ErrorBanner>
  );
};

// A field's own error, under the field. The field points at it with
// aria-describedby.
export const FieldError: FC<{ id: string; children: ReactNode }> = ({ id, children }) => (
  <p id={id} className="mt-1 text-xs text-red-600">
    {children}
  </p>
);

// Runs one write. The api interceptor resolves a refusal as its response; a
// request that still rejects (network, ended session) gives its response when
// it has one, else null. Callers status-check.
export const attempt = async <T,>(call: () => Promise<T>): Promise<T | null> => {
  try {
    return await call();
  } catch (err) {
    return (err as { response?: T } | null)?.response ?? null;
  }
};

// ── Paging (the house list footer) ───────────────────────────────────────────
interface PagerProps {
  page: number;
  pageSize: number;
  count: number;
  setPage: (page: number) => void;
}

// Shown only when the list is longer than one page.
export const Pager: FC<PagerProps> = ({ page, pageSize, count, setPage }) => {
  if (count <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return (
    <div className="mt-3 flex items-center justify-between text-[13px] text-gray-500">
      <span>{`${from}–${to} of ${count}`}</span>
      <div className="flex gap-2">
        <button
          type="button"
          className={pagerButtonCls}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={pagerButtonCls}
          disabled={page * pageSize >= count}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

// ── Control classes (the house form look) ────────────────────────────────────
const pagerButtonCls = 'rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40';

export const inputCls =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400';

export const primaryButtonCls =
  'rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-40';

export const secondaryButtonCls =
  'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40';

export const labelCls = 'block text-sm font-medium text-gray-700';
