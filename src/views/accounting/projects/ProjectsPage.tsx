// Projects page (J1c-1, D-J1C-1) — /accounting/projects: the list of projects
// with a status filter, create, edit and status change. There is no delete.
//
// The owner and the accountant write; any other member reads (J1 sheet R22).
// The server decides: its message is shown once, in a banner, and a field
// error under its field (R-J1C-2/3). Nothing is shown as changed until the
// list has been read again. While Projects is off the page says so and links
// to Settings → Projects, and reads no project (R-J1C-4). Client lane only;
// presentational pieces from components/t2.
import { useId, useState, type FC, type FormEvent } from 'react';
import { Card } from '@/components/t2/Card';
import { FilterChip } from '@/components/t2/FilterChip';
import { PageHeader } from '@/components/t2/PageHeader';
import { StatusBadge } from '@/components/t2/StatusBadge';
import { TableRow, TableShell, type T2Column } from '@/components/t2/TableShell';
import { useOrgContext } from '@/context/OrgContext';
import {
  createProject,
  PROJECT_STATUSES,
  setProjectStatus,
  updateProject,
  useProjectFormOptions,
  useProjects,
  type ProjectOption,
  type ProjectPayload,
  type ProjectRow,
  type ProjectStatus,
} from '@/hooks/useProjects';
import { useProjectSettings } from '@/hooks/useProjectSettings';
import { readRefusal, type Refusal } from '@/utils/projectRefusal';
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
  ProjectsSettingsLink,
  secondaryButtonCls,
  type Notice,
} from './shared';

const STATUS_VARIANT: Record<ProjectStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'info',
  archived: 'neutral',
};

const statusLabel = (status: ProjectStatus): string =>
  PROJECT_STATUSES.find((s) => s.value === status)?.label ?? status;

const NONE = '—';

// ── Create / edit form ───────────────────────────────────────────────────────
const FORM_FIELDS = ['name', 'reference', 'customer_id', 'project_type_id', 'start_date', 'end_date'];

interface ProjectFormProps {
  // The project being edited, as the server has it; null for a new one.
  project: ProjectRow | null;
  onAttempt: () => void;
  onRefused: (refusal: Refusal) => void;
  onSaved: () => void;
  onClose: () => void;
}

interface PickListProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  none: string;
  options: ProjectOption[];
  // The project's own choice, kept on offer when the loaded list does not
  // have it (an archived customer or job type).
  currentId: string | null;
  currentName: string | null;
  isLoading: boolean;
  disabled: boolean;
  describedBy?: string;
}

