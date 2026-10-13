// DocumentsPage (Release E2-6, O-S89-E7): the Tier 2 Documents page reads
// its filters, page and open row from the URL and writes them back there, so
// a round trip to another page and Back loses nothing; the open row shows in
// a drawer over the page; the page takes the whole content width.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type DocumentRow } from '@/hooks/useDocumentList';
import { DocumentsPage } from './DocumentsPage';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/hooks/useAccounts', () => ({
  useOrgMe: () => ({ role: 'owner', isLoading: false }),
}));
vi.mock('./documents/Tier2UploadZone', () => ({
  Tier2UploadZone: () => <p>upload zone</p>,
}));

type Params = Record<string, string | number | boolean>;
const get = api.get as unknown as Mock<(url: string, config?: { params?: Params }) => Promise<unknown>>;

const STATUS_URL = '/api/accounting/documents/status/';
const SUPPLIER = 'c0c0c0c0-0000-4000-8000-000000000001';

const row = (over: Partial<DocumentRow> = {}): DocumentRow => ({
  document_id: 41,
  name: 'IMG_0042.jpg',
  created_at: '2026-05-05T10:00:00Z',
  extraction_status: 'done',
  accounting_status: 'posted',
  routing_reason: null,
  display_name: 'Costco Wholesale',
  display_name_source: 'supplier',
  document_date: '2026-05-04',
  uploaded_at: '2026-05-05T10:00:01Z',
  counterparty: { id: SUPPLIER, name: 'Costco Wholesale' },
  read_as: 'COSTCO WHOLESALE',
  total: '113.00',
  currency: 'CAD',
  document_type: 'receipt',
  duplicate_of: null,
  ...over,
});
const COSTCO = row();
const COPY = row({
  document_id: 42,
  name: 'copy.pdf',
  display_name: 'copy.pdf',
  display_name_source: 'filename',
  counterparty: null,
  accounting_status: 'rejected',
  duplicate_of: { id: 41, name: 'Costco Wholesale' },
});

const COUNTS = { pending: 0, processing: 0, posted: 1, needs_review: 0, failed: 0, rejected: 1, not_source_document: 0, total: 2 };

const serve = (rows: DocumentRow[] = [COSTCO, COPY], count?: number) => {
  get.mockImplementation((url) => {
    if (url === STATUS_URL) {
      return Promise.resolve({
        status: 200,
        data: { count: count ?? rows.length, next: null, previous: null, results: rows, counts: COUNTS },
      });
    }
    if (url === '/api/accounting/counterparties/') {
      return Promise.resolve({
        status: 200,
        data: { count: 1, next: null, previous: null, results: [{ id: SUPPLIER, name: 'Costco Wholesale' }] },
      });
    }
    return Promise.resolve({ status: 404, data: {} });
  });
};

// Every query the list was asked with (the counts probe sends page_size 1 and
// is left out), in order.
const listRequests = (): (Params | undefined)[] =>
  get.mock.calls
    .filter(([url, config]) => url === STATUS_URL && config?.params?.page_size !== 1)
    .map(([, config]) => config?.params);
const lastListRequest = () => listRequests().at(-1);

const Probe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button type="button" onClick={() => navigate('/elsewhere')}>go elsewhere</button>
      <button type="button" onClick={() => navigate(-1)}>history back</button>
    </>
  );
};

