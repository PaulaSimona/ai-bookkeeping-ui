// useProjectSettings (J1c-1, R-J1C-1): the two calls of the Projects switch and
// the value a screen reads when no provider is mounted.
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  fetchProjectSettings,
  patchProjectSettings,
  useProjectSettings,
} from './useProjectSettings';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const URL = '/api/accounting/projects/settings/';

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});

describe('useProjectSettings', () => {
  it('reads the settings with one GET', async () => {
    const body = { projects_enabled: true, projects_tracking_from: '2026-01-01', projects_on: true };
    get.mockResolvedValue({ status: 200, data: body });

    const res = await fetchProjectSettings();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(URL);
    expect(res.data).toEqual(body);
  });

  it('sends a change as a PATCH of exactly the keys given', async () => {
    patch.mockResolvedValue({ status: 200, data: {} });

    await patchProjectSettings({ projects_enabled: true, projects_tracking_from: '2026-01-01' });
    await patchProjectSettings({ projects_enabled: false });

    expect(patch).toHaveBeenNthCalledWith(1, URL, {
      projects_enabled: true,
      projects_tracking_from: '2026-01-01',
    });
    expect(patch).toHaveBeenNthCalledWith(2, URL, { projects_enabled: false });
  });

  it('says Projects is off, and calls nothing, when no provider is mounted', () => {
    const { result } = renderHook(() => useProjectSettings());

    expect(result.current.projectsOn).toBe(false);
    expect(result.current.settings).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
