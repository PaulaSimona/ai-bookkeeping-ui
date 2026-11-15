// useProjects (J1c-1): the project list, its writes, and the two pick lists of
// the project form.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import {
  createProject,
  setProjectStatus,
  updateProject,
  useProjectFormOptions,
  useProjects,
} from './useProjects';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

type Config = { params?: Record<string, unknown> };
const get = api.get as unknown as Mock<(url: string, config?: Config) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

// ProjectSerializer.
const PROJECT = {
  id: '5a1d2f1c-0000-4000-8000-000000000001',
  number: 1,
  reference: 'KIT-01',
  name: 'Kitchen at 12 Elm',
  customer_id: 'c0000000-0000-4000-8000-000000000001',
  customer_name: 'Elm Homes',
  project_type_id: '0b0e1c7e-3f0a-4f6e-9a55-000000000001',
  project_type_name: 'Renovation',
  status: 'active',
  start_date: '2026-11-01',
  end_date: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

const page = (results: unknown[], count = results.length) => ({
  status: 200,
  data: { count, next: null, previous: null, results },
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
});

describe('useProjects', () => {
  it('reads every project when no status is chosen', async () => {
    get.mockResolvedValue(page([PROJECT]));

    const { result } = renderHook(() => useProjects({}));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([PROJECT]);
    expect(get).toHaveBeenCalledWith('/api/accounting/projects/', {
      params: { page: 1, page_size: 50 },
    });
  });

  it('sends the chosen status as the status filter', async () => {
    get.mockResolvedValue(page([]));

    const { result } = renderHook(() => useProjects({ status: 'on_hold' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(get).toHaveBeenCalledWith('/api/accounting/projects/', {
      params: { status: 'on_hold', page: 1, page_size: 50 },
    });
  });

  it('creates, changes and re-statuses with the bodies the server declares', async () => {
    post.mockResolvedValue({ status: 201, data: PROJECT });
    patch.mockResolvedValue({ status: 200, data: PROJECT });

    await createProject({ name: 'Kitchen at 12 Elm', reference: 'KIT-01' });
    await updateProject(PROJECT.id, { end_date: '2026-12-31', customer_id: null });
    await setProjectStatus(PROJECT.id, 'completed');

    expect(post).toHaveBeenNthCalledWith(1, '/api/accounting/projects/', {
      name: 'Kitchen at 12 Elm',
      reference: 'KIT-01',
    });
    expect(patch).toHaveBeenCalledWith(`/api/accounting/projects/${PROJECT.id}/`, {
      end_date: '2026-12-31',
      customer_id: null,
    });
    expect(post).toHaveBeenNthCalledWith(2, `/api/accounting/projects/${PROJECT.id}/status/`, {
      status: 'completed',
    });
  });
});

describe('useProjectFormOptions', () => {
  it('offers the active clients and the job types that are not archived', async () => {
    get.mockImplementation((url) => {
      if (url === '/api/accounting/counterparties/') {
        return Promise.resolve(page([{ id: 'c1', name: 'Elm Homes', archived: false }]));
      }
      if (url === '/api/accounting/project-types/') {
        return Promise.resolve(
          page([
            { id: 't1', name: 'New build', archived: true },
            { id: 't2', name: 'Renovation', archived: false },
          ]),
        );
      }
      return Promise.resolve({ status: 404, data: {} });
    });

    const { result } = renderHook(() => useProjectFormOptions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.customers).toEqual([{ id: 'c1', name: 'Elm Homes' }]);
    expect(result.current.jobTypes).toEqual([{ id: 't2', name: 'Renovation' }]);
    expect(result.current.truncated).toBe(false);
    expect(get).toHaveBeenCalledWith('/api/accounting/counterparties/', {
      params: { role: 'client', archived: 'false', page_size: 200 },
    });
    expect(get).toHaveBeenCalledWith('/api/accounting/project-types/', {
      params: { page_size: 200 },
    });
  });

  it('says so when a pick list is longer than one page', async () => {
    get.mockImplementation((url) =>
      Promise.resolve(
        url === '/api/accounting/counterparties/'
          ? page([{ id: 'c1', name: 'Elm Homes', archived: false }], 201)
          : page([]),
      ),
    );

    const { result } = renderHook(() => useProjectFormOptions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.truncated).toBe(true);
  });

  it('offers nothing, and an error, when a pick list is refused', async () => {
    get.mockResolvedValue({ status: 403, data: { detail: 'Not available on your plan.' } });

    const { result } = renderHook(() => useProjectFormOptions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.customers).toEqual([]);
    expect(result.current.jobTypes).toEqual([]);
    expect(result.current.error).toBe('Not available on your plan.');
  });
});
