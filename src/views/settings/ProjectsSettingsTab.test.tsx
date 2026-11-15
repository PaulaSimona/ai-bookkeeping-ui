// Settings → Projects (J1c-1, D-J1C-1 as amended): the switch with its tracking
// date, the job types, the job cost category of each account, and the
// explanation — one page. Owner and accountant write, a reviewer reads; the
// server decides and its message is shown once.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  ProjectSettingsContext,
  type ProjectSettings,
  type ProjectSettingsValue,
} from '@/hooks/useProjectSettings';
import { ProjectsSettingsTab } from './ProjectsSettingsTab';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const org = vi.hoisted(() => ({ activeOrgId: 'org-1', activeRole: 'owner' as string | null }));
vi.mock('@/context/OrgContext', () => ({ useOrgContext: () => org }));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const TYPES_URL = '/api/accounting/project-types/';
const CATEGORIES_URL = '/api/accounting/projects/account-categories/';

const ON: ProjectSettings = {
  projects_enabled: true,
  projects_tracking_from: '2026-01-01',
  projects_on: true,
};
const OFF: ProjectSettings = {
  projects_enabled: false,
  projects_tracking_from: null,
  projects_on: false,
};

// ProjectTypeSerializer.
const jobType = (n: number, name: string, archived = false) => ({
  id: `0b0e1c7e-3f0a-4f6e-9a55-00000000000${n}`,
  name,
  archived,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
});
const RENOVATION = jobType(1, 'Renovation');
const OLD_TYPE = jobType(2, 'Old type', true);

// AccountCategorySerializer.
const account = (code: string, name: string, category: string | null, isActive = true) => ({
  account_id: `a0000000-0000-4000-8000-00000000${code}`,
  code,
  name,
  type: 'expense',
  is_active: isActive,
  job_cost_category: category,
});
const MATERIALS = account('5000', 'Materials', 'materials');
const OFFICE = account('6100', 'Office supplies', null);

const page = (results: unknown[]) => ({
  status: 200,
  data: { count: results.length, next: null, previous: null, results },
});

const serve = (types: unknown[] = [RENOVATION, OLD_TYPE], accounts: unknown[] = [MATERIALS, OFFICE]) => {
  get.mockImplementation((url) => {
    if (url === TYPES_URL) return Promise.resolve(page(types));
    if (url === CATEGORIES_URL) return Promise.resolve(page(accounts));
    return Promise.resolve({ status: 404, data: {} });
  });
};

// The answers below are the two keys the screen reads, not a whole axios response.
const save = vi.fn<(payload: unknown) => Promise<{ status: number; data: unknown }>>();
const refetch = vi.fn();

const renderTab = (settings: ProjectSettings | null = ON, extra: Partial<ProjectSettingsValue> = {}) => {
  const value: ProjectSettingsValue = {
    settings,
    projectsOn: settings?.projects_on === true,
    isLoading: false,
    error: null,
    refetch,
    save: save as unknown as ProjectSettingsValue['save'],
    ...extra,
  };
  return render(
    <MemoryRouter>
      <ProjectSettingsContext.Provider value={value}>
        <ProjectsSettingsTab />
      </ProjectSettingsContext.Provider>
    </MemoryRouter>,
  );
};

const card = (heading: string) =>
  screen.getByRole('heading', { level: 2, name: heading }).closest('section')!;
const calls = (url: string) => get.mock.calls.filter(([u]) => u === url).length;

beforeEach(() => {
  org.activeRole = 'owner';
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  save.mockReset();
  refetch.mockReset();
  serve();
});

