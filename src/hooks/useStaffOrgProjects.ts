import { useEffect, useState } from 'react';
import api from '@/utils/api';

/**
 * A client's projects, for staff (S98 P1d; backend
 * accounting/project_views.py):
 *   GET /api/accounting/staff/orgs/<org>/projects/   (paginated)
 * STAFF ONLY: no customer page may import this module (pinned by
 * staffTaxBoundary.test.ts). Read for a pick list, so one page of the
 * server's largest size; `count` is the server's total, so a caller can say
 * when the list it offers is not all of them.
 */

export interface StaffProject {
  id: string;
  number: number;
  reference: string;
  name: string;
  customer_name: string | null;
  status: string;
}

const PAGE_SIZE = 200; // AccountingPagination.max_page_size

const projectsUrl = (orgId: string) => `/api/accounting/staff/orgs/${orgId}/projects/`;

const READ_ERROR = 'Could not load the projects.';

const isProject = (value: unknown): value is StaffProject => {
  if (value == null || typeof value !== 'object') return false;
  const project = value as Record<string, unknown>;
  return typeof project.id === 'string' && typeof project.name === 'string';
};

// `orgId` null reads nothing.
export const useStaffOrgProjects = (orgId: string | null) => {
  const [projects, setProjects] = useState<StaffProject[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(orgId != null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId == null) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api
      .get(projectsUrl(orgId), { params: { page: 1, page_size: PAGE_SIZE } })
      .then((res) => {
        if (cancelled || res == null) return;
        const data = res.data as { results?: unknown; count?: unknown } | null | undefined;
        if (res.status === 200 && Array.isArray(data?.results)) {
          const rows = data.results.filter(isProject);
          setProjects(rows);
          setCount(typeof data.count === 'number' ? data.count : rows.length);
        } else {
          setProjects([]);
          setCount(0);
          setError(READ_ERROR);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjects([]);
          setCount(0);
          setError(READ_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { projects, count, isLoading, error };
};
