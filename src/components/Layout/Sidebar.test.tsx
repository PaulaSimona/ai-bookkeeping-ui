// Sidebar "Projects" item (J1c-1, D-J1C-1 as amended, R2 of Prompt 34): one
// item after Invoices, for a Tier 2 user, only while Projects is on. Nothing
// is added to the accountant menu, and a user without Tier 2 sees no change.
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { makeStore } from '@/store/store';
import { setInProgress, setUser } from '@/store/features/authSlice';
import { OrgProvider } from '@/context/OrgContext';
import { ProjectSettingsContext, type ProjectSettingsValue } from '@/hooks/useProjectSettings';
import { Sidebar } from './Sidebar';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  revokeRefreshToken: vi.fn(),
}));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

const projects = (on: boolean): ProjectSettingsValue => ({
  settings: {
    projects_enabled: on,
    projects_tracking_from: on ? '2026-01-01' : null,
    projects_on: on,
  },
  projectsOn: on,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  save: vi.fn(),
});

const renderSidebar = async (opts: { hasTier2: boolean; role: string | null; on: boolean }) => {
  const store = makeStore();
  store.dispatch(
    setUser({
      user: {
        email: 'olga@example.test',
        first_name: 'Olga',
        has_tier2: opts.hasTier2,
        memberships: opts.role ? [{ org_id: 'org-1', org_name: 'Acme Ltd', role: opts.role }] : [],
      },
    }),
  );
  store.dispatch(setInProgress(false));
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/support']}>
        <OrgProvider>
          <ProjectSettingsContext.Provider value={projects(opts.on)}>
            <Sidebar />
          </ProjectSettingsContext.Provider>
        </OrgProvider>
      </MemoryRouter>
    </Provider>,
  );
  // The staff entry point asks once who the user is; wait for it to settle.
  await waitFor(() => expect(get).toHaveBeenCalledWith('/api/accounting/staff/me/'));
  await waitFor(() => expect(get.mock.results[0].type).toBe('return'));
  return view;
};

const links = () => screen.getAllByRole('link').map((a) => a.textContent);

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ status: 404, data: {} });
});

describe('Sidebar: Projects item', () => {
  it('shows "Projects" right after Invoices while Projects is on', async () => {
    await renderSidebar({ hasTier2: true, role: 'owner', on: true });

    const item = screen.getByRole('link', { name: 'Projects' });
    expect(item).toHaveAttribute('href', '/accounting/projects');
    const menu = links();
    expect(menu.slice(menu.indexOf('Suppliers'), menu.indexOf('Reports') + 1)).toEqual([
      'Suppliers',
      'Invoices',
      'Projects',
      'Reports',
    ]);
  });

  it('does not show "Projects" while Projects is off, and changes nothing else', async () => {
    const on = await renderSidebar({ hasTier2: true, role: 'owner', on: true });
    const withItem = links();
    on.unmount();

    await renderSidebar({ hasTier2: true, role: 'owner', on: false });

    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
    expect(links()).toEqual(withItem.filter((label) => label !== 'Projects'));
  });

  it('shows a reviewer member the item too — the page itself hides the write controls', async () => {
    await renderSidebar({ hasTier2: true, role: 'reviewer', on: true });

    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
  });

  it('adds nothing to the menu of a user without Tier 2, whatever the value says', async () => {
    const off = await renderSidebar({ hasTier2: false, role: null, on: false });
    const markup = off.container.innerHTML;
    off.unmount();

    const on = await renderSidebar({ hasTier2: false, role: null, on: true });

    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
    expect(on.container.innerHTML).toBe(markup);
  });

  it('adds nothing to the accountant menu (release 1)', async () => {
    const off = await renderSidebar({ hasTier2: true, role: 'accountant', on: false });
    const markup = off.container.innerHTML;
    off.unmount();

    const on = await renderSidebar({ hasTier2: true, role: 'accountant', on: true });

    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
    expect(on.container.innerHTML).toBe(markup);
  });
});
