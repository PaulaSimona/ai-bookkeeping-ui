// useProjectTypes (J1c-1): the job type list and its three writes.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  archiveProjectType,
  createProjectType,
  renameProjectType,
  useProjectTypes,
} from './useProjectTypes';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

// ProjectTypeSerializer.
const RENOVATION = {
  id: '0b0e1c7e-3f0a-4f6e-9a55-000000000001',
  name: 'Renovation',
  archived: false,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
});

describe('useProjectTypes', () => {
  it('reads the job types as a paged list', async () => {
    get.mockResolvedValue({
      status: 200,
      data: { count: 1, next: null, previous: null, results: [RENOVATION] },
    });

    const { result } = renderHook(() => useProjectTypes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([RENOVATION]);
    expect(result.current.count).toBe(1);
    expect(get).toHaveBeenCalledWith('/api/accounting/project-types/', {
      params: { page: 1, page_size: 50 },
    });
  });

  it('carries the server refusal of the read', async () => {
    get.mockResolvedValue({ status: 403, data: { detail: 'Not available on your plan.' } });

    const { result } = renderHook(() => useProjectTypes());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('Not available on your plan.');
  });

  it('adds, renames and archives with the bodies the server declares', async () => {
    post.mockResolvedValue({ status: 201, data: RENOVATION });
    patch.mockResolvedValue({ status: 200, data: RENOVATION });

    await createProjectType('Renovation');
    await renameProjectType(RENOVATION.id, 'Renovations');
    await archiveProjectType(RENOVATION.id);

    expect(post).toHaveBeenNthCalledWith(1, '/api/accounting/project-types/', { name: 'Renovation' });
    expect(patch).toHaveBeenCalledWith(`/api/accounting/project-types/${RENOVATION.id}/`, {
      name: 'Renovations',
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/api/accounting/project-types/${RENOVATION.id}/archive/`,
      {},
    );
  });
});
