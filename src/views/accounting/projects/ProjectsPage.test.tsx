// Projects page (J1c-1, D-J1C-1): the list of projects with a status filter,
// create, edit and status change. Owner and accountant write, a reviewer
// reads; while Projects is off the page says so and links to Settings.
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
import { ProjectsPage } from './ProjectsPage';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const org = vi.hoisted(() => ({ activeOrgId: 'org-1', activeRole: 'owner' as string | null }));
vi.mock('@/context/OrgContext', () => ({ useOrgContext: () => org }));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const PROJECTS_URL = '/api/accounting/projects/';
const CLIENTS_URL = '/api/accounting/counterparties/';
const TYPES_URL = '/api/accounting/project-types/';

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

const ELM = { id: 'c0000000-0000-4000-8000-000000000001', name: 'Elm Homes', archived: false };
const OAK = { id: 'c0000000-0000-4000-8000-000000000002', name: 'Oak Builders', archived: false };
const RENOVATION = { id: '0b0e1c7e-3f0a-4f6e-9a55-000000000001', name: 'Renovation', archived: false };
const NEW_BUILD = { id: '0b0e1c7e-3f0a-4f6e-9a55-000000000002', name: 'New build', archived: false };
const OLD_TYPE = { id: '0b0e1c7e-3f0a-4f6e-9a55-000000000003', name: 'Old type', archived: true };

// ProjectSerializer.
const KITCHEN = {
  id: '5a1d2f1c-0000-4000-8000-000000000001',
  number: 1,
  reference: 'KIT-01',
  name: 'Kitchen at 12 Elm',
  customer_id: ELM.id,
  customer_name: 'Elm Homes',
  project_type_id: RENOVATION.id,
  project_type_name: 'Renovation',
  status: 'active',
  start_date: '2026-11-01',
  end_date: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};
const GARAGE = {
  ...KITCHEN,
  id: '5a1d2f1c-0000-4000-8000-000000000002',
  number: 2,
  reference: '',
  name: 'Garage',
  customer_id: null,
  customer_name: null,
  project_type_id: null,
  project_type_name: null,
  status: 'archived',
  start_date: null,
};

const page = (results: unknown[], count = results.length) => ({
  status: 200,
  data: { count, next: null, previous: null, results },
});

const serve = (projects: unknown[] = [KITCHEN, GARAGE], count?: number) => {
  get.mockImplementation((url) => {
    if (url === PROJECTS_URL) return Promise.resolve(page(projects, count));
    if (url === CLIENTS_URL) return Promise.resolve(page([ELM, OAK]));
    if (url === TYPES_URL) return Promise.resolve(page([NEW_BUILD, OLD_TYPE, RENOVATION]));
    return Promise.resolve({ status: 404, data: {} });
  });
};

const refetch = vi.fn();

const renderPage = (settings: ProjectSettings | null = ON, extra: Partial<ProjectSettingsValue> = {}) => {
  const value: ProjectSettingsValue = {
    settings,
    projectsOn: settings?.projects_on === true,
    isLoading: false,
    error: null,
    refetch,
    save: vi.fn(),
    ...extra,
  };
  return render(
    <MemoryRouter>
      <ProjectSettingsContext.Provider value={value}>
        <ProjectsPage />
      </ProjectSettingsContext.Provider>
    </MemoryRouter>,
  );
};

const listCalls = () => get.mock.calls.filter(([u]) => u === PROJECTS_URL);
// A TableRow of components/t2 is one grid; its cells are the grid's children.
const row = (name: string) => screen.getByText(name).closest('.grid') as HTMLElement;
const form = () => screen.getByRole('form', { name: /project/i });

beforeEach(() => {
  org.activeRole = 'owner';
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  refetch.mockReset();
  serve();
});

