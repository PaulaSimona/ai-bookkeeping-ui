// J1c-1 (D-J1C-1, R-J1C-1, R-J1C-4): the Projects page is a Tier 2 route, and
// the app reads projects/settings/ once per load for a Tier 2 user and never
// for anyone else.
//
// This exercises the real route table, OrgProvider, ProjectSettingsProvider
// and Sidebar. The pages are stubbed: what a page shows is its own test.
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { makeStore } from '@/store/store';
import { setInProgress, setUser } from '@/store/features/authSlice';
import App from './App';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
  revokeRefreshToken: vi.fn(),
}));
// The session is seeded straight into the store below.
vi.mock('@/api/user/useUser', () => ({ useUser: () => ({ getUser: vi.fn() }) }));

vi.mock('@/views/accounting/projects/ProjectsPage', () => ({
  ProjectsPage: () => <p>projects page</p>,
}));
vi.mock('@/views/dashboard', () => ({ Dashboard: () => <p>client dashboard page</p> }));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const SETTINGS_URL = '/api/accounting/projects/settings/';

const Probe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
};

const renderAt = (path: string, hasTier2: boolean) => {
  const store = makeStore();
  store.dispatch(
    setUser({
      user: {
        email: 'owner@example.test',
        first_name: 'Olive',
        is_staff: false,
        is_superuser: false,
        has_tier2: hasTier2,
        memberships: hasTier2 ? [{ org_id: ORG, org_name: 'Acme Ltd', role: 'owner' }] : [],
      },
    }),
  );
  store.dispatch(setInProgress(false));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Probe />
      </MemoryRouter>
    </Provider>,
  );
};

const location = () => screen.getByTestId('location').textContent;
const settingsCalls = () => get.mock.calls.filter(([url]) => url === SETTINGS_URL);

const serve = (projectsOn: boolean) => {
  get.mockImplementation((url) => {
    if (url === SETTINGS_URL) {
      return Promise.resolve({
        status: 200,
        data: {
          projects_enabled: projectsOn,
          projects_tracking_from: projectsOn ? '2026-01-01' : null,
          projects_on: projectsOn,
        },
      });
    }
    if (url === '/api/accounting/me/') {
      return Promise.resolve({
        status: 200,
        data: {
          org_id: ORG,
          org_name: 'Acme Ltd',
          role: 'owner',
          base_currency: 'CAD',
          has_tax_profile: true,
          opening_balance_choice: 'none',
        },
      });
    }
    return Promise.resolve({ status: 404, data: {} });
  });
};

beforeEach(() => {
  get.mockReset();
  sessionStorage.clear();
  localStorage.clear();
});

describe('/accounting/projects', () => {
  it('shows a Tier 2 owner the Projects page and the menu item, with one settings read', async () => {
    serve(true);
    renderAt('/accounting/projects', true);

    expect(await screen.findByText('projects page')).toBeInTheDocument();
    expect(location()).toBe('/accounting/projects');
    expect(await screen.findByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/accounting/projects',
    );
    await waitFor(() => expect(settingsCalls()).toHaveLength(1));
  });

  it('shows no menu item while Projects is off, still with one settings read', async () => {
    serve(false);
    renderAt('/accounting/projects', true);

    expect(await screen.findByText('projects page')).toBeInTheDocument();
    await waitFor(() => expect(settingsCalls()).toHaveLength(1));
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
  });

  it('sends a non-Tier-2 user to the dashboard and never reads the Projects settings', async () => {
    serve(true);
    renderAt('/accounting/projects', false);

    expect(await screen.findByText('client dashboard page')).toBeInTheDocument();
    expect(location()).toBe('/dashboard');
    expect(screen.queryByText('projects page')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
    expect(settingsCalls()).toHaveLength(0);
  });
});
