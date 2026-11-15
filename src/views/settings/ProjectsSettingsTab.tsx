// Settings → Projects (J1c-1, D-J1C-1 as amended) — every Projects setting on
// one page, in four cards: the switch with its tracking date, the job types,
// the job cost category of each account, and a plain-words explanation.
//
// The owner and the accountant write; any other member reads (J1 sheet R22).
// The server decides: its message is shown once, in a banner, and a field
// error under its field (R-J1C-2/3). Nothing is shown as changed until the
// server has answered. Client lane only; presentational pieces from
// components/t2.
import { useId, useState, type FC, type FormEvent, type ReactNode } from 'react';
import { Card } from '@/components/t2/Card';
import { StatusBadge } from '@/components/t2/StatusBadge';
import { TableRow, TableShell, type T2Column } from '@/components/t2/TableShell';
import { useOrgContext } from '@/context/OrgContext';
import {
  JOB_COST_CATEGORIES,
  NO_CATEGORY_LABEL,
  jobCostCategoryLabel,
  setAccountJobCostCategory,
  useAccountCategories,
  type AccountCategoryRow,
} from '@/hooks/useAccountCategories';
import {
  useProjectSettings,
  type DefaultCategorySet,
  type ProjectSettingsPayload,
} from '@/hooks/useProjectSettings';
import {
  archiveProjectType,
  createProjectType,
  renameProjectType,
  useProjectTypes,
  type ProjectTypeRow,
} from '@/hooks/useProjectTypes';
import { readRefusal } from '@/utils/projectRefusal';
import {
  attempt,
  canWriteProjects,
  ErrorBanner,
  FieldError,
  inputCls,
  labelCls,
  noticeOf,
  NoticeBanner,
  Pager,
  primaryButtonCls,
  secondaryButtonCls,
  type Notice,
} from '@/views/accounting/projects/shared';

const SectionCard: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section>
    <Card padding>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </Card>
  </section>
);

const noteCls = 'mt-2 text-sm text-gray-600';

// ── a. Projects on / off, with the tracking date ─────────────────────────────
const SETTINGS_FIELDS = ['projects_enabled', 'projects_tracking_from'];

interface SwitchCardProps {
  canWrite: boolean;
  onTurnedOn: () => void;
}

const SwitchCard: FC<SwitchCardProps> = ({ canWrite, onTurnedOn }) => {
  const { settings, isLoading, error, save } = useProjectSettings();
  // What the user changed and has not saved yet; the rest shows the server's value.
  const [draft, setDraft] = useState<{ enabled?: boolean; date?: string }>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // The accounts that received a default category in the last turn-on (R-J1C-5).
  const [defaults, setDefaults] = useState<DefaultCategorySet[] | null>(null);
  const switchId = useId();
  const dateId = useId();
  const switchErrorId = useId();
  const dateErrorId = useId();

  if (settings === null) {
    return (
      <SectionCard title="Projects">
        {error ? (
          <ErrorBanner className="mt-3">{error}</ErrorBanner>
        ) : (
          <p className={noteCls}>
            {isLoading ? 'Loading…' : 'The Projects settings are not available.'}
          </p>
        )}
      </SectionCard>
    );
  }

  const savedDate = settings.projects_tracking_from ?? '';
  const enabled = draft.enabled ?? settings.projects_enabled;
  const date = draft.date ?? savedDate;

  const payload: ProjectSettingsPayload = {};
  if (enabled !== settings.projects_enabled) payload.projects_enabled = enabled;
  if (date !== savedDate) payload.projects_tracking_from = date || null;
  const changed = Object.keys(payload).length > 0;
  const needsDate = enabled && !date;
  const turningOff = settings.projects_enabled && !enabled;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !changed || needsDate) return;
    setBusy(true);
    setNotice(null);
    setFieldErrors({});
    setDefaults(null);
    const res = await attempt(() => save(payload));
    setBusy(false);
    if (res?.status === 200) {
      setDraft({});
      if (payload.projects_enabled === true) {
        const set = res.data?.default_categories_set;
        setDefaults(Array.isArray(set) ? set : []);
        onTurnedOn();
      }
      return;
    }
    const refusal = readRefusal(res, 'Could not save the Projects settings.', SETTINGS_FIELDS);
    setNotice(noticeOf(refusal));
    setFieldErrors(refusal.fields);
  };

  return (
    <SectionCard title="Projects">
      <p className={noteCls}>{settings.projects_on ? 'Projects is on.' : 'Projects is off.'}</p>

      {!canWrite && (
        <p className={noteCls}>{`Tracking date: ${settings.projects_tracking_from ?? 'not set'}`}</p>
      )}

      {canWrite && (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <NoticeBanner notice={notice} />

          <div>
            <div className="flex items-center gap-2">
              <input
                id={switchId}
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={enabled}
                disabled={busy}
                aria-describedby={fieldErrors.projects_enabled ? switchErrorId : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />
              <label htmlFor={switchId} className="text-sm font-medium text-gray-700">
                Turn Projects on
              </label>
            </div>
            {fieldErrors.projects_enabled && (
              <FieldError id={switchErrorId}>{fieldErrors.projects_enabled}</FieldError>
            )}
          </div>

          <div>
            <label htmlFor={dateId} className={labelCls}>
              Tracking date
            </label>
            <input
              id={dateId}
              type="date"
              className={`mt-1 ${inputCls}`}
              value={date}
              disabled={busy}
              aria-describedby={fieldErrors.projects_tracking_from ? dateErrorId : undefined}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />
            {fieldErrors.projects_tracking_from && (
              <FieldError id={dateErrorId}>{fieldErrors.projects_tracking_from}</FieldError>
            )}
            {needsDate && (
              <p className="mt-1 text-xs text-gray-600">Choose a tracking date to turn Projects on.</p>
            )}
          </div>

          {turningOff && (
            <p className="text-sm text-gray-700">
              Turning Projects off deletes nothing. Your projects, job types and categories are kept,
              and the Projects screens are hidden until you turn it on again.
            </p>
          )}

          <button type="submit" className={primaryButtonCls} disabled={busy || !changed || needsDate}>
            Save
          </button>
        </form>
      )}

      {defaults !== null &&
        (defaults.length === 0 ? (
          <p className={noteCls}>No account received a default job cost category.</p>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-gray-700">
              Projects was turned on. These accounts were given a default job cost category:
            </p>
            <ul
              aria-label="Accounts that received a default job cost category"
              className="mt-1 list-disc pl-5 text-sm text-gray-700"
            >
              {defaults.map((row) => (
                <li key={row.id}>{`${row.code} — ${jobCostCategoryLabel(row.category)}`}</li>
              ))}
            </ul>
          </div>
        ))}
    </SectionCard>
  );
};

