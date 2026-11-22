// A client's projects for staff (S98 P1d item 1). Every fixture is invented.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { useStaffOrgProjects } from './useStaffOrgProjects';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;

const ORG = '11111111-1111-4111-8111-111111111111';
const PROJECT = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  number: 7,
  reference: 'P-0007',
  name: 'Invented Deck Build',
  customer_name: null,
  status: 'active',
};

beforeEach(() => {
  get.mockReset();
});

describe("a client's projects for staff", () => {
  it("reads one page of the org's projects from the staff URL", async () => {
    get.mockResolvedValue({
      status: 200,
      data: { count: 230, next: null, previous: null, results: [PROJECT] },
    });

    const { result } = renderHook(() => useStaffOrgProjects(ORG));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(`/api/accounting/staff/orgs/${ORG}/projects/`, {
      params: { page: 1, page_size: 200 },
    });
    expect(result.current.projects).toEqual([PROJECT]);
    // The server's total, so a caller can say the list is not all of them.
    expect(result.current.count).toBe(230);
  });

  it('reads nothing until it has an org', () => {
    const { result } = renderHook(() => useStaffOrgProjects(null));

    expect(get).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('checks the status: an error response and a lost connection are errors', async () => {
    get.mockResolvedValueOnce({ status: 404, data: { detail: 'Not found.' } });
    const refused = renderHook(() => useStaffOrgProjects(ORG));
    await waitFor(() => expect(refused.result.current.isLoading).toBe(false));
    expect(refused.result.current.error).toBe('Could not load the projects.');
    expect(refused.result.current.projects).toEqual([]);

    get.mockRejectedValueOnce(new Error('network down'));
    const lost = renderHook(() => useStaffOrgProjects(ORG));
    await waitFor(() => expect(lost.result.current.isLoading).toBe(false));
    expect(lost.result.current.error).toBe('Could not load the projects.');
  });
});