describe('Projects page: while Projects is off', () => {
  it('says "Projects is turned off" with a link to Settings → Projects, and reads no project', async () => {
    renderPage(OFF);

    expect(screen.getByRole('heading', { name: 'Projects is turned off' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings → Projects' })).toHaveAttribute(
      'href',
      '/settings?tab=projects',
    );
    expect(screen.queryByRole('button', { name: 'New project' })).not.toBeInTheDocument();
    await waitFor(() => expect(get).not.toHaveBeenCalled());
  });

  it('shows neither the list nor the "turned off" message while the settings load', () => {
    renderPage(null, { isLoading: true });

    expect(screen.queryByRole('heading', { name: 'Projects is turned off' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('shows the read error of the settings instead of "turned off"', () => {
    renderPage(null, { error: 'Not available on your plan.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Not available on your plan.');
    expect(screen.queryByRole('heading', { name: 'Projects is turned off' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('Projects page: the list', () => {
  it('lists number, name, reference, customer, job type and status', async () => {
    renderPage();

    expect(await screen.findByText('Kitchen at 12 Elm')).toBeInTheDocument();
    for (const label of ['Number', 'Name', 'Reference', 'Customer', 'Job type', 'Status']) {
      expect(screen.getByText(label, { selector: 'div' })).toBeInTheDocument();
    }
    const kitchen = row('Kitchen at 12 Elm');
    expect(within(kitchen).getByText('1')).toBeInTheDocument();
    expect(within(kitchen).getByText('KIT-01')).toBeInTheDocument();
    expect(within(kitchen).getByText('Elm Homes')).toBeInTheDocument();
    expect(within(kitchen).getByText('Renovation')).toBeInTheDocument();
    expect(within(kitchen).getByLabelText('Status of Kitchen at 12 Elm')).toHaveValue('active');
    expect(within(row('Garage')).getByLabelText('Status of Garage')).toHaveValue('archived');
    expect(listCalls()[0][1]).toEqual({ params: { page: 1, page_size: 50 } });
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    expect(
      ['All', 'Active', 'On hold', 'Completed', 'Archived'].map(
        (name) => screen.getByRole('button', { name }).textContent,
      ),
    ).toEqual(['All', 'Active', 'On hold', 'Completed', 'Archived']);

    await user.click(screen.getByRole('button', { name: 'On hold' }));
    await waitFor(() =>
      expect(listCalls().at(-1)![1]).toEqual({ params: { status: 'on_hold', page: 1, page_size: 50 } }),
    );

    await user.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() =>
      expect(listCalls().at(-1)![1]).toEqual({ params: { page: 1, page_size: 50 } }),
    );
  });

  it('pages the list', async () => {
    const user = userEvent.setup();
    serve([KITCHEN], 120);
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    expect(screen.getByText('1–50 of 120')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listCalls().at(-1)![1]).toEqual({ params: { page: 2, page_size: 50 } }),
    );
  });

  it('shows the server refusal of the read once', async () => {
    get.mockResolvedValue({ status: 403, data: { detail: 'Not available on your plan.' } });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Not available on your plan.');
    expect(screen.getAllByText('Not available on your plan.')).toHaveLength(1);
  });

  it('has no delete control', async () => {
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    expect(screen.queryByRole('button', { name: /delete|remove/i })).not.toBeInTheDocument();
  });

  it('gives an accountant the write controls', async () => {
    org.activeRole = 'accountant';
    renderPage();

    expect(await screen.findByRole('button', { name: 'Edit Kitchen at 12 Elm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Status of Kitchen at 12 Elm')).toBeEnabled();
  });

  it.each([['reviewer'], [null]])('shows a %s member the list and no write control', async (role) => {
    org.activeRole = role;
    renderPage();

    const kitchen = await screen.findByText('Kitchen at 12 Elm').then(() => row('Kitchen at 12 Elm'));
    expect(within(kitchen).getByText('Active')).toBeInTheDocument();
    expect(within(row('Garage')).getByText('Archived')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New project' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('offers no edit of an archived project', async () => {
    renderPage();
    await screen.findByText('Garage');

    expect(screen.getByRole('button', { name: 'Edit Kitchen at 12 Elm' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Garage' })).not.toBeInTheDocument();
  });
});

describe('Projects page: create', () => {
  it('offers the active clients and the job types that are not archived', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    await user.click(screen.getByRole('button', { name: 'New project' }));

    const customer = within(form()).getByLabelText('Customer');
    await waitFor(() =>
      expect(within(customer).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'No customer',
        'Elm Homes',
        'Oak Builders',
      ]),
    );
    expect(
      within(within(form()).getByLabelText('Job type')).getAllByRole('option').map((o) => o.textContent),
    ).toEqual(['No job type', 'New build', 'Renovation']);
    expect(get).toHaveBeenCalledWith(CLIENTS_URL, {
      params: { role: 'client', archived: 'false', page_size: 200 },
    });
  });

  it('sends every field that was filled in', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 201, data: { ...KITCHEN, id: 'new', number: 3 } });
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');
    const before = listCalls().length;

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await within(form()).findByRole('option', { name: 'Oak Builders' });
    await user.type(within(form()).getByLabelText('Name'), 'Deck at 4 Oak');
    await user.type(within(form()).getByLabelText('Reference'), 'DECK-04');
    await user.selectOptions(within(form()).getByLabelText('Customer'), 'Oak Builders');
    await user.selectOptions(within(form()).getByLabelText('Job type'), 'New build');
    fireEvent.change(within(form()).getByLabelText('Start date'), { target: { value: '2026-11-20' } });
    fireEvent.change(within(form()).getByLabelText('End date'), { target: { value: '2026-12-20' } });
    await user.click(within(form()).getByRole('button', { name: 'Create project' }));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(PROJECTS_URL, {
      name: 'Deck at 4 Oak',
      reference: 'DECK-04',
      customer_id: OAK.id,
      project_type_id: NEW_BUILD.id,
      start_date: '2026-11-20',
      end_date: '2026-12-20',
    });
    // The form closes and the list is read again — the new row comes from the server.
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(listCalls().length).toBe(before + 1);
  });

  it('sends only the name when nothing else was filled in', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ status: 201, data: KITCHEN });
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(within(form()).getByLabelText('Name'), 'Deck at 4 Oak');
    await user.click(within(form()).getByRole('button', { name: 'Create project' }));

    expect(post).toHaveBeenCalledWith(PROJECTS_URL, { name: 'Deck at 4 Oak' });
  });

  it('shows a refusal once in the banner, a field error under its field, and keeps the form', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 400,
      data: { end_date: ['The end date may not be before the start date.'] },
    });
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');
    const before = listCalls().length;

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(within(form()).getByLabelText('Name'), 'Deck at 4 Oak');
    await user.click(within(form()).getByRole('button', { name: 'Create project' }));

    await waitFor(() =>
      expect(within(form()).getByLabelText('End date')).toHaveAccessibleDescription(
        'The end date may not be before the start date.',
      ),
    );
    expect(screen.getAllByText('The end date may not be before the start date.')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(form()).getByLabelText('Name')).toHaveValue('Deck at 4 Oak');
    expect(listCalls().length).toBe(before);

    post.mockResolvedValue({
      status: 409,
      data: { detail: 'Another project already uses this reference.', error_code: 'duplicate_reference' },
    });
    await user.click(within(form()).getByRole('button', { name: 'Create project' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another project already uses this reference.',
    );
    expect(screen.getAllByText('Another project already uses this reference.')).toHaveLength(1);
    // The earlier field error is gone: only what the server said last is shown.
    expect(screen.queryByText('The end date may not be before the start date.')).not.toBeInTheDocument();
    expect(screen.queryByText('duplicate_reference')).not.toBeInTheDocument();
  });

  it('follows the server when it says Projects is off', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 409,
      data: { detail: 'Projects is turned off for this organization.', error_code: 'projects_off' },
    });
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(within(form()).getByLabelText('Name'), 'Deck at 4 Oak');
    await user.click(within(form()).getByRole('button', { name: 'Create project' }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Projects is turned off.');
    expect(within(banner).getByRole('link', { name: 'Settings → Projects' })).toHaveAttribute(
      'href',
      '/settings?tab=projects',
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('Projects page: edit', () => {
  it('opens with the project as the server has it and sends only what changed', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ status: 200, data: KITCHEN });
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');
    const before = listCalls().length;

    await user.click(screen.getByRole('button', { name: 'Edit Kitchen at 12 Elm' }));
    await within(form()).findByRole('option', { name: 'Oak Builders' });
    expect(within(form()).getByLabelText('Name')).toHaveValue('Kitchen at 12 Elm');
    expect(within(form()).getByLabelText('Reference')).toHaveValue('KIT-01');
    expect(within(form()).getByLabelText('Customer')).toHaveValue(ELM.id);
    expect(within(form()).getByLabelText('Job type')).toHaveValue(RENOVATION.id);
    expect(within(form()).getByLabelText('Start date')).toHaveValue('2026-11-01');
    expect(within(form()).getByLabelText('End date')).toHaveValue('');

    await user.selectOptions(within(form()).getByLabelText('Customer'), 'No customer');
    fireEvent.change(within(form()).getByLabelText('End date'), { target: { value: '2026-12-31' } });
    await user.click(within(form()).getByRole('button', { name: 'Save changes' }));

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(`${PROJECTS_URL}${KITCHEN.id}/`, {
      customer_id: null,
      end_date: '2026-12-31',
    });
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(listCalls().length).toBe(before + 1);
  });

  it('sends nothing when nothing changed', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    await user.click(screen.getByRole('button', { name: 'Edit Kitchen at 12 Elm' }));
    await user.click(within(form()).getByRole('button', { name: 'Save changes' }));

    expect(patch).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
  });

  it('keeps a job type that has since been archived as the current choice', async () => {
    const user = userEvent.setup();
    serve([{ ...KITCHEN, project_type_id: OLD_TYPE.id, project_type_name: 'Old type' }]);
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    await user.click(screen.getByRole('button', { name: 'Edit Kitchen at 12 Elm' }));
    await within(form()).findByRole('option', { name: 'Renovation' });

    const jobTypeSelect = within(form()).getByLabelText('Job type');
    expect(jobTypeSelect).toHaveValue(OLD_TYPE.id);
    expect(within(jobTypeSelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'No job type',
      'Old type (current)',
      'New build',
      'Renovation',
    ]);
  });

  it('shows a refusal once and keeps the form open', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({
      status: 400,
      data: { detail: 'This customer is archived and cannot be used.', error_code: 'customer_archived' },
    });
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');

    await user.click(screen.getByRole('button', { name: 'Edit Kitchen at 12 Elm' }));
    await user.clear(within(form()).getByLabelText('Reference'));
    await user.click(within(form()).getByRole('button', { name: 'Save changes' }));

    expect(patch).toHaveBeenCalledWith(`${PROJECTS_URL}${KITCHEN.id}/`, { reference: '' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This customer is archived and cannot be used.',
    );
    expect(screen.getAllByText('This customer is archived and cannot be used.')).toHaveLength(1);
    expect(form()).toBeInTheDocument();
  });
});

describe('Projects page: status change', () => {
  it('offers the four statuses and sends the chosen one, without changing the row itself', async () => {
    const user = userEvent.setup();
    let answer: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');
    const before = listCalls().length;

    const select = screen.getByLabelText('Status of Kitchen at 12 Elm');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Active',
      'On hold',
      'Completed',
      'Archived',
    ]);
    await user.selectOptions(select, 'Completed');

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(`${PROJECTS_URL}${KITCHEN.id}/status/`, { status: 'completed' });
    // Not optimistic: the row shows the server's value until the list is read again.
    expect(screen.getByLabelText('Status of Kitchen at 12 Elm')).toHaveValue('active');

    serve([{ ...KITCHEN, status: 'completed' }, GARAGE]);
    answer({ status: 200, data: { ...KITCHEN, status: 'completed' } });

    await waitFor(() =>
      expect(screen.getByLabelText('Status of Kitchen at 12 Elm')).toHaveValue('completed'),
    );
    expect(listCalls().length).toBe(before + 1);
  });

  it('shows a refusal once and leaves the status as it was', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({
      status: 403,
      data: { detail: 'Only the organization owner or accountant can change projects.' },
    });
    renderPage();
    await screen.findByText('Kitchen at 12 Elm');
    const before = listCalls().length;

    await user.selectOptions(screen.getByLabelText('Status of Kitchen at 12 Elm'), 'On hold');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the organization owner or accountant can change projects.',
    );
    expect(
      screen.getAllByText('Only the organization owner or accountant can change projects.'),
    ).toHaveLength(1);
    expect(screen.getByLabelText('Status of Kitchen at 12 Elm')).toHaveValue('active');
    expect(listCalls().length).toBe(before);
  });
});