// ── b. Job types ─────────────────────────────────────────────────────────────
interface ListCardProps {
  canWrite: boolean;
  // Projects is not on: the server refuses these writes (409 projects_off).
  locked: boolean;
  // Projects is known to be off, so the one-line reason is shown.
  showReason: boolean;
}

type JobTypeAction = { kind: 'rename'; id: string; name: string } | { kind: 'archive'; id: string };

const JobTypesCard: FC<ListCardProps> = ({ canWrite, locked, showReason }) => {
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useProjectTypes();
  const { refetch: refetchSettings } = useProjectSettings();
  const [newName, setNewName] = useState('');
  const [action, setAction] = useState<JobTypeAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [nameError, setNameError] = useState<{ where: 'add' | 'rename'; text: string } | null>(null);
  const newNameId = useId();
  const nameErrorId = useId();

  // One write at a time; the list changes only when the server has accepted it.
  // `where` is the name field the write has, if it has one.
  const run = async (
    where: 'add' | 'rename' | null,
    call: () => ReturnType<typeof createProjectType>,
    okStatus: number,
    fallback: string,
    onDone: () => void,
  ) => {
    setBusy(true);
    setNotice(null);
    setNameError(null);
    const res = await attempt(call);
    setBusy(false);
    if (res?.status === okStatus) {
      onDone();
      refetch();
      return;
    }
    const refusal = readRefusal(res, fallback, where ? ['name'] : []);
    setNotice(noticeOf(refusal));
    if (where && refusal.fields.name) setNameError({ where, text: refusal.fields.name });
    // The server says Projects is off: read the shared value again, so the
    // menu and this page follow.
    if (refusal.code === 'projects_off') refetchSettings();
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (busy || locked || !name) return;
    void run('add', () => createProjectType(name), 201, 'Could not add the job type.', () =>
      setNewName(''),
    );
  };

  const rename = (event: FormEvent, row: ProjectTypeRow) => {
    event.preventDefault();
    if (action?.kind !== 'rename' || busy || locked) return;
    const name = action.name.trim();
    if (!name) return;
    if (name === row.name) {
      setAction(null);
      return;
    }
    void run(
      'rename',
      () => renameProjectType(row.id, name),
      200,
      'Could not rename the job type.',
      () => setAction(null),
    );
  };

  const archive = (row: ProjectTypeRow) => {
    if (busy || locked) return;
    void run(null, () => archiveProjectType(row.id), 200, 'Could not archive the job type.', () =>
      setAction(null),
    );
  };

  const columns: T2Column[] = canWrite
    ? [{ label: 'Name', fr: 3 }, { label: '', fr: 2, align: 'right' }]
    : [{ label: 'Name' }];

  const nameCell = (row: ProjectTypeRow) => {
    if (action?.id === row.id && action.kind === 'rename') {
      const hasError = nameError?.where === 'rename';
      return (
        <form onSubmit={(event) => rename(event, row)} className="flex flex-wrap items-start gap-2">
          <div>
            <input
              type="text"
              aria-label={`New name for ${row.name}`}
              className={inputCls}
              value={action.name}
              disabled={busy}
              aria-describedby={hasError ? nameErrorId : undefined}
              onChange={(e) => setAction({ kind: 'rename', id: row.id, name: e.target.value })}
            />
            {hasError && <FieldError id={nameErrorId}>{nameError.text}</FieldError>}
          </div>
          <button
            type="submit"
            className={secondaryButtonCls}
            disabled={busy || !action.name.trim()}
          >
            Save name
          </button>
          <button
            type="button"
            className={secondaryButtonCls}
            disabled={busy}
            onClick={() => setAction(null)}
          >
            Cancel
          </button>
        </form>
      );
    }
    return (
      <div>
        <div className="flex items-center gap-2">
          <div>{row.name}</div>
          {row.archived && <StatusBadge>Archived</StatusBadge>}
        </div>
        {action?.id === row.id && action.kind === 'archive' && (
          <p className="mt-1 text-xs text-gray-600">
            An archived job type can no longer be chosen for a project, and it cannot be restored
            here.
          </p>
        )}
      </div>
    );
  };

  const actionsCell = (row: ProjectTypeRow) => {
    if (row.archived) return null;
    if (action?.id === row.id && action.kind === 'rename') return null;
    if (action?.id === row.id && action.kind === 'archive') {
      return (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={secondaryButtonCls}
            disabled={busy || locked}
            onClick={() => archive(row)}
          >
            Confirm archive
          </button>
          <button
            type="button"
            className={secondaryButtonCls}
            disabled={busy}
            onClick={() => setAction(null)}
          >
            Cancel
          </button>
        </div>
      );
    }
    return (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          aria-label={`Rename ${row.name}`}
          className={secondaryButtonCls}
          disabled={busy || locked}
          onClick={() => {
            setNameError(null);
            setAction({ kind: 'rename', id: row.id, name: row.name });
          }}
        >
          Rename
        </button>
        <button
          type="button"
          aria-label={`Archive ${row.name}`}
          className={secondaryButtonCls}
          disabled={busy || locked}
          onClick={() => setAction({ kind: 'archive', id: row.id })}
        >
          Archive
        </button>
      </div>
    );
  };

  const addHasError = nameError?.where === 'add';

  return (
    <SectionCard title="Job types">
      <p className={noteCls}>Your own names for the kinds of job you do.</p>
      {canWrite && showReason && (
        <p className={noteCls}>Turn Projects on to change job types.</p>
      )}
      <NoticeBanner notice={notice} className="mt-3" />
      {error && <ErrorBanner className="mt-3">{error}</ErrorBanner>}

      <div className="mt-4 rounded-lg border border-gray-100">
        <TableShell
          columns={columns}
          isEmpty={items.length === 0}
          empty={isLoading ? 'Loading…' : error ? 'Nothing to show.' : 'No job types yet.'}
        >
          {items.map((row) => (
            <TableRow
              key={row.id}
              columns={columns}
              cells={canWrite ? [nameCell(row), actionsCell(row)] : [nameCell(row)]}
            />
          ))}
        </TableShell>
      </div>
      <Pager page={page} pageSize={pageSize} count={count} setPage={setPage} />

      {canWrite && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={newNameId} className={labelCls}>
              New job type
            </label>
            <input
              id={newNameId}
              type="text"
              className={`mt-1 ${inputCls}`}
              value={newName}
              disabled={locked || busy}
              aria-describedby={addHasError ? nameErrorId : undefined}
              onChange={(e) => setNewName(e.target.value)}
            />
            {addHasError && <FieldError id={nameErrorId}>{nameError.text}</FieldError>}
          </div>
          <button
            type="submit"
            className={primaryButtonCls}
            disabled={locked || busy || !newName.trim()}
          >
            Add job type
          </button>
        </form>
      )}
    </SectionCard>
  );
};