describe('Settings → Projects: what is on the page', () => {
  it('shows the four cards, in order, to an owner', async () => {
    renderTab();

    expect(await screen.findByText('Renovation')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Projects',
      'Job types',
      'Job cost category by account',
      'How Projects works',
    ]);
    expect(within(card('Projects')).getByText('Projects is on.')).toBeInTheDocument();
    expect(within(card('Projects')).getByLabelText('Turn Projects on')).toBeChecked();
    expect(within(card('Projects')).getByLabelText('Tracking date')).toHaveValue('2026-01-01');
    expect(within(card('How Projects works')).getByText(/tracking date is the day/i)).toBeInTheDocument();
  });

  it('lists the job types and marks an archived one', async () => {
    renderTab();

    const types = card('Job types');
    expect(await within(types).findByText('Renovation')).toBeInTheDocument();
    expect(within(types).getByText('Old type')).toBeInTheDocument();
    expect(within(types).getByText('Archived')).toBeInTheDocument();
    // An archived job type cannot be renamed or archived again.
    expect(within(types).getByRole('button', { name: 'Rename Renovation' })).toBeInTheDocument();
    expect(within(types).queryByRole('button', { name: 'Rename Old type' })).not.toBeInTheDocument();
    expect(within(types).queryByRole('button', { name: 'Archive Old type' })).not.toBeInTheDocument();
  });

  it('lists one row per account, each with the six categories and None', async () => {
    renderTab();

    const select = await screen.findByLabelText('Job cost category for 5000 Materials');
    expect(select).toHaveValue('materials');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'None',
      'Materials',
      'Labour',
      'Subcontractors',
      'Equipment',
      'Permits & fees',
      'Other direct cost',
    ]);
    expect(screen.getByLabelText('Job cost category for 6100 Office supplies')).toHaveValue('');
    // Release 2, not this one.
    expect(screen.queryByText(/apply to existing/i)).not.toBeInTheDocument();
  });

  it('gives an accountant the same write controls as an owner', async () => {
    org.activeRole = 'accountant';
    renderTab();

    expect(await screen.findByRole('button', { name: 'Rename Renovation' })).toBeInTheDocument();
    expect(screen.getByLabelText('Turn Projects on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add job type' })).toBeInTheDocument();
    expect(screen.getByLabelText('Job cost category for 5000 Materials')).toBeEnabled();
  });

  it.each([['reviewer'], [null]])('shows a %s member no write control', async (role) => {
    org.activeRole = role;
    renderTab();

    expect(await screen.findByText('Renovation')).toBeInTheDocument();
    expect(await screen.findByText('Office supplies')).toBeInTheDocument();
    // Everything is still readable.
    expect(screen.getByText('Projects is on.')).toBeInTheDocument();
    expect(screen.getByText('Tracking date: 2026-01-01')).toBeInTheDocument();
    expect(within(card('Job cost category by account')).getByText('Materials', { selector: 'span' })).toBeInTheDocument();
    // And nothing can be changed.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tracking date')).not.toBeInTheDocument();
  });

  it('shows the read error of the settings once, and no switch', async () => {
    renderTab(null, { error: 'Not available on your plan.' });

    expect(await screen.findByText('Not available on your plan.')).toBeInTheDocument();
    expect(screen.getAllByText('Not available on your plan.')).toHaveLength(1);
    expect(screen.queryByLabelText('Turn Projects on')).not.toBeInTheDocument();
  });
});

describe('Settings → Projects: while Projects is off', () => {
  it('disables the job type and category cards, each with a one-line reason', async () => {
    renderTab(OFF);

    const types = card('Job types');
    const categories = card('Job cost category by account');
    expect(await within(types).findByText('Renovation')).toBeInTheDocument();
    expect(within(card('Projects')).getByText('Projects is off.')).toBeInTheDocument();
    expect(within(types).getByText('Turn Projects on to change job types.')).toBeInTheDocument();
    expect(
      within(categories).getByText('Turn Projects on to change job cost categories.'),
    ).toBeInTheDocument();

    expect(within(types).getByLabelText('New job type')).toBeDisabled();
    expect(within(types).getByRole('button', { name: 'Add job type' })).toBeDisabled();
    expect(within(types).getByRole('button', { name: 'Rename Renovation' })).toBeDisabled();
    expect(within(types).getByRole('button', { name: 'Archive Renovation' })).toBeDisabled();
    expect(
      await within(categories).findByLabelText('Job cost category for 5000 Materials'),
    ).toBeDisabled();
  });

  it('does not show the reason lines while Projects is on', async () => {
    renderTab();

    expect(await screen.findByText('Renovation')).toBeInTheDocument();
    expect(screen.queryByText('Turn Projects on to change job types.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Turn Projects on to change job cost categories.'),
    ).not.toBeInTheDocument();
  });
});

