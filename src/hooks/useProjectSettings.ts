// useProjectSettings (J1c-1, R-J1C-1) — the Projects switch of the active org:
// whether Projects is on, and its tracking date. Client lane only; nothing
// here is shared with the staff surfaces.
//
// The value is read once per app load by ProjectSettingsProvider
// (context/ProjectSettingsProvider) and handed to the Sidebar and the pages
// through this hook. Without a provider the hook says "off" and calls nothing.
// The two calls follow the house write pattern (api util; the interceptor
// resolves non-401 errors, so callers status-check).
import { createContext, useContext } from 'react';
import api from '@/utils/api';

const SETTINGS_URL = '/api/accounting/projects/settings/';

// Typed per the projects/settings/ body (project_views._settings_body).
export interface ProjectSettings {
  projects_enabled: boolean;
  projects_tracking_from: string | null;
  // The server's own "on": enabled AND a tracking date is set.
  projects_on: boolean;
}

export interface ProjectSettingsPayload {
  projects_enabled?: boolean;
  projects_tracking_from?: string | null;
}

// One account that received a default job cost category when Projects was
// turned on (R5b) — part of the PATCH answer only.
export interface DefaultCategorySet {
  id: string;
  code: string;
  category: string;
}

export const fetchProjectSettings = () => api.get(SETTINGS_URL);

export const patchProjectSettings = (payload: ProjectSettingsPayload) =>
  api.patch(SETTINGS_URL, payload);

export interface ProjectSettingsValue {
  settings: ProjectSettings | null;
  projectsOn: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  // Sends the change and, when the server accepts it, applies the server's
  // answer to the shared value. Returns the api response; callers status-check.
  save: (payload: ProjectSettingsPayload) => ReturnType<typeof patchProjectSettings>;
}

export const ProjectSettingsContext = createContext<ProjectSettingsValue>({
  settings: null,
  projectsOn: false,
  isLoading: false,
  error: null,
  refetch: () => {},
  save: patchProjectSettings,
});

export const useProjectSettings = (): ProjectSettingsValue => useContext(ProjectSettingsContext);