// ── c. Job cost category by account ──────────────────────────────────────────
const CATEGORY_COLUMNS: T2Column[] = [
  { label: 'Account', fr: 3 },
  { label: 'Job cost category', fr: 2 },
];

const AccountCategoriesCard: FC<ListCardProps> = ({ canWrite, locked, showReason }) => {
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useAccountCategories();
  const { refetch: refetchSettings } = useProjectSettings();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // The server's answer to the last accepted change.
  const [saved, setSaved] = useState<string | null>(null);

  const change = async (row: AccountCategoryRow, value: string) => {
    if (busy || locked) return;
    setBusy(true);
    setNotice(null);
    setSaved(null);
    const res = await attempt(() => setAccountJobCostCategory(row.account_id, value || null));
    setBusy(false);
    if (res?.status === 200) {
      const code = res.data?.code ?? row.code;
      const label = jobCostCategoryLabel(res.data?.job_cost_category ?? null);
      const lines = res.data?.posted_lines_not_affected ?? 0;
      setSaved(`${code} saved as ${label}. Posted lines not affected: ${lines}.`);
      refetch();
      return;
    }
    const refusal = readRefusal(res, 'Could not save the job cost category.');
    setNotice(noticeOf(refusal));
    if (refusal.code === 'projects_off') refetchSettings();
  };

  const accountCell = (row: AccountCategoryRow) => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="font-medium tabular-nums text-gray-900">{row.code}</div>
      <div>{row.name}</div>
      {!row.is_active && <StatusBadge>Inactive</StatusBadge>}
    </div>
  );

  const categoryCell = (row: AccountCategoryRow) => {
    if (!canWrite) return <span>{jobCostCategoryLabel(row.job_cost_category)}</span>;
    const stored = row.job_cost_category;
    const known = stored === null || JOB_COST_CATEGORIES.some((c) => c.value === stored);
    return (
      // The row shows the server's value; it changes when the list is read again.
      <select
        aria-label={`Job cost category for ${row.code} ${row.name}`}
        className={inputCls}
        value={stored ?? ''}
        disabled={locked || busy}
        onChange={(e) => void change(row, e.target.value)}
      >
        <option value="">{NO_CATEGORY_LABEL}</option>
        {JOB_COST_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
        {!known && <option value={stored}>{stored}</option>}
      </select>
    );
  };

  return (
    <SectionCard title="Job cost category by account">
      <p className={noteCls}>
        The kind of job cost each account stands for. A change applies to new lines; lines that are
        already posted keep what they have.
      </p>
      {canWrite && showReason && (
        <p className={noteCls}>Turn Projects on to change job cost categories.</p>
      )}
      <NoticeBanner notice={notice} className="mt-3" />
      {error && <ErrorBanner className="mt-3">{error}</ErrorBanner>}
      {saved && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saved}
        </p>
      )}

      <div className="mt-4 rounded-lg border border-gray-100">
        <TableShell
          columns={CATEGORY_COLUMNS}
          isEmpty={items.length === 0}
          empty={
            isLoading ? 'Loading…' : error ? 'Nothing to show.' : 'No account can carry a job cost category.'
          }
        >
          {items.map((row) => (
            <TableRow
              key={row.account_id}
              columns={CATEGORY_COLUMNS}
              cells={[accountCell(row), categoryCell(row)]}
            />
          ))}
        </TableShell>
      </div>
      <Pager page={page} pageSize={pageSize} count={count} setPage={setPage} />
    </SectionCard>
  );
};

