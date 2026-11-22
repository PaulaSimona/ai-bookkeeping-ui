// InternalTaxReviewFile (S98 P1d item 4): one bank row's tax-review file, as
// the server sent it. All fixtures are invented.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type TaxReviewFile } from '@/hooks/useStaffTaxReview';
import { InternalTaxReviewFile } from './InternalTaxReviewFile';
import {
  FX_FILE_URL,
  FX_ORG,
  FX_PROJECTS_URL,
  FX_PURPOSES_URL,
  FX_ROW,
  FX_SIGNED_URL,
  taxFile,
} from './taxReviewFixtures';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = api.get as unknown as Mock<(url: string, config?: unknown) => Promise<unknown>>;
const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

const GONE = 'This bank row is gone, or it is not one you can review.';
const EXPIRED = 'This receipt link has expired — reload';

// The file, and empty answers for the reads the decision form makes.
const serve = (file: () => unknown, status = 200) => {
  get.mockImplementation((url) => {
    if (url === FX_FILE_URL) return Promise.resolve({ status, data: file() });
    if (url === FX_PURPOSES_URL)
      return Promise.resolve({ status: 200, data: { count: 0, accounts: [] } });
    if (url === FX_PROJECTS_URL)
      return Promise.resolve({
        status: 200,
        data: { count: 0, next: null, previous: null, results: [] },
      });
    return Promise.resolve({ status: 404, data: { detail: 'Not found.' } });
  });
};
const serveFile = (over: Partial<TaxReviewFile> = {}) => serve(() => taxFile(over));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/internal/tax-review/${FX_ROW}`]}>
      <Routes>
        <Route path="/internal/tax-review/:rowId" element={<InternalTaxReviewFile />} />
        <Route path="/internal/tax-review" element={<p>the list</p>} />
      </Routes>
    </MemoryRouter>,
  );

const fileReads = () => get.mock.calls.filter(([url]) => url === FX_FILE_URL);
const section = async (title: string) => {
  const heading = await screen.findByRole('heading', { name: title });
  // SectionCard: heading → its header row → the card.
  return heading.parentElement?.parentElement?.parentElement as HTMLElement;
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('InternalTaxReviewFile — reading the file', () => {
  it('reads the file once, from the row in the route', async () => {
    serveFile();
    renderPage();
    await section('Bank row and ticket');
    expect(fileReads()).toHaveLength(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('shows a loading state first', async () => {
    get.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading the tax-review file…')).toBeInTheDocument();
  });

  it('a 404 reads "gone", with a link back to the list', async () => {
    serve(() => ({ detail: 'Not found.' }), 404);
    renderPage();
    expect(await screen.findByText(GONE)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bank row and ticket' })).not.toBeInTheDocument();
    const back = within(screen.getByRole('alert')).getByRole('link', {
      name: 'Back to tax review',
    });
    expect(back).toHaveAttribute('href', '/internal/tax-review');
    await userEvent.click(back);
    expect(await screen.findByText('the list')).toBeInTheDocument();
  });

  it('any other failure is an error with a retry, never "gone"', async () => {
    serve(() => ({ detail: 'Invented failure.' }), 500);
    renderPage();
    expect(await screen.findByText('Could not load the tax-review file.')).toBeInTheDocument();
    expect(screen.queryByText(GONE)).not.toBeInTheDocument();
    serveFile();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await section('Bank row and ticket');
    expect(fileReads()).toHaveLength(2);
  });
});

describe('InternalTaxReviewFile — every section, from the fixture', () => {
  it('(a) the bank row and its ticket, the org taken from the file', async () => {
    serveFile();
    renderPage();
    const card = await section('Bank row and ticket');
    expect(card).toHaveTextContent('2026-11-03');
    expect(card).toHaveTextContent('Money out 113.00');
    expect(card).toHaveTextContent('POS PURCHASE INVENTED HARDWARE');
    expect(card).toHaveTextContent('In Review');
    expect(card).toHaveTextContent('Tax Review');
    // The org is the file's org_id: no list or org read is made to find it.
    expect(card).toHaveTextContent(FX_ORG.slice(0, 8));
    expect(
      within(card).getByRole('link', { name: 'Account purposes of this client' }),
    ).toHaveAttribute('href', `/internal/clients/${FX_ORG}/account-purposes`);
    const urls = get.mock.calls.map(([url]) => url);
    expect(urls).not.toContain('/api/accounting/review/bank/');
    expect(urls).not.toContain('/api/accounting/orgs/');
  });

  it('(a) a row without a ticket says so', async () => {
    serveFile({ ticket: null });
    renderPage();
    expect(await section('Bank row and ticket')).toHaveTextContent('No ticket');
  });

  it('(b) the receipt, shown by the browser and never requested', async () => {
    serveFile();
    renderPage();
    const card = await section('Receipt');
    expect(card).toHaveTextContent('Document 4101');
    expect(within(card).getByRole('img', { name: 'Receipt' })).toHaveAttribute('src', FX_SIGNED_URL);
    expect(get.mock.calls.map(([url]) => url)).not.toContain(FX_SIGNED_URL);
    expect(window.location.href).not.toContain('sig=');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('(b) no receipt: "No receipt available", and no reason given', async () => {
    serveFile({ receipt: null });
    renderPage();
    const card = await section('Receipt');
    expect(card).toHaveTextContent('No receipt available');
    expect(card).not.toHaveTextContent(/withheld/i);
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('(c) the extraction beside the guard decision', async () => {
    serveFile();
    renderPage();
    const card = await section('Extraction and guard decision');
    const extraction = within(card).getByRole('group', { name: 'Extraction' });
    expect(extraction).toHaveTextContent('113.00');
    expect(extraction).toHaveTextContent('13.00');
    expect(extraction).toHaveTextContent('HST');
    expect(extraction).toHaveTextContent('2026-11-02');
    expect(extraction).toHaveTextContent('CAD');
    const guard = within(card).getByRole('group', { name: 'Guard decision' });
    expect(guard).toHaveTextContent('guard_v1');
    expect(guard).toHaveTextContent('Held');
    expect(guard).toHaveTextContent('tax_unverified');
    expect(guard).toHaveTextContent('invented rule');
    expect(guard).toHaveTextContent('Not run');
  });

  it('(c) says so when there is no extraction and no guard decision', async () => {
    serveFile({ extraction: null, guard: null });
    renderPage();
    const card = await section('Extraction and guard decision');
    expect(card).toHaveTextContent('No extraction');
    expect(card).toHaveTextContent('No guard decision');
  });

  it('(d) open conditions listed, closed ones collapsed', async () => {
    serveFile();
    renderPage();
    const card = await section('Open conditions (2)');
    expect(card).toHaveTextContent('Tax unverified');
    expect(card).toHaveTextContent('Unexplained amount');
    expect(card).toHaveTextContent('invented open evidence');
    const closed = card.querySelector('details') as HTMLDetailsElement;
    expect(closed.open).toBe(false);
    expect(within(closed).getByText('Closed conditions (1)')).toBeInTheDocument();
    expect(closed).toHaveTextContent('Tax kind not recoverable');
    expect(closed).toHaveTextContent('reviewer@example.invalid');
    // The open list itself holds only the open ones.
    const openList = card.querySelector('ul') as HTMLElement;
    expect(within(openList).getAllByRole('listitem')).toHaveLength(2);
    expect(openList).not.toHaveTextContent('Tax kind not recoverable');
  });

  it('(e) the entry chain with role labels, lines, is_live and the raw source', async () => {
    serveFile();
    renderPage();
    const card = await section('Entry chain and current treatment');
    const entries = within(card).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Bank draft');
    expect(entries[0]).toHaveTextContent('JE-0041');
    expect(entries[0]).toHaveTextContent('Live');
    expect(entries[0]).not.toHaveTextContent('Not live');
    expect(entries[0]).toHaveTextContent('bank_feed');
    const lines = within(entries[0]).getAllByRole('row').slice(1);
    expect(lines.map((line) => within(line).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['9500 Invented repairs', '113.00', '—', '—'],
      ['9010 Invented chequing', '—', '113.00', '—'],
    ]);
    expect(entries[1]).toHaveTextContent('Tax adjustment');
    expect(entries[1]).toHaveTextContent('JE-0042');
    expect(entries[1]).toHaveTextContent('Not live');
    // Staff read the raw source, not the customer's word for it.
    expect(entries[1]).toHaveTextContent('staff_correction');

    const treatment = within(card).getByRole('table', { name: 'Current treatment' });
    expect(
      within(treatment)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['9500 Invented repairs', '113.00', '—']);
  });

  it('(f) the bank match', async () => {
    serveFile();
    renderPage();
    const card = await section('Bank match');
    expect(card).toHaveTextContent('Confirmed');
    expect(card).toHaveTextContent('Account 9010');
  });

  it('(g) dates and periods', async () => {
    serveFile();
    renderPage();
    const card = await section('Dates and periods');
    expect(card).toHaveTextContent('2026-11-03');
    expect(card).toHaveTextContent('2026-Q4 (2026-10-01 to 2026-12-31, quarterly)');
    expect(card).toHaveTextContent('2026-11-22');
    expect(card).toHaveTextContent('2026-09-30');
    expect(card).not.toHaveTextContent('in a locked period');
  });

  it('(g) marks an adjustment date in a locked period', async () => {
    const file = taxFile();
    serveFile({ dates: { ...file.dates, adjustment_date_locked: true } });
    renderPage();
    expect(await section('Dates and periods')).toHaveTextContent('in a locked period');
  });

  it('(h) the audit history, oldest first, before and after as JSON', async () => {
    serveFile();
    renderPage();
    const card = await section('Audit history');
    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('tax_condition_raised');
    expect(rows[1]).toHaveTextContent('tax_review_file_read');
    expect(within(rows[0]).getByLabelText('Before of audit 7001').textContent).toBe('null');
    expect(JSON.parse(within(rows[0]).getByLabelText('After of audit 7001').textContent ?? '')).toEqual(
      { kind: 'tax_unverified' },
    );
    expect(JSON.parse(within(rows[1]).getByLabelText('Before of audit 7002').textContent ?? '')).toEqual(
      { marker: 'invented-before' },
    );
  });
});

describe('InternalTaxReviewFile — a row not in tax review', () => {
  it('is read-only: "Not in tax review"', async () => {
    serveFile({ in_tax_review: false, open_conditions: [] });
    renderPage();
    await section('Bank row and ticket');
    expect(screen.getByRole('status')).toHaveTextContent('Not in tax review');
    expect(await section('Open conditions (0)')).toHaveTextContent('No open condition.');
    expect(post).not.toHaveBeenCalled();
  });

  it('a row in tax review carries no such notice', async () => {
    serveFile();
    renderPage();
    await section('Bank row and ticket');
    expect(screen.queryByText('Not in tax review')).not.toBeInTheDocument();
  });
});

describe('InternalTaxReviewFile — the receipt link expires', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('at expiry the link leaves the page; reload reads the file again', async () => {
    let issued = 0;
    serve(() => {
      issued += 1;
      return taxFile({
        receipt: {
          url: `https://files.invalid/receipts/r-9?sig=invented-${issued}`,
          expires_in: 300,
          content_type: 'image/png',
        },
      });
    });
    renderPage();
    const card = await section('Receipt');
    expect(within(card).getByRole('img')).toHaveAttribute(
      'src',
      'https://files.invalid/receipts/r-9?sig=invented-1',
    );
    act(() => {
      vi.advanceTimersByTime(300_000);
    });
    expect(within(card).getByText(EXPIRED)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('sig=');
    // Expiry alone reads nothing.
    expect(fileReads()).toHaveLength(1);

    fireEvent.click(within(card).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(fileReads()).toHaveLength(2));
    await waitFor(() =>
      expect(within(card).getByRole('img')).toHaveAttribute(
        'src',
        'https://files.invalid/receipts/r-9?sig=invented-2',
      ),
    );
    expect(within(card).queryByText(EXPIRED)).not.toBeInTheDocument();
  });
});
