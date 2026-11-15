// ProjectSettingsProvider (J1c-1, R-J1C-1): "Projects is on" for the Sidebar
// and the pages — one read per app load for a Tier 2 user, refreshed after a
// settings change and when the active org changes; never for anyone else.
import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { makeStore } from '@/store/store';
import { setInProgress, setUser } from '@/store/features/authSlice';
import { useProjectSettings, type ProjectSettingsValue } from '@/hooks/useProjectSettings';
import { ProjectSettingsProvider } from './ProjectSettingsProvider';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const org = vi.hoisted(() => ({ activeOrgId: 'org-1' as string | null }));
vi.mock('@/context/OrgContext', () => ({ useOrgContext: () => org }));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const URL = '/api/accounting/projects/settings/';
const ON = { projects_enabled: true, projects_tracking_from: '2026-01-01', projects_on: true };
const OFF = { projects_enabled: false, projects_tracking_from: null, projects_on: false };

let seen: ProjectSettingsValue;
const Probe = () => {
  seen = useProjectSettings();
  return (
    <output data-testid="state">
      {seen.isLoading ? 'loading' : seen.error ? `error: ${seen.error}` : seen.projectsOn ? 'on' : 'off'}
    </output>
  );
};

const tree = (hasTier2: boolean) => {
  const store = makeStore();
  store.dispatch(setUser({ user: { email: 'o@example.test', has_tier2: hasTier2, memberships: [] } }));
  store.dispatch(setInProgress(false));
  return (
    <Provider store={store}>
      <ProjectSettingsProvider>
        <Probe />
      </ProjectSettingsProvider>
    </Provider>
  );
};

const state = () => screen.getByTestId('state').textContent;
const settingsCalls = () => get.mock.calls.filter(([url]) => url === URL).length;

beforeEach(() => {
  org.activeOrgId = 'org-1';
  get.mockReset();
  patch.mockReset();
  get.mockResolvedValue({ status: 200, data: ON });
});

describe('ProjectSettingsProvider', () => {
  it('reads the settings once for a Tier 2 user and says Projects is on', async () => {
    const { rerender } = render(tree(true));
    expect(state()).toBe('loading');

    await waitFor(() => expect(state()).toBe('on'));
    expect(seen.settings).toEqual(ON);

    rerender(tree(true));
    await waitFor(() => expect(state()).toBe('on'));
    expect(settingsCalls()).toBe(1);
  });

  it('says Projects is off when the server says so', async () => {
    get.mockResolvedValue({ status: 200, data: OFF });
    render(tree(true));

    await waitFor(() => expect(state()).toBe('off'));
    expect(seen.settings).toEqual(OFF);
  });

  it('makes no call at all for a user without Tier 2', async () => {
    render(tree(false));

    expect(state()).toBe('off');
    await act(async () => {
      await Promise.resolve();
    });
    expect(get).not.toHaveBeenCalled();
    expect(state()).toBe('off');
  });

  it('makes no call while no organization is active', async () => {
    org.activeOrgId = null;
    render(tree(true));

    await act(async () => {
      await Promise.resolve();
    });
    expect(get).not.toHaveBeenCalled();
    expect(state()).toBe('off');
  });

  it('reads again when the active org changes, and never shows the old org value', async () => {
    const { rerender } = render(tree(true));
    await waitFor(() => expect(state()).toBe('on'));

    let answer: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    org.activeOrgId = 'org-2';
    rerender(tree(true));

    // The first org's "on" is not carried over while the second is loading.
    expect(state()).toBe('loading');
    expect(seen.projectsOn).toBe(false);
    await waitFor(() => expect(settingsCalls()).toBe(2));

    await act(async () => {
      answer({ status: 200, data: OFF });
    });
    expect(state()).toBe('off');
  });

  it('reads again on refetch', async () => {
    render(tree(true));
    await waitFor(() => expect(state()).toBe('on'));

    get.mockResolvedValue({ status: 200, data: OFF });
    act(() => seen.refetch());

    await waitFor(() => expect(state()).toBe('off'));
    expect(settingsCalls()).toBe(2);
  });

  it('applies a saved change from the server answer', async () => {
    get.mockResolvedValue({ status: 200, data: OFF });
    render(tree(true));
    await waitFor(() => expect(state()).toBe('off'));

    const answer = {
      status: 200,
      data: { ...ON, default_categories_set: [{ id: 'a1', code: '5000', category: 'materials' }] },
    };
    patch.mockResolvedValue(answer);
    let returned: unknown;
    await act(async () => {
      returned = await seen.save({ projects_enabled: true, projects_tracking_from: '2026-01-01' });
    });

    expect(patch).toHaveBeenCalledWith(URL, {
      projects_enabled: true,
      projects_tracking_from: '2026-01-01',
    });
    // The caller gets the whole answer, with the list of defaults that were set.
    expect(returned).toBe(answer);
    expect(state()).toBe('on');
    expect(seen.settings).toEqual(ON);
  });

  it('changes nothing when the server refuses the change', async () => {
    render(tree(true));
    await waitFor(() => expect(state()).toBe('on'));

    const refusal = {
      status: 403,
      data: { detail: 'Only the organization owner or accountant can change projects.' },
    };
    patch.mockResolvedValue(refusal);
    let returned: unknown;
    await act(async () => {
      returned = await seen.save({ projects_enabled: false });
    });

    expect(returned).toBe(refusal);
    expect(state()).toBe('on');
    expect(seen.settings).toEqual(ON);
  });

  it('carries the server refusal of the read and says Projects is off', async () => {
    get.mockResolvedValue({ status: 403, data: { detail: 'Not available on your plan.' } });
    render(tree(true));

    await waitFor(() => expect(state()).toBe('error: Not available on your plan.'));
    expect(seen.projectsOn).toBe(false);
  });
});