const PickList: FC<PickListProps> = ({
  id,
  value,
  onChange,
  none,
  options,
  currentId,
  currentName,
  isLoading,
  disabled,
  describedBy,
}) => {
  const missing = currentId !== null && !options.some((option) => option.id === currentId);
  const name = currentName ?? 'Unknown';
  return (
    <select
      id={id}
      className={`mt-1 w-full ${inputCls}`}
      value={value}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{none}</option>
      {missing && <option value={currentId}>{isLoading ? name : `${name} (current)`}</option>}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
};

const ProjectForm: FC<ProjectFormProps> = ({ project, onAttempt, onRefused, onSaved, onClose }) => {
  // The pick lists are read when the form opens.
  const options = useProjectFormOptions();
  const [name, setName] = useState(project?.name ?? '');
  const [reference, setReference] = useState(project?.reference ?? '');
  const [customerId, setCustomerId] = useState(project?.customer_id ?? '');
  const [typeId, setTypeId] = useState(project?.project_type_id ?? '');
  const [startDate, setStartDate] = useState(project?.start_date ?? '');
  const [endDate, setEndDate] = useState(project?.end_date ?? '');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const baseId = useId();
  const fieldId = (field: string) => `${baseId}-${field}`;
  const errorId = (field: string) => `${baseId}-${field}-error`;
  const describedBy = (field: string) => (fieldErrors[field] ? errorId(field) : undefined);
  const errorOf = (field: string) =>
    fieldErrors[field] && <FieldError id={errorId(field)}>{fieldErrors[field]}</FieldError>;

  const title = project ? 'Edit project' : 'New project';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (busy || !trimmedName) return;

    const values = {
      name: trimmedName,
      reference: reference.trim(),
      customer_id: customerId || null,
      project_type_id: typeId || null,
      start_date: startDate || null,
      end_date: endDate || null,
    };

    let call: () => ReturnType<typeof createProject>;
    let okStatus: number;
    if (project === null) {
      // Only what was filled in is sent.
      const payload: ProjectPayload = { name: values.name };
      if (values.reference) payload.reference = values.reference;
      if (values.customer_id) payload.customer_id = values.customer_id;
      if (values.project_type_id) payload.project_type_id = values.project_type_id;
      if (values.start_date) payload.start_date = values.start_date;
      if (values.end_date) payload.end_date = values.end_date;
      call = () => createProject(payload);
      okStatus = 201;
    } else {
      // Only what changed is sent; nothing changed sends nothing.
      const payload: Partial<ProjectPayload> = {};
      if (values.name !== project.name) payload.name = values.name;
      if (values.reference !== project.reference) payload.reference = values.reference;
      if (values.customer_id !== project.customer_id) payload.customer_id = values.customer_id;
      if (values.project_type_id !== project.project_type_id) {
        payload.project_type_id = values.project_type_id;
      }
      if (values.start_date !== project.start_date) payload.start_date = values.start_date;
      if (values.end_date !== project.end_date) payload.end_date = values.end_date;
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
      call = () => updateProject(project.id, payload);
      okStatus = 200;
    }

    setBusy(true);
    setFieldErrors({});
    onAttempt();
    const res = await attempt(call);
    if (res?.status === okStatus) {
      onSaved();
      return;
    }
    setBusy(false);
    const refusal = readRefusal(res, 'Could not save the project.', FORM_FIELDS);
    setFieldErrors(refusal.fields);
    onRefused(refusal);
  };

  return (
    <Card padding className="mt-4">
      <form aria-label={title} onSubmit={submit}>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {options.error && <p className="mt-2 text-sm text-red-700">{options.error}</p>}
        {options.truncated && (
          <p className="mt-2 text-sm text-gray-600">
            Only the first 200 customers and job types are listed.
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={fieldId('name')} className={labelCls}>
              Name
            </label>
            <input
              id={fieldId('name')}
              type="text"
              className={`mt-1 w-full ${inputCls}`}
              value={name}
              disabled={busy}
              aria-describedby={describedBy('name')}
              onChange={(e) => setName(e.target.value)}
            />
            {errorOf('name')}
          </div>
          <div>
            <label htmlFor={fieldId('reference')} className={labelCls}>
              Reference
            </label>
            <input
              id={fieldId('reference')}
              type="text"
              className={`mt-1 w-full ${inputCls}`}
              value={reference}
              disabled={busy}
              aria-describedby={describedBy('reference')}
              onChange={(e) => setReference(e.target.value)}
            />
            {errorOf('reference')}
          </div>
          <div>
            <label htmlFor={fieldId('customer_id')} className={labelCls}>
              Customer
            </label>
            <PickList
              id={fieldId('customer_id')}
              value={customerId}
              onChange={setCustomerId}
              none="No customer"
              options={options.customers}
              currentId={project?.customer_id ?? null}
              currentName={project?.customer_name ?? null}
              isLoading={options.isLoading}
              disabled={busy}
              describedBy={describedBy('customer_id')}
            />
            {errorOf('customer_id')}
          </div>
          <div>
            <label htmlFor={fieldId('project_type_id')} className={labelCls}>
              Job type
            </label>
            <PickList
              id={fieldId('project_type_id')}
              value={typeId}
              onChange={setTypeId}
              none="No job type"
              options={options.jobTypes}
              currentId={project?.project_type_id ?? null}
              currentName={project?.project_type_name ?? null}
              isLoading={options.isLoading}
              disabled={busy}
              describedBy={describedBy('project_type_id')}
            />
            {errorOf('project_type_id')}
          </div>
          <div>
            <label htmlFor={fieldId('start_date')} className={labelCls}>
              Start date
            </label>
            <input
              id={fieldId('start_date')}
              type="date"
              className={`mt-1 w-full ${inputCls}`}
              value={startDate}
              disabled={busy}
              aria-describedby={describedBy('start_date')}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {errorOf('start_date')}
          </div>
          <div>
            <label htmlFor={fieldId('end_date')} className={labelCls}>
              End date
            </label>
            <input
              id={fieldId('end_date')}
              type="date"
              className={`mt-1 w-full ${inputCls}`}
              value={endDate}
              disabled={busy}
              aria-describedby={describedBy('end_date')}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {errorOf('end_date')}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="submit" className={primaryButtonCls} disabled={busy || !name.trim()}>
            {project ? 'Save changes' : 'Create project'}
          </button>
          <button type="button" className={secondaryButtonCls} disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
};

// ── The list (mounted only while Projects is on) ─────────────────────────────
const FILTERS: { value: '' | ProjectStatus; label: string }[] = [
  { value: '', label: 'All' },
  ...PROJECT_STATUSES,
];

const READ_COLUMNS: T2Column[] = [
  { label: 'Number' },
  { label: 'Name', fr: 3 },
  { label: 'Reference', fr: 2 },
  { label: 'Customer', fr: 2 },
  { label: 'Job type', fr: 2 },
  { label: 'Status', fr: 2 },
];
const WRITE_COLUMNS: T2Column[] = [...READ_COLUMNS, { label: '', align: 'right' }];

const ProjectsList: FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const [status, setStatus] = useState<'' | ProjectStatus>('');
  const { items, count, page, setPage, pageSize, isLoading, error, refetch } = useProjects(
    status ? { status } : {},
  );
  const { refetch: refetchSettings } = useProjectSettings();
  // The open form: a project to edit, or null for a new one.
  const [form, setForm] = useState<{ project: ProjectRow | null } | null>(null);
  // The one banner of the page: what the server said to the last refused write.
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const refused = (refusal: Refusal) => {
    setNotice(noticeOf(refusal));
    // The server says Projects is off: read the shared value again, so the
    // menu and this page follow.
    if (refusal.code === 'projects_off') refetchSettings();
  };

  const changeStatus = async (row: ProjectRow, next: ProjectStatus) => {
    if (busy || next === row.status) return;
    setBusy(true);
    setNotice(null);
    const res = await attempt(() => setProjectStatus(row.id, next));
    setBusy(false);
    if (res?.status === 200) {
      refetch();
      return;
    }
    refused(readRefusal(res, 'Could not change the status.'));
  };

  const columns = canWrite ? WRITE_COLUMNS : READ_COLUMNS;

  const cells = (row: ProjectRow) => {
    const read = [
      row.number,
      row.name,
      row.reference || NONE,
      row.customer_name ?? NONE,
      row.project_type_name ?? NONE,
    ];
    if (!canWrite) {
      return [
        ...read,
        <StatusBadge key="status" variant={STATUS_VARIANT[row.status] ?? 'neutral'}>
          {statusLabel(row.status)}
        </StatusBadge>,
      ];
    }
    return [
      ...read,
      // The row shows the server's status; it changes when the list is read again.
      <select
        key="status"
        aria-label={`Status of ${row.name}`}
        className={`w-full ${inputCls}`}
        value={row.status}
        disabled={busy}
        onChange={(e) => void changeStatus(row, e.target.value as ProjectStatus)}
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>,
      row.status === 'archived' ? null : (
        <button
          key="edit"
          type="button"
          aria-label={`Edit ${row.name}`}
          className={secondaryButtonCls}
          onClick={() => {
            setNotice(null);
            setForm({ project: row });
          }}
        >
          Edit
        </button>
      ),
    ];
  };

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Your jobs, each with its customer, job type and status."
        right={
          canWrite ? (
            <button
              type="button"
              className={primaryButtonCls}
              onClick={() => {
                setNotice(null);
                setForm({ project: null });
              }}
            >
              New project
            </button>
          ) : undefined
        }
      />

      <NoticeBanner notice={notice} className="mt-4" />

      {canWrite && form && (
        <ProjectForm
          key={form.project?.id ?? 'new'}
          project={form.project}
          onAttempt={() => setNotice(null)}
          onRefused={refused}
          onSaved={() => {
            setForm(null);
            refetch();
          }}
          onClose={() => setForm(null)}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => (
          <FilterChip
            key={filter.value || 'all'}
            active={status === filter.value}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </FilterChip>
        ))}
      </div>

      {error && <ErrorBanner className="mt-4">{error}</ErrorBanner>}

      <Card className="mt-4">
        <TableShell
          columns={columns}
          isEmpty={items.length === 0}
          empty={
            isLoading
              ? 'Loading…'
              : error
                ? 'Nothing to show.'
                : status
                  ? 'No projects with this status.'
                  : 'No projects yet.'
          }
        >
          {items.map((row) => (
            <TableRow key={row.id} columns={columns} cells={cells(row)} />
          ))}
        </TableShell>
      </Card>
      <Pager page={page} pageSize={pageSize} count={count} setPage={setPage} />
    </>
  );
};

export const ProjectsPage: FC = () => {
  const { activeOrgId, activeRole } = useOrgContext();
  const { settings, projectsOn, isLoading, error } = useProjectSettings();

  let body;
  if (projectsOn) {
    // A change of the active org starts the list afresh.
    body = <ProjectsList key={activeOrgId ?? 'none'} canWrite={canWriteProjects(activeRole)} />;
  } else {
    body = (
      <>
        <PageHeader title="Projects" />
        {settings !== null ? (
          <Card padding className="mt-6">
            <h2 className="text-base font-semibold text-gray-900">Projects is turned off</h2>
            <p className="mt-2 text-sm text-gray-600">
              Turn Projects on in <ProjectsSettingsLink /> to see and manage your projects.
            </p>
          </Card>
        ) : error ? (
          <ErrorBanner className="mt-6">{error}</ErrorBanner>
        ) : (
          <p className="mt-6 text-sm text-gray-600">
            {isLoading ? 'Loading…' : 'Projects is not available.'}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-8">{body}</div>
    </div>
  );
};