describe('Settings → Projects: the switch', () => {
  it('needs a tracking date before Projects can be turned on', async () => {
    const user = userEvent.setup();
    renderTab(OFF);

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled(); // nothing changed yet

    await user.click(screen.getByLabelText('Turn Projects on'));
    expect(screen.getByText('Choose a tracking date to turn Projects on.')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    expect(save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Tracking date'), { target: { value: '2026-01-01' } });
    expect(screen.queryByText('Choose a tracking date to turn Projects on.')).not.toBeInTheDocument();
    expect(saveButton).toBeEnabled();
  });

  it('turns Projects on with its date and lists the accounts that got a default category', async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({
      status: 200,
      data: {
        ...ON,
        default_categories_set: [
          { id: MATERIALS.account_id, code: '5000', category: 'materials' },
          { id: 'a2', code: '5200', category: 'permits_fees' },
        ],
      },
    });
    renderTab(OFF);
    await screen.findByText('Renovation');
    const before = calls(CATEGORIES_URL);

    await user.click(screen.getByLabelText('Turn Projects on'));
    fireEvent.change(screen.getByLabelText('Tracking date'), { target: { value: '2026-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ projects_enabled: true, projects_tracking_from: '2026-01-01' });
    const defaults = await screen.findByRole('list', {
      name: 'Accounts that received a default job cost category',
    });
    expect(within(defaults).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '5000 — Materials',
      '5200 — Permits & fees',
    ]);
    // The account list is read again, so it shows the defaults the server set.
    await waitFor(() => expect(calls(CATEGORIES_URL)).toBe(before + 1));
  });

  it('says so when turning on gave no account a default category', async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({ status: 200, data: { ...ON, default_categories_set: [] } });
    renderTab(OFF);

    await user.click(screen.getByLabelText('Turn Projects on'));
    fireEvent.change(screen.getByLabelText('Tracking date'), { target: { value: '2026-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('No account received a default job cost category.'),
    ).toBeInTheDocument();
  });

  it('says plainly that turning off deletes nothing, and sends only the switch', async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({
      status: 200,
      data: { projects_enabled: false, projects_tracking_from: '2026-01-01', projects_on: false, default_categories_set: [] },
    });
    renderTab(ON);
    expect(screen.queryByText(/deletes nothing/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Turn Projects on'));
    expect(
      screen.getByText(
        'Turning Projects off deletes nothing. Your projects, job types and categories are kept, and the Projects screens are hidden until you turn it on again.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenCalledWith({ projects_enabled: false });
    // Turning off sets no default, so no list of defaults is shown.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.queryByText(/received a default job cost category/)).not.toBeInTheDocument();
  });

  it('sends only the date when only the date changed', async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({
      status: 200,
      data: { ...ON, projects_tracking_from: '2026-02-01', default_categories_set: [] },
    });
    renderTab(ON);

    fireEvent.change(screen.getByLabelText('Tracking date'), { target: { value: '2026-02-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(save).toHaveBeenCalledWith({ projects_tracking_from: '2026-02-01' });
  });

  it('shows a refusal once in the banner and a field error under its field', async () => {
    const user = userEvent.setup();
    save.mockResolvedValue({
      status: 400,
      data: {
        detail: 'A tracking start date is required while Projects is turned on.',
        error_code: 'tracking_date_required',
        projects_tracking_from: ['Date has wrong format.'],
      },
    });
    renderTab(ON);

    fireEvent.change(screen.getByLabelText('Tracking date'), { target: { value: '2026-02-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('A tracking start date is required while Projects is turned on.');
    expect(
      screen.getAllByText('A tracking start date is required while Projects is turned on.'),
    ).toHaveLength(1);
    expect(screen.getAllByText('Date has wrong format.')).toHaveLength(1);
    expect(screen.getByLabelText('Tracking date')).toHaveAccessibleDescription('Date has wrong format.');
    // The form keeps what was typed; nothing was applied.
    expect(screen.getByLabelText('Tracking date')).toHaveValue('2026-02-01');
    expect(screen.queryByText('tracking_date_required')).not.toBeInTheDocument();
  });
});

describe('Settings → Projects: job types', () => {
  it('adds a job type and reads the list again', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 201, data: jobType(3, 'New build') });
    renderTab();
    await screen.findByText('Renovation');
    const before = calls(TYPES_URL);

    await user.type(screen.getByLabelText('New job type'), 'New build');
    await user.click(screen.getByRole('button', { name: 'Add job type' }));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(TYPES_URL, { name: 'New build' });
    await waitFor(() => expect(calls(TYPES_URL)).toBe(before + 1));
    expect(screen.getByLabelText('New job type')).toHaveValue('');
  });

  it('does not show a new job type until the server has it', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 409,
      data: { detail: 'A job type with this name already exists.', error_code: 'duplicate_name' },
    });
    renderTab();
    await screen.findByText('Renovation');
    const before = calls(TYPES_URL);

    await user.type(screen.getByLabelText('New job type'), 'renovation');
    await user.click(screen.getByRole('button', { name: 'Add job type' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A job type with this name already exists.',
    );
    expect(screen.getAllByText('A job type with this name already exists.')).toHaveLength(1);
    expect(screen.queryByText('duplicate_name')).not.toBeInTheDocument();
    expect(calls(TYPES_URL)).toBe(before);
    // What was typed is kept, so it can be corrected.
    expect(screen.getByLabelText('New job type')).toHaveValue('renovation');
  });

  it('shows a field error of the name under the name, not in the banner', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 400,
      data: { name: ['Ensure this field has no more than 100 characters.'] },
    });
    renderTab();
    await screen.findByText('Renovation');

    await user.type(screen.getByLabelText('New job type'), 'x');
    await user.click(screen.getByRole('button', { name: 'Add job type' }));

    await waitFor(() =>
      expect(screen.getByLabelText('New job type')).toHaveAccessibleDescription(
        'Ensure this field has no more than 100 characters.',
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renames a job type', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ status: 200, data: { ...RENOVATION, name: 'Renovations' } });
    renderTab();
    const before = await screen.findByText('Renovation').then(() => calls(TYPES_URL));

    await user.click(screen.getByRole('button', { name: 'Rename Renovation' }));
    const input = screen.getByLabelText('New name for Renovation');
    expect(input).toHaveValue('Renovation');
    await user.clear(input);
    await user.type(input, 'Renovations');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(`${TYPES_URL}${RENOVATION.id}/`, { name: 'Renovations' });
    await waitFor(() => expect(calls(TYPES_URL)).toBe(before + 1));
    expect(screen.queryByLabelText('New name for Renovation')).not.toBeInTheDocument();
  });

  it('archives a job type only after a second, explicit step', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 200, data: { ...RENOVATION, archived: true } });
    renderTab();
    const before = await screen.findByText('Renovation').then(() => calls(TYPES_URL));

    await user.click(screen.getByRole('button', { name: 'Archive Renovation' }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be restored here/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm archive' }));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(`${TYPES_URL}${RENOVATION.id}/archive/`, {});
    await waitFor(() => expect(calls(TYPES_URL)).toBe(before + 1));
  });

  it('shows the "turned off" message with the link when the server says Projects is off', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 409,
      data: { detail: 'Projects is turned off for this organization.', error_code: 'projects_off' },
    });
    renderTab();
    await screen.findByText('Renovation');

    await user.type(screen.getByLabelText('New job type'), 'New build');
    await user.click(screen.getByRole('button', { name: 'Add job type' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Projects is turned off.');
    expect(within(banner).getByRole('link', { name: 'Settings → Projects' })).toHaveAttribute(
      'href',
      '/settings?tab=projects',
    );
    // The shared "Projects is on" value is read again, so the menu follows.
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('Settings → Projects: job cost category by account', () => {
  it('sets a category, shows the server count of posted lines, and is not optimistic', async () => {
    const user = userEvent.setup();
    let answer: (value: unknown) => void = () => {};
    patch.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    renderTab();
    const select = await screen.findByLabelText('Job cost category for 6100 Office supplies');
    const before = calls(CATEGORIES_URL);

    await user.selectOptions(select, 'labour');

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(
      `/api/accounting/accounts/${OFFICE.account_id}/job-cost-category/`,
      { job_cost_category: 'labour' },
    );
    // Until the server answers, the row still shows what the server last said.
    expect(screen.getByLabelText('Job cost category for 6100 Office supplies')).toHaveValue('');

    serve([RENOVATION, OLD_TYPE], [MATERIALS, { ...OFFICE, job_cost_category: 'labour' }]);
    answer({
      status: 200,
      data: { id: OFFICE.account_id, code: '6100', job_cost_category: 'labour', posted_lines_not_affected: 3 },
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      '6100 saved as Labour. Posted lines not affected: 3.',
    );
    await waitFor(() => expect(calls(CATEGORIES_URL)).toBe(before + 1));
    await waitFor(() =>
      expect(screen.getByLabelText('Job cost category for 6100 Office supplies')).toHaveValue('labour'),
    );
  });

  it('clears a category with null when None is chosen', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({
      status: 200,
      data: { id: MATERIALS.account_id, code: '5000', job_cost_category: null, posted_lines_not_affected: 0 },
    });
    renderTab();

    await user.selectOptions(await screen.findByLabelText('Job cost category for 5000 Materials'), 'None');

    expect(patch).toHaveBeenCalledWith(
      `/api/accounting/accounts/${MATERIALS.account_id}/job-cost-category/`,
      { job_cost_category: null },
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      '5000 saved as None. Posted lines not affected: 0.',
    );
  });

  it('shows a refusal once and leaves the row as the server has it', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({
      status: 400,
      data: { detail: 'This account cannot carry a job cost category.', error_code: 'not_categorizable' },
    });
    renderTab();
    const before = await screen
      .findByLabelText('Job cost category for 6100 Office supplies')
      .then(() => calls(CATEGORIES_URL));

    await user.selectOptions(screen.getByLabelText('Job cost category for 6100 Office supplies'), 'labour');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account cannot carry a job cost category.',
    );
    expect(screen.getAllByText('This account cannot carry a job cost category.')).toHaveLength(1);
    expect(screen.getByLabelText('Job cost category for 6100 Office supplies')).toHaveValue('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(calls(CATEGORIES_URL)).toBe(before);
  });
});
