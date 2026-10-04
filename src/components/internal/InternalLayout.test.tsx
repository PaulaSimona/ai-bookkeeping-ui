// Internal console menu by role (UI-C7, O-S85-3): a reviewer sees Pending
// queue, Assigned clients, Change password and Log out; a super user also sees
// Staff, Assignments and Back to client app. Nobody sees the Tier 1 review
// section or Reviewer management.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { InternalLayout } from './InternalLayout';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn() },
  revokeRefreshToken: vi.fn(),
}));
// Only the logout path dispatches; the menu itself needs no store.
vi.mock('react-redux', () => ({ useDispatch: () => vi.fn() }));

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

beforeEach(() => {
  get.mockReset();
});

describe('Internal console menu', () => {
  it('shows a reviewer exactly Pending queue, Assigned clients, Change password, Log out', async () => {
    get.mockResolvedValue(staffMe(false));
    renderShell();
    const { links, buttons, sidebar } = await menu();

    expect(links).toEqual([
      ['Pending queue', '/internal/queue'],
      ['Assigned clients', '/internal/clients'],
      ['Change password', '/forgot-password'],
    ]);
    expect(buttons).toEqual(['Log out']);

    expect(sidebar.queryByText('Administration')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Back to client app')).not.toBeInTheDocument();
    expectNoTier1OrLegacy(sidebar);
  });

  it('adds Staff, Assignments and Back to client app for a super user', async () => {
    get.mockResolvedValue(staffMe(true));
    renderShell();
    const { links, buttons, sidebar } = await menu();

    expect(links).toEqual([
      ['Pending queue', '/internal/queue'],
      ['Assigned clients', '/internal/clients'],
      ['Staff', '/internal/staff'],
      ['Assignments', '/internal/assignments'],
      ['Back to client app', '/dashboard'],
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
