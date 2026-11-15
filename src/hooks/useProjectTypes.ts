// useProjectTypes (J1c-1) — the org's job types (the server calls them project
// types; the word on screen is "Job type", D-J1C-2). Client lane only. A thin
// typed wrapper over usePaginatedList, with the house write pattern (api util;
// the interceptor resolves non-401 errors, so callers status-check).
import { usePaginatedList } from '@/hooks/usePaginatedList';
import api from '@/utils/api';

const TYPES_URL = '/api/accounting/project-types/';

// Typed per ProjectTypeSerializer.
export interface ProjectTypeRow {
  id: string;
  name: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export const useProjectTypes = () => usePaginatedList<ProjectTypeRow>(TYPES_URL);

export const createProjectType = (name: string) => api.post(TYPES_URL, { name });

export const renameProjectType = (id: string, name: string) =>
  api.patch(`${TYPES_URL}${id}/`, { name });

// The archive route takes an empty body and refuses any key. There is no
// route that brings an archived job type back.
export const archiveProjectType = (id: string) => api.post(`${TYPES_URL}${id}/archive/`, {});
