// InternalClients (S98 P1d item 2, Amendment B): each client organization
// links to its account purposes — a per-org page like its no-document
// accounts. The link carries the org's own id and does not open its entries.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { InternalClients } from './InternalClients';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

// Invented fixtures only (the repo is public).
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const LINK = 'Account purposes →';

// Where a link landed: the page, the org it was opened for, and the name that
// rode along.
const Landed = ({ page }: { page: string }) => {
  const { orgId } = useParams();
  const state = useLocation().state as { orgName?: string } | null;
  return <p>{`${page} of ${orgId} (${state?.orgName ?? 'no name'})`}</p>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/internal/clients']}>
      <Routes>
        <Route path="/internal/clients" element={<InternalClients />} />
        <Route path="/internal/clients/:orgId/entries" element={<Landed page="entries" />} />
        <Route
          path="/internal/clients/:orgId/account-purposes"
          element={<Landed page="account purposes" />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url) =>
    Promise.resolve(
      url === '/api/accounting/orgs/'
        ? {
            status: 200,
            data: [
              { id: ORG_A, name: 'Acme Ltd' },
              { id: ORG_B, name: 'Birch Inc' },
            ],
          }
        : { status: 404, data: {} },
    ),
  );
});

describe('assigned clients: account purposes', () => {
  it('links each client to its own account purposes, without opening its entries', async () => {
    const user = userEvent.setup();
    renderPage();

    const acme = (await screen.findByText('Acme Ltd')).closest('tr') as HTMLElement;
    const birch = screen.getByText('Birch Inc').closest('tr') as HTMLElement;
    expect(within(acme).getByRole('link', { name: LINK })).toHaveAttribute(
      'href',
      `/internal/clients/${ORG_A}/account-purposes`,
    );
    expect(within(birch).getByRole('link', { name: LINK })).toHaveAttribute(
      'href',
      `/internal/clients/${ORG_B}/account-purposes`,
    );

    await user.click(within(birch).getByRole('link', { name: LINK }));
    expect(
      await screen.findByText(`account purposes of ${ORG_B} (Birch Inc)`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^entries of/)).not.toBeInTheDocument();
  });
});
