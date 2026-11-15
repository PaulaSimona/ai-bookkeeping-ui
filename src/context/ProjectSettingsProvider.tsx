// ProjectSettingsProvider (J1c-1, R-J1C-1) — makes "Projects is on" available
// to the Sidebar and the pages (read through hooks/useProjectSettings).
//
// One GET projects/settings/ per app load for a user with Tier 2 and an active
// org; read again when the active org changes and on refetch(); a saved change
// is applied from the server's own answer. A user without Tier 2 makes no
// call. Entitlement is the same has_tier2 expression the Settings page and
// RequireTier2 use.
//
// Mounted inside OrgProvider. The read goes out from this provider's effect;
// the X-Org-Id header is attached by the api interceptor when the request is
// sent, from the same active org.
import { useCallback, useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { useOrgContext } from '@/context/OrgContext';
import {
  fetchProjectSettings,
  patchProjectSettings,
  ProjectSettingsContext,
  type ProjectSettings,
  type ProjectSettingsPayload,
  type ProjectSettingsValue,
} from '@/hooks/useProjectSettings';

const LOAD_FAILED = 'Could not load the Projects settings.';

// What was read, and for which org — so one org's answer is never shown as
// another's while the second is still loading.
interface Loaded {
  orgId: string;
  settings: ProjectSettings | null;
  error: string | null;
}

// Only the three settings keys: the PATCH answer also carries the list of
// defaults that were set, which belongs to the caller, not to the shared value.
const settingsOf = (data: ProjectSettings): ProjectSettings => ({
  projects_enabled: data.projects_enabled === true,
  projects_tracking_from: data.projects_tracking_from ?? null,
  projects_on: data.projects_on === true,
});

export const ProjectSettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const hasTier2 = user?.user?.has_tier2 ?? user?.has_tier2 ?? false;
  const { activeOrgId } = useOrgContext();

  // The org to read for, or null when nothing is to be read.
  const wanted = hasTier2 && activeOrgId ? activeOrgId : null;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;

    fetchProjectSettings()
      .then((res) => {
        if (cancelled) return;
        // The api interceptor RESOLVES non-401 errors and resolves a cancelled
        // request to null — status-check everything. Anything but a 200 leaves
        // Projects off.
        if (res?.status === 200) {
          setLoaded({ orgId: wanted, settings: settingsOf(res.data), error: null });
        } else {
          setLoaded({
            orgId: wanted,
            settings: null,
            error: res == null ? null : (res.data?.detail ?? LOAD_FAILED),
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded({
          orgId: wanted,
          settings: null,
          error: err?.response?.data?.detail ?? LOAD_FAILED,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [wanted, revision]);

  const save = useCallback(
    async (payload: ProjectSettingsPayload) => {
      const res = await patchProjectSettings(payload);
      if (res?.status === 200) {
        setLoaded((prev) =>
          prev && prev.orgId === wanted
            ? { orgId: prev.orgId, settings: settingsOf(res.data), error: null }
            : prev,
        );
      }
      return res;
    },
    [wanted],
  );

  // Derived while rendering: what is held counts only for the org it was read
  // for.
  const current = wanted && loaded?.orgId === wanted ? loaded : null;

  const value = useMemo<ProjectSettingsValue>(
    () => ({
      settings: current?.settings ?? null,
      projectsOn: current?.settings?.projects_on === true,
      isLoading: wanted !== null && current === null,
      error: current?.error ?? null,
      refetch,
      save,
    }),
    [current, wanted, refetch, save],
  );

  return <ProjectSettingsContext.Provider value={value}>{children}</ProjectSettingsContext.Provider>;
};
