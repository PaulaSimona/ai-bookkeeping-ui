// OrgContext (Session-25 Phase E, U1) — the single reactive source of the
// active org / role for the accountant surfaces. Seeded from the Redux /me
// payload's memberships (Phase A backend); it does NOT fetch — /me is already
// loaded by useUser. Responsibilities:
//   • pick the active org (sole membership auto-selects; multiple require an
//     explicit, per-user-persisted choice; a restored choice is validated
//     against the current memberships);
//   • keep the module-level X-Org-Id holder (utils/activeOrg) in sync so every
//     /api/accounting/* request carries the active org;
//   • expose the switcher used by the accountant sidebar's client card.
//
// The post-auth LANDING logic does NOT depend on this context — it uses the pure
// helpers in utils/activeOrg directly — so persona/landing stay consistent
// whether or not a component is inside the provider.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import {
  type Membership,
  findMembership,
  membershipsOf,
  pickActiveOrgId,
  setActiveOrgIdHeader,
  userKeyOf,
  writeStoredOrgId,
} from '@/utils/activeOrg';

interface OrgContextValue {
  memberships: Membership[];
  activeOrgId: string | null;
  activeOrg: Membership | null;
  activeRole: string | null;
  // true when the user has >1 membership and none is selected yet — the client
  // switcher must prompt a choice before accounting calls can resolve an org.
  needsSelection: boolean;
  otherClientCount: number;
  setActiveOrgId: (orgId: string) => void;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

export const OrgProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const user = useSelector((s: RootState) => s.auth.user);

  const memberships = useMemo<Membership[]>(() => membershipsOf(user), [user]);
  const userKey = useMemo(() => userKeyOf(user), [user]);

  // Selected org id. `undefined` = not yet reconciled with memberships; once
  // reconciled it is a concrete id or null (needs explicit selection).
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);

  // Reconcile the selection whenever memberships change (login, /me refresh,
  // logout→null). Keeps a valid current selection, otherwise re-derives.
  const resolvedId = useMemo(() => {
    if (selectedId && memberships.some((m) => m.org_id === selectedId)) {
      return selectedId; // an explicit, still-valid choice wins
    }
    return pickActiveOrgId(memberships, userKey);
  }, [selectedId, memberships, userKey]);

  // Keep the module-level header holder in lockstep with the resolved org, so
  // the interceptor attaches the right X-Org-Id on the very next request.
  useEffect(() => {
    setActiveOrgIdHeader(resolvedId);
  }, [resolvedId]);

  const setActiveOrgId = useCallback((orgId: string) => {
    setActiveOrgIdHeader(orgId);   // update the header BEFORE any refetch fires
    writeStoredOrgId(userKey, orgId);
    setSelectedId(orgId);
  }, [userKey]);

  const activeOrg = findMembership(memberships, resolvedId);

  const value = useMemo<OrgContextValue>(() => ({
    memberships,
    activeOrgId: resolvedId,
    activeOrg,
    activeRole: activeOrg?.role ?? null,
    needsSelection: memberships.length > 1 && resolvedId === null,
    otherClientCount: resolvedId ? Math.max(0, memberships.length - 1) : memberships.length,
    setActiveOrgId,
  }), [memberships, resolvedId, activeOrg, setActiveOrgId]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};

export const useOrgContext = (): OrgContextValue => {
  const ctx = useContext(OrgContext);
  if (ctx === undefined) {
    throw new Error('useOrgContext must be used within an OrgProvider');
  }
  return ctx;
};
