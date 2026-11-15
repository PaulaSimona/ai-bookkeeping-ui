// useProjects (J1c-1) — the org's projects: the paged list, its writes, and
// the two pick lists of the project form. Client lane only. House pattern:
// usePaginatedList for the list; writes return the api promise and the caller
// status-checks (the interceptor resolves non-401 errors).
import { useEffect, useState } from 'react';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import api from '@/utils/api';

const PROJECTS_URL = '/api/accounting/projects/';

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

// Typed per ProjectSerializer.
export interface ProjectRow {
  id: string;
  number: number;
  reference: string;
  name: string;
  customer_id: string | null;
  customer_name: string | null;
  project_type_id: string | null;
  project_type_name: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFilters {
  status?: ProjectStatus;
}

export const useProjects = (filters: ProjectFilters) => {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  return usePaginatedList<ProjectRow>(PROJECTS_URL, params);
};

// Typed per ProjectWriteSerializer. Status is not a field here: it changes
// through its own route.
export interface ProjectPayload {
  name: string;
  reference?: string;
  customer_id?: string | null;
  project_type_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export const createProject = (payload: ProjectPayload) => api.post(PROJECTS_URL, payload);

export const updateProject = (id: string, payload: Partial<ProjectPayload>) =>
  api.patch(`${PROJECTS_URL}${id}/`, payload);

export const setProjectStatus = (id: string, status: ProjectStatus) =>
  api.post(`${PROJECTS_URL}${id}/status/`, { status });

// ── Pick lists of the project form ───────────────────────────────────────────
export interface ProjectOption {
  id: string;
  name: string;
}

interface FormOptions {
  customers: ProjectOption[];
  jobTypes: ProjectOption[];
  // A pick list has more rows than the one page read here.
  truncated: boolean;
  isLoading: boolean;
  error: string | null;
}

// The server's largest page (AccountingPagination.max_page_size).
const PICK_LIST_PAGE_SIZE = 200;
const LOAD_FAILED = 'Could not load the customers and job types.';

// The org's active clients and its job types that are not archived, one page
// each. A refused read offers nothing and carries the server's reason.
export const useProjectFormOptions = (): FormOptions => {
  const [options, setOptions] = useState<FormOptions>({
    customers: [],
    jobTypes: [],
    truncated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const failed = (error: string) =>
      setOptions({ customers: [], jobTypes: [], truncated: false, isLoading: false, error });

    Promise.all([
      api.get('/api/accounting/counterparties/', {
        params: { role: 'client', archived: 'false', page_size: PICK_LIST_PAGE_SIZE },
      }),
      api.get('/api/accounting/project-types/', { params: { page_size: PICK_LIST_PAGE_SIZE } }),
    ])
      .then(([clients, types]) => {
        if (cancelled) return;
        const refused = [clients, types].find((res) => res?.status !== 200);
        if (clients == null || types == null || refused) {
          failed(refused?.data?.detail ?? LOAD_FAILED);
          return;
        }
        const rowsOf = (res: typeof clients): { id: string; name: string; archived?: boolean }[] =>
          Array.isArray(res.data?.results) ? res.data.results : [];
        const longer = (res: typeof clients) =>
          typeof res.data?.count === 'number' && res.data.count > rowsOf(res).length;
        const option = ({ id, name }: ProjectOption): ProjectOption => ({ id, name });
        setOptions({
          customers: rowsOf(clients).map(option),
          jobTypes: rowsOf(types).filter((row) => !row.archived).map(option),
          truncated: longer(clients) || longer(types),
          isLoading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (!cancelled) failed(err?.response?.data?.detail ?? LOAD_FAILED);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return options;
};