// ── d. What Projects does ────────────────────────────────────────────────────
const ExplanationCard: FC = () => (
  <SectionCard title="How Projects works">
    <div className="mt-2 space-y-2 text-sm text-gray-600">
      <p>
        Projects keeps a list of your jobs. Each project has a number, a name, and if you wish a
        reference, a customer, a job type and its dates.
      </p>
      <p>
        A job type is your own name for a kind of job. A job cost category says what kind of job
        cost an account holds: materials, labour, subcontractors, equipment, permits and fees, or
        other direct cost.
      </p>
      <p>
        The tracking date is the day Projects starts counting: from that day on, income and job cost
        lines that have no project are counted as not yet assigned to a project. Earlier lines are
        left as they are.
      </p>
      <p>
        Turning Projects off hides the Projects screens. Everything you set up here is kept and
        comes back when you turn Projects on again.
      </p>
    </div>
  </SectionCard>
);

export const ProjectsSettingsTab: FC = () => {
  const { activeOrgId, activeRole } = useOrgContext();
  const { settings, projectsOn } = useProjectSettings();
  // Bumped when Projects was just turned on: the account list is read again,
  // so it shows the default categories the server set.
  const [categoriesKey, setCategoriesKey] = useState(0);

  const canWrite = canWriteProjects(activeRole);
  const locked = !projectsOn;
  const showReason = settings !== null && !projectsOn;

  return (
    // A change of the active org starts every card afresh.
    <div key={activeOrgId ?? 'none'} className="space-y-6">
      <SwitchCard canWrite={canWrite} onTurnedOn={() => setCategoriesKey((k) => k + 1)} />
      <JobTypesCard canWrite={canWrite} locked={locked} showReason={showReason} />
      <AccountCategoriesCard
        key={categoriesKey}
        canWrite={canWrite}
        locked={locked}
        showReason={showReason}
      />
      <ExplanationCard />
    </div>
  );
};
