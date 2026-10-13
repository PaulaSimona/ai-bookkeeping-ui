// InternalClients (Release C2 U7): each client organization links to its
// no-document accounts — a per-org page like its cards and its reports. The
// row itself still opens the client's entries; a link in the row does not.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { InternalClients } from './InternalClients';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

// Where a link landed: the page, and the org it was opened for.
const Landed = ({ page }: { page: string }) => {
  const { orgId } = useParams();
  return <p>{`${page} of ${orgId}`}</p>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/internal/clients']}>
      <Routes>
        <Route path="/internal/clients" element={<InternalClients />} />
        <Route path="/internal/clients/:orgId/entries" element={<Landed page="entries" />} />
        <Route
          path="/internal/clients/:orgId/no-document-accounts"
          element={<Landed page="no-document accounts" />}
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

describe('assigned clients', () => {
  it('links each client to its no-document accounts, without opening its entries', async () => {
    const user = userEvent.setup();
    renderPage();

    const acme = (await screen.findByText('Acme Ltd')).closest('tr') as HTMLElement;
    const birch = screen.getByText('Birch Inc').closest('tr') as HTMLElement;
    expect(within(acme).getByRole('link', { name: 'No-document accounts →' })).toHaveAttribute(
      'href',
      `/internal/clients/${ORG_A}/no-document-accounts`,
    );
    expect(within(birch).getByRole('link', { name: 'No-document accounts →' })).toHaveAttribute(
      'href',
      `/internal/clients/${ORG_B}/no-document-accounts`,
    );
    // Every column has its heading, the per-org pages each their own.
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Organization',
      'Entries',
      'Reports',
      'Cards',
      'No-document accounts',
    ]);
    expect(within(acme).getAllByRole('cell')).toHaveLength(5);

    // The link goes to that client's page — not to its entries, which is
    // where a click anywhere else on the row goes.
    await user.click(within(birch).getByRole('link', { name: 'No-document accounts →' }));
    expect(await screen.findByText(`no-document accounts of ${ORG_B}`)).toBeInTheDocument();
    expect(screen.queryByText(`entries of ${ORG_B}`)).not.toBeInTheDocument();
  });
});
