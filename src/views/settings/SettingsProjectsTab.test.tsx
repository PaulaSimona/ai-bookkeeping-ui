// Settings tab registry (J1c-1, D-J1C-1 as amended): a "Projects" tab after
// "Chart of accounts", for an account with Tier 2 only, reachable by
// ?tab=projects.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { makeStore } from '@/store/store';
import { setInProgress, setUser } from '@/store/features/authSlice';
import { Settings } from './index';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));
// What each panel shows is that panel's own test.
vi.mock('./ProjectsSettingsTab', () => ({
  ProjectsSettingsTab: () => <p>projects settings panel</p>,
}));
vi.mock('./ChartOfAccountsPanel', () => ({
  ChartOfAccountsPanel: () => <p>chart of accounts panel</p>,
}));
vi.mock('./UnifiedBusinessProfile', () => ({
  UnifiedBusinessProfile: () => <p>business profile panel</p>,
}));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

const renderSettings = (path: string, hasTier2: boolean) => {
  const store = makeStore();
  store.dispatch(setUser({ user: { email: 'olga@example.test', has_tier2: hasTier2, memberships: [] } }));
  store.dispatch(setInProgress(false));
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Settings />
      </MemoryRouter>
    </Provider>,
  );
};

const tabs = () =>
  within(screen.getByRole('navigation'))
    .getAllByRole('button')
    .map((b) => b.textContent);

beforeAll(() => {
  // jsdom has no layout: the tab bar's scrollIntoView does not exist there.
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ status: 404, data: {} });
});

describe('Settings: Projects tab', () => {
  it('sits right after "Chart of accounts" for an account with Tier 2', () => {
    renderSettings('/settings', true);

    expect(tabs()).toEqual([
      'Business profile',
      'Tax profile',
      'Bank & integrations',
      'Chart of accounts',
      'Projects',
      'Subscription',
      'Security',
      'Team & access',
    ]);
    expect(screen.queryByText('projects settings panel')).not.toBeInTheDocument();
  });

  it('opens from the tab bar', async () => {
    const user = userEvent.setup();
    renderSettings('/settings', true);

    await user.click(screen.getByRole('button', { name: 'Projects' }));

    expect(screen.getByText('projects settings panel')).toBeInTheDocument();
    expect(screen.queryByText('business profile panel')).not.toBeInTheDocument();
  });

  it('opens directly by ?tab=projects', () => {
    renderSettings('/settings?tab=projects', true);

    expect(screen.getByText('projects settings panel')).toBeInTheDocument();
  });

  it('does not exist for an account without Tier 2, even by ?tab=projects', () => {
    renderSettings('/settings?tab=projects', false);

    expect(tabs()).toEqual(['Business profile', 'Bank & integrations', 'Subscription', 'Security']);
    expect(screen.queryByText('projects settings panel')).not.toBeInTheDocument();
  });
});