const renderAt = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/accounting/documents${search}`]}>
      <Routes>
        <Route path="/accounting/documents" element={<><DocumentsPage /><Probe /></>} />
        <Route path="/elsewhere" element={<><p>elsewhere page</p><Probe /></>} />
      </Routes>
    </MemoryRouter>,
  );

const location = () => screen.getByTestId('location').textContent;
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(() => {
  get.mockReset();
});

describe('the documents page and its URL', () => {
  it('reads its filters, page and open row from the URL and asks the server for exactly that', async () => {
    serve([COSTCO, COPY], 120);
    renderAt(`?status=posted&q=costco&counterparty=${SUPPLIER}&document_date_from=2026-05-01&sort=-document_date&page=2&open=41`);

    await screen.findByText('copy.pdf');
    await waitFor(() =>
      expect(lastListRequest()).toEqual({
        status: 'posted',
        document_date_from: '2026-05-01',
        counterparty: SUPPLIER,
        q: 'costco',
        sort: '-document_date',
        page: 2,
        page_size: 50,
      }),
    );
    expect(screen.getByText('51–100 of 120')).toBeInTheDocument();
    // The open row is marked, and shown in the drawer.
    const rows = screen.getAllByRole('row').filter((tr) => tr.getAttribute('aria-selected') === 'true');
    expect(rows).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Document detail' })).toBeInTheDocument();
  });

  it('writes a chip, a filter and a page turn to the URL — replacing, with a filter change back at page one', async () => {
    const user = userEvent.setup();
    serve([COSTCO, COPY], 120);
    renderAt('?page=2');
    await screen.findByText('copy.pdf');
    expect(location()).toBe('/accounting/documents?page=2');

    await user.click(screen.getByRole('button', { name: 'Posted' }));
    await settle();
    expect(location()).toBe('/accounting/documents?status=posted');
    expect(lastListRequest()).toEqual({ status: 'posted', page: 1, page_size: 50 });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Supplier' }), 'Costco Wholesale');
    await settle();
    expect(location()).toBe(`/accounting/documents?status=posted&counterparty=${SUPPLIER}`);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await settle();
    expect(location()).toBe(`/accounting/documents?status=posted&counterparty=${SUPPLIER}&page=2`);
    expect(lastListRequest()).toEqual({ status: 'posted', counterparty: SUPPLIER, page: 2, page_size: 50 });

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await settle();
    expect(location()).toBe('/accounting/documents');
  });

  it('keeps everything across a round trip: elsewhere and Back lands on the same filters, page and open row', async () => {
    const user = userEvent.setup();
    serve([COSTCO, COPY], 120);
    renderAt('?q=costco&page=2&open=41');
    await screen.findByText('copy.pdf');
    const before = listRequests().length;

    await user.click(screen.getByRole('button', { name: 'go elsewhere' }));
    expect(await screen.findByText('elsewhere page')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'history back' }));

    expect(await screen.findByText('copy.pdf')).toBeInTheDocument();
    expect(location()).toBe('/accounting/documents?q=costco&page=2&open=41');
    await waitFor(() => expect(listRequests().length).toBeGreaterThan(before));
    expect(lastListRequest()).toEqual({ q: 'costco', page: 2, page_size: 50 });
    expect(screen.getByRole('region', { name: 'Document detail' })).toBeInTheDocument();
  });

  it('opens a row in a drawer with its fields, the duplicate it points to, and Open file; closing it leaves the URL', async () => {
    const user = userEvent.setup();
    serve();
    renderAt('?open=42');
    // The drawer names the file too: wait for the drawer itself.
    await screen.findByRole('region', { name: 'Document detail' });

    const drawer = screen.getByRole('region', { name: 'Document detail' });
    expect(drawer).toHaveClass('fixed', 'inset-y-0', 'right-0', 'overflow-y-auto');
    const detail = (label: string) => within(drawer).getByText(label).parentElement!.textContent;
    expect(detail('Name')).toBe('Namecopy.pdf');
    expect(detail('Filename')).toBe('Filenamecopy.pdf');
    expect(detail('Status')).toBe('StatusRejected');
    expect(detail('Duplicate of')).toContain('Costco Wholesale');
    expect(within(drawer).getByRole('button', { name: 'Open file' })).toBeInTheDocument();

    // The duplicate link opens the original in the same drawer.
    await user.click(within(drawer).getByRole('button', { name: 'Costco Wholesale' }));
    await settle();
    expect(location()).toBe('/accounting/documents?open=41');
    const original = screen.getByRole('region', { name: 'Document detail' });
    const field = (label: string) => within(original).getByText(label).parentElement!.textContent;
    expect(field('Name')).toBe('NameCostco Wholesale');
    expect(field('Supplier')).toBe('SupplierCostco Wholesale');
    expect(field('Read as')).toBe('Read asCOSTCO WHOLESALE');
    expect(field('Document date')).toBe('Document date2026-05-04');
    expect(field('Type')).toBe('TypeReceipt');
    expect(field('Total')).toBe('Total113.00 CAD');

    await user.click(within(original).getByRole('button', { name: 'Close' }));
    await settle();
    expect(screen.queryByRole('region', { name: 'Document detail' })).not.toBeInTheDocument();
    expect(location()).toBe('/accounting/documents');
  });

  it('takes the whole content width and passes its height down to the list', async () => {
    serve();
    renderAt();
    await screen.findByText('copy.pdf');
    const page = screen.getByTestId('documents-page');
    expect(page).not.toHaveClass('max-w-5xl');
    expect(page).not.toHaveClass('mx-auto');
    expect(page).toHaveClass('flex', 'flex-col', 'min-h-0', 'flex-1');
    const section = screen.getByRole('table').closest('section') as HTMLElement;
    expect(section).toHaveClass('flex', 'flex-col', 'min-h-0', 'flex-1');
  });
});
