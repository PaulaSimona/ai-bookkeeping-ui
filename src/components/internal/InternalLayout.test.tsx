// Internal console menu by role (UI-C7, O-S85-3; Bank rows added by O-S87-8):
// a reviewer sees Pending queue, Bank rows, Assigned clients, Change password
// and Log out; a super user also sees Staff, Assignments and Back to client
// app. Nobody sees the Tier 1 review section or Reviewer management.
//
// Back to client app (O-S87-7) goes to the signed-in user's own home in the
// client app — the tier-aware authedHomePath — not to a fixed /dashboard.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { authedHomePath } from '@/utils/activeOrg';
import { InternalLayout } from './InternalLayout';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn() },
  revokeRefreshToken: vi.fn(),
}));
// The signed-in user as the auth slice holds it (the /me payload). Hoisted
// with the mock below, which reads it on every render.
const session = vi.hoisted(() => ({ user: null as unknown }));
// Only the logout path dispatches; the menu reads the signed-in user alone.
vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: (select: (state: unknown) => unknown) => select({ auth: { user: session.user } }),
}));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

const staffMe = (isSuperUser: boolean) => ({
  status: 200,
  data: {
    is_staff_member: true,
    is_super_user: isSuperUser,
    role_type: isSuperUser ? 'super_user' : 'reviewer',
  },
});

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={['/internal/queue']}>
      <Routes>
        <Route element={<InternalLayout />}>
          <Route path="/internal/queue" element={<p>queue page</p>} />
        </Route>
        <Route path="/dashboard" element={<p>client dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );

// Every entry of the sidebar, in order: its links, then its buttons.
const menu = async () => {
  await screen.findByText('queue page');
  const sidebar = within(screen.getByRole('complementary'));
  return {
    links: sidebar.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]),
    buttons: sidebar.getAllByRole('button').map((b) => b.textContent),
    sidebar,
  };
};

// The links O-S85-3 removes for every role. ("Reviewer" also appears as the
// role label in the console header, so these are checked as LINKS.)
const REMOVED_LINKS = ['Reviewer', 'Accounting Review', 'Reviewer management'];

const expectNoTier1OrLegacy = (sidebar: ReturnType<typeof within>) => {
  expect(sidebar.queryByText('Tier 1 review')).not.toBeInTheDocument();
  for (const name of REMOVED_LINKS) {
    expect(sidebar.queryByRole('link', { name })).not.toBeInTheDocument();
  }
};

// A /me payload: the user, whether the account has Tier 2, and its memberships.
const signedIn = (hasTier2: boolean, roles: string[] = []) => ({
  user: {
    email: 'staff@example.test',
    has_tier2: hasTier2,
    memberships: roles.map((role, index) => ({
      org_id: `0000000${index}-0000-4000-8000-000000000000`,
      org_name: `Org ${index}`,
      role,
    })),
  },
  is_internal_staff: true,
});

// Where Back to client app points, for a super user signed in as `user`.
const backLinkFor = async (user: unknown) => {
  session.user = user;
  get.mockResolvedValue(staffMe(true));
  const view = renderShell();
  await screen.findByText('queue page');
  const href = screen.getByRole('link', { name: 'Back to client app' }).getAttribute('href');
  view.unmount();
  return href;
};

beforeEach(() => {
  get.mockReset();
  session.user = null;
  // The active org of a multi-org user is remembered here (activeOrg.ts).
  window.localStorage.clear();
});

describe('Internal console menu', () => {
  it('shows a reviewer exactly Pending queue, Bank rows, Assigned clients, Change password, Log out', async () => {
    get.mockResolvedValue(staffMe(false));
    renderShell();
    const { links, buttons, sidebar } = await menu();

    expect(links).toEqual([
      ['Pending queue', '/internal/queue'],
      ['Bank rows', '/internal/bank-rows'],
      ['Assigned clients', '/internal/clients'],
      ['Change password', '/forgot-password'],
    ]);
    expect(buttons).toEqual(['Log out']);

    expect(sidebar.queryByText('Administration')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Back to client app')).not.toBeInTheDocument();
    expectNoTier1OrLegacy(sidebar);
  });

  it('adds Staff, Assignments and a tier-aware Back to client app for a super user', async () => {
    // A super user whose own account is a Tier 2 owner's.
    session.user = signedIn(true, ['owner']);
    get.mockResolvedValue(staffMe(true));
    renderShell();
    const { links, buttons, sidebar } = await menu();

    expect(links).toEqual([
      ['Pending queue', '/internal/queue'],
      ['Bank rows', '/internal/bank-rows'],
      ['Assigned clients', '/internal/clients'],
      ['Staff', '/internal/staff'],
      ['Assignments', '/internal/assignments'],
      ['Back to client app', '/accounting/dashboard'],
      ['Change password', '/forgot-password'],
    ]);
    expect(buttons).toEqual(['Log out']);

    expect(sidebar.getByText('Administration')).toBeInTheDocument();
    expectNoTier1OrLegacy(sidebar);
  });

  it('links to none of the retired or Tier 1 review routes, for either role', async () => {
    for (const isSuperUser of [false, true]) {
      get.mockResolvedValue(staffMe(isSuperUser));
      const { unmount } = renderShell();
      const { links } = await menu();
      const hrefs = links.map(([, href]) => href);
      expect(hrefs).not.toContain('/reviewer');
      expect(hrefs).not.toContain('/accounting-review');
      expect(hrefs).not.toContain('/reviewer-management');
      expect(hrefs).not.toContain('/accounts');
      unmount();
    }
  });

  it('sends a visitor without a staff profile out of the console', async () => {
    get.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    renderShell();
    expect(await screen.findByText('client dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

// O-S87-7: the link leaves the console for the signed-in user's own home in
// the client app, resolved as everywhere else (authedHomePath, with /dashboard
// for an account that has no Tier 2).
describe('Back to client app', () => {
  it('takes a Tier 1 account to the Tier 1 dashboard', async () => {
    expect(await backLinkFor(signedIn(false))).toBe('/dashboard');
    // A membership alone does not make an account Tier 2.
    expect(await backLinkFor(signedIn(false, ['owner']))).toBe('/dashboard');
  });

  it('takes a Tier 2 account to its Tier 2 home: the dashboard for an owner, the ledger for an accountant', async () => {
    expect(await backLinkFor(signedIn(true, ['owner']))).toBe('/accounting/dashboard');
    expect(await backLinkFor(signedIn(true, ['accountant']))).toBe('/accountant/ledger');
  });

  it('with no active org, falls back exactly as authedHomePath does', async () => {
    // Two orgs and none chosen yet: no active membership to read a role from,
    // so not the accountant ledger — the Tier 2 dashboard.
    const undecided = signedIn(true, ['accountant', 'accountant']);
    expect(authedHomePath(undecided, '/dashboard')).toBe('/accounting/dashboard');
    expect(await backLinkFor(undecided)).toBe('/accounting/dashboard');

    // No memberships at all, and no session yet: the same answers again.
    for (const user of [signedIn(true), signedIn(false), null]) {
      expect(await backLinkFor(user)).toBe(authedHomePath(user, '/dashboard'));
    }
    expect(await backLinkFor(null)).toBe('/dashboard');
  });
});
