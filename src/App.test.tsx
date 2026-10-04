// Retired legacy staff paths (UI-C7, O-S85-2, D-S85-9): /accounting-review,
// /reviewer-management and /accounts each redirect — with replace — to the
// surface that took them over. The Tier 1 /reviewer route is untouched.
//
// This exercises the real route table in App.tsx. The pages the redirects land
// on are stubbed: what a page shows is that page's own test, not this one's.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { makeStore } from '@/store/store';
import { setInProgress, setUser } from '@/store/features/authSlice';
import App from './App';

vi.mock('@/utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
  revokeRefreshToken: vi.fn(),
}));
// The session is seeded straight into the store below.
vi.mock('@/api/user/useUser', () => ({ useUser: () => ({ getUser: vi.fn() }) }));

vi.mock('@/views/internal/InternalQueue', () => ({
  InternalQueue: () => <p>internal queue page</p>,
}));
vi.mock('@/views/internal/InternalStaff', () => ({
  InternalStaff: () => <p>internal staff page</p>,
}));
vi.mock('@/views/settings', () => ({ Settings: () => <p>settings page</p> }));
vi.mock('@/views/reviewer', () => ({
  ReviewerDashboard: () => <p>tier 1 reviewer page</p>,
}));
vi.mock('@/views/support', () => ({ Support: () => <p>support page</p> }));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

// Where the router is, and a way to step back in its history.
const Probe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>
        history back
      </button>
    </>
  );
};

// A signed-in internal super user, arriving at `path` from /support.
const renderAt = (path: string) => {
  const store = makeStore();
  store.dispatch(
    setUser({
      user: {
        email: 'staff@example.test',
        first_name: 'Sam',
        is_staff: true,
        is_superuser: true,
        has_tier2: false,
        memberships: [],
      },
      is_internal_staff: true,
    }),
  );
  store.dispatch(setInProgress(false));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/support', path]} initialIndex={1}>
        <App />
        <Probe />
      </MemoryRouter>
    </Provider>,
  );
};

const location = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url) =>
    Promise.resolve(
      url === '/api/accounting/staff/me/'
        ? {
            status: 200,
            data: { is_staff_member: true, is_super_user: true, role_type: 'super_user' },
          }
        : { status: 404, data: {} },
    ),
  );
});

describe('retired legacy staff paths', () => {
  it.each([
    ['/accounting-review', '/internal/queue', 'internal queue page'],
    ['/reviewer-management', '/internal/staff', 'internal staff page'],
    ['/accounts', '/settings?tab=chart', 'settings page'],
  ])('%s redirects to %s, replacing the history entry', async (from, to, landing) => {
    const user = userEvent.setup();
    renderAt(from);

    expect(await screen.findByText(landing)).toBeInTheDocument();
    expect(location()).toBe(to);

    // Replace, not push: one step back is the page before the retired path,
    // not the retired path again.
    await user.click(screen.getByRole('button', { name: 'history back' }));
    expect(await screen.findByText('support page')).toBeInTheDocument();
    expect(location()).toBe('/support');
  });

  it('leaves the Tier 1 /reviewer route where it is', async () => {
    renderAt('/reviewer');
    expect(await screen.findByText('tier 1 reviewer page')).toBeInTheDocument();
    expect(location()).toBe('/reviewer');
  });
});
