// DocumentStatusList (Release E2-2, O-S89-E5 / O-S89-E7): the Tier 2
// document table — document date, name with its supplier or the name the
// model read, type, total as the server's string, status — in one frame that
// scrolls both ways with a sticky header, never narrower than 56rem. The
// open row is marked and reported; View and Delete are as they were.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { type DocumentRow } from '@/hooks/useDocumentList';
import { DocumentStatusList } from './DocumentStatusList';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
// The toast reads the Redux store; the list's tests look at what it was told.
const showToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showToast }) }));

const get = api.get as unknown as Mock<(url: string) => Promise<unknown>>;
const del = api.delete as unknown as Mock<(url: string) => Promise<unknown>>;
const patch = api.patch as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;

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
  total: '1234.50',
  currency: 'CAD',
  document_type: 'receipt',
  duplicate_of: null,
  ...over,
});

const SUPPLIER_ROW = row();
const FILENAME_ROW = row({
  document_id: 42,
  name: 'scan-0007.pdf',
  display_name: 'scan-0007.pdf',
  display_name_source: 'filename',
  counterparty: null,
  read_as: 'Unknown Vendor Ltd',
  document_type: 'invoice_received',
  total: null,
  currency: null,
  document_date: null,
  accounting_status: 'needs_review',
});
const MANUAL_ROW = row({
  document_id: 43,
  display_name: 'May rent',
  display_name_source: 'manual',
  counterparty: null,
  read_as: null,
  document_type: null,
  accounting_status: 'rejected',
  total: '80.00',
});

const base = {
  count: 3,
  page: 1,
  setPage: vi.fn(),
  pageSize: 50,
  isLoading: false,
  error: null as string | null,
};

const headers = () => screen.getAllByRole('columnheader').map((th) => th.textContent);
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const cellsOf = (tr: HTMLElement) => within(tr).getAllByRole('cell').map((td) => td.textContent);

beforeEach(() => {
  get.mockReset();
  del.mockReset();
  patch.mockReset();
  showToast.mockReset();
  base.setPage = vi.fn();
});

describe('the document table', () => {
  it('has the five columns and an action column, in order', () => {
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} />);
    expect(headers()).toEqual(['Document date', 'Name', 'Type', 'Total', 'Status', '']);
  });

  it('shows each row: its document date, its name with its supplier, its type, its total as sent, its status', () => {
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} />);
    const tr = rowOf('Costco Wholesale');
    const [date, name, type, total, status] = within(tr).getAllByRole('cell');
    expect(date.textContent).toBe('2026-05-04');
    expect(within(name).getByText('Costco Wholesale')).toBeInTheDocument();
    expect(name).toHaveTextContent('Supplier · Costco Wholesale');
    expect(name).not.toHaveTextContent('Read as');
    expect(type.textContent).toBe('Receipt');
    // The server's string: not regrouped, re-signed or given a symbol.
    expect(total.textContent).toBe('1234.50 CAD');
    expect(tr).not.toHaveTextContent('1,234.50');
    expect(tr).not.toHaveTextContent('$');
    expect(status.textContent).toBe('Posted');
    // The filename is never the row's name once a supplier named it.
    expect(tr).not.toHaveTextContent('IMG_0042.jpg');
  });

  it('shows the name the model read under a filename-named document, and a dash where there is no date or total', () => {
    render(<DocumentStatusList {...base} items={[FILENAME_ROW]} />);
    const tr = rowOf('scan-0007.pdf');
    const cells = cellsOf(tr);
    expect(cells[0]).toBe('—');
    expect(tr).toHaveTextContent('Read as · Unknown Vendor Ltd');
    expect(tr).not.toHaveTextContent('Supplier ·');
    expect(cells[2]).toBe('Bill');
    expect(cells[3]).toBe('—');
    expect(cells[4]).toBe('In review');
  });

  it('shows a manual name on its own, and an unknown type as a dash', () => {
    render(<DocumentStatusList {...base} items={[MANUAL_ROW]} />);
    const tr = rowOf('May rent');
    const cells = cellsOf(tr);
    expect(tr).not.toHaveTextContent('Supplier ·');
    expect(tr).not.toHaveTextContent('Read as');
    expect(cells[2]).toBe('—');
    expect(cells[3]).toBe('80.00 CAD');
    expect(cells[4]).toBe('Rejected');
  });

  it('is one frame that scrolls both ways and fills its height, with a sticky header and a table never narrower than 56rem', () => {
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} />);
    const table = screen.getByRole('table');
    expect(table).toHaveClass('w-full', 'min-w-[56rem]');
    const frame = table.parentElement as HTMLElement;
    expect(frame).toHaveClass('flex-1', 'min-h-0', 'overflow-auto');
    expect(frame).not.toHaveClass('overflow-x-auto');
    const thead = table.querySelector('thead') as HTMLElement;
    expect(thead).toHaveClass('sticky', 'top-0');
    // The card around it is a flex column that passes the height down.
    expect(frame.parentElement).toHaveClass('flex', 'flex-col', 'min-h-0', 'flex-1');
  });

  it('reports a clicked row as open, marks the open one, and a second click closes it', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const view = render(<DocumentStatusList {...base} items={[SUPPLIER_ROW, FILENAME_ROW]} open={null} onOpen={onOpen} />);
    await user.click(rowOf('Costco Wholesale'));
    expect(onOpen).toHaveBeenLastCalledWith(41);
    expect(rowOf('Costco Wholesale')).toHaveAttribute('aria-selected', 'false');

    view.rerender(<DocumentStatusList {...base} items={[SUPPLIER_ROW, FILENAME_ROW]} open={41} onOpen={onOpen} />);
    expect(rowOf('Costco Wholesale')).toHaveAttribute('aria-selected', 'true');
    expect(rowOf('scan-0007.pdf')).toHaveAttribute('aria-selected', 'false');
    await user.click(rowOf('Costco Wholesale'));
    expect(onOpen).toHaveBeenLastCalledWith(null);
  });

  it('View asks for the signed URL on click only, and does not open the row', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    get.mockResolvedValue({ status: 200, data: { url: 'https://files.example.test/signed' } });
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} onOpen={onOpen} />);
    expect(get).not.toHaveBeenCalled();

    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'View' }));
    expect(get).toHaveBeenCalledWith('/api/accounting/documents/41/file-url/');
    expect(tab.location.href).toBe('https://files.example.test/signed');
    expect(tab.opener).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('offers Delete only on a terminal status, asks first, and reports a 204', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const onOpen = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    del.mockResolvedValue({ status: 204 });
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW, MANUAL_ROW]} open={43} onOpen={onOpen} onDeleted={onDeleted} />);

    expect(within(rowOf('Costco Wholesale')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(within(rowOf('May rent')).getByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete "May rent"? This cannot be undone.');
    expect(del).toHaveBeenCalledWith('/api/accounting/documents/43/');
    expect(onDeleted).toHaveBeenCalledTimes(1);
    // The deleted row was the open one: the pane closes with it.
    expect(onOpen).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText('May rent')).not.toBeInTheDocument();
  });

  it('keeps a refused delete and says why', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    del.mockResolvedValue({ status: 400, data: { code: 'document_has_entry' } });
    render(<DocumentStatusList {...base} items={[MANUAL_ROW]} />);
    await user.click(within(rowOf('May rent')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('May rent')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith({
      title: 'Could not delete document',
      message: 'This document has a linked journal entry and can’t be deleted.',
      variant: 'danger',
    });
  });

  it('pages with Prev and Next and says where it is', async () => {
    const user = userEvent.setup();
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} count={120} page={2} pageSize={50} />);
    expect(screen.getByText('51–100 of 120')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(base.setPage).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(base.setPage).toHaveBeenLastCalledWith(3);
  });

  it('shows the skeleton while loading, the error in its own words, and the empty message', () => {
    const loading = render(<DocumentStatusList {...base} items={[]} isLoading />);
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.queryByText(/No documents/)).not.toBeInTheDocument();
    loading.unmount();

    const failed = render(<DocumentStatusList {...base} items={[]} error="boom" />);
    expect(screen.getByText("Couldn't load document status — retrying shortly.")).toBeInTheDocument();
    failed.unmount();

    render(<DocumentStatusList {...base} items={[]} count={0} emptyMessage="No posted documents." />);
    expect(screen.getByText('No posted documents.')).toBeInTheDocument();
  });

  it('shows a long name cut short with the whole name in its title', () => {
    const long = 'A'.repeat(120);
    render(<DocumentStatusList {...base} items={[row({ display_name: long, display_name_source: 'manual', counterparty: null })]} />);
    const cell = screen.getByText(long);
    expect(cell).toHaveClass('truncate');
    expect(cell).toHaveAttribute('title', long);
    expect(cell.closest('td')).toHaveClass('w-full', 'max-w-0');
  });
});

// ─── Rename (Release E2-4, O-S89-E4) ───────────────────────────────────────────
//
// Rename opens the name in place; Save sends it and the row then shows the
// name THE SERVER ANSWERED WITH — never the typed one; an empty name returns
// the document to its automatic name; a refusal is shown in the server's
// words and the old name stays.

const RENAME_URL = (id: number) => `/api/accounting/documents/${id}/name/`;
const renameField = () => screen.getByRole('textbox', { name: 'Document name' });

describe('rename', () => {
  it('opens the shown name in place, and Cancel or Escape puts it back untouched', async () => {
    const user = userEvent.setup();
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} />);
    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    expect(renameField()).toHaveValue('Costco Wholesale');
    expect(renameField()).toHaveAttribute('maxlength', '200');
    await user.type(renameField(), ' typed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Document name' })).not.toBeInTheDocument();
    expect(screen.getByText('Costco Wholesale')).toBeInTheDocument();

    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    await user.type(renameField(), ' again{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Document name' })).not.toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("saves what was typed and shows the row the server answered with — not the typed name", async () => {
    const user = userEvent.setup();
    const onRenamed = vi.fn();
    // What comes back is what is shown — worded apart from what was typed,
    // so a row that showed the typed name would be caught.
    patch.mockResolvedValue({
      status: 200,
      data: { ...SUPPLIER_ROW, display_name: 'Name the server kept', display_name_source: 'manual', counterparty: null, read_as: 'COSTCO WHOLESALE' },
    });
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} onRenamed={onRenamed} />);
    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    await user.clear(renameField());
    await user.type(renameField(), 'Name as typed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(RENAME_URL(41), { display_name: 'Name as typed' });
    expect(await screen.findByText('Name the server kept')).toBeInTheDocument();
    expect(screen.queryByText('Name as typed')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Document name' })).not.toBeInTheDocument();
    // The second line follows the server's row too: no supplier now, read-as instead.
    expect(rowOf('Name the server kept')).toHaveTextContent('Read as · COSTCO WHOLESALE');
    expect(onRenamed).toHaveBeenCalledTimes(1);
  });

  it('an empty name returns the document to its automatic name, as the server says it', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({
      status: 200,
      data: { ...MANUAL_ROW, display_name: 'scan-0007.pdf', display_name_source: 'filename' },
    });
    render(<DocumentStatusList {...base} items={[MANUAL_ROW]} />);
    await user.click(within(rowOf('May rent')).getByRole('button', { name: 'Rename' }));
    await user.clear(renameField());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(patch).toHaveBeenCalledWith(RENAME_URL(43), { display_name: '' });
    expect(await screen.findByText('scan-0007.pdf')).toBeInTheDocument();
    expect(screen.queryByText('May rent')).not.toBeInTheDocument();
  });

  it('Enter saves', async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ status: 200, data: { ...SUPPLIER_ROW, display_name: 'Entered', display_name_source: 'manual' } });
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} />);
    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    await user.clear(renameField());
    await user.type(renameField(), 'Entered{Enter}');
    expect(await screen.findByText('Entered')).toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith(RENAME_URL(41), { display_name: 'Entered' });
  });

  it("shows a refusal in the server's words and keeps the old name", async () => {
    const user = userEvent.setup();
    patch.mockResolvedValue({ status: 400, data: { display_name: 'The name may not exceed 200 characters.' } });
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} />);
    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    await user.clear(renameField());
    await user.type(renameField(), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Could not rename document',
        message: 'The name may not exceed 200 characters.',
        variant: 'danger',
      }),
    );
    // The field stays open with what was typed; the row keeps its name.
    expect(renameField()).toHaveValue('x');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Costco Wholesale')).toBeInTheDocument();
    expect(screen.queryByText('x')).not.toBeInTheDocument();
  });

  it('says the document is no longer available on a 404 and closes the field', async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    patch.mockResolvedValue({ status: 404, data: { detail: 'Not found.' } });
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} onDeleted={onDeleted} />);
    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    await user.type(renameField(), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Could not rename document',
        message: 'This document is no longer available.',
        variant: 'danger',
      }),
    );
    expect(screen.queryByRole('textbox', { name: 'Document name' })).not.toBeInTheDocument();
    // The list is read again, so the gone row leaves.
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('sends one request at a time, and does not open the row while renaming', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const answers: ((value: unknown) => void)[] = [];
    patch.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} onOpen={onOpen} />);
    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    expect(onOpen).not.toHaveBeenCalled();
    await user.type(renameField(), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(renameField()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(patch).toHaveBeenCalledTimes(1);
    await act(async () => answers[0]({ status: 200, data: { ...SUPPLIER_ROW, display_name: 'Done', display_name_source: 'manual' } }));
    expect(await screen.findByText('Done')).toBeInTheDocument();
  });

  it('keeps the field open with the failure when the connection is lost', async () => {
    const user = userEvent.setup();
    patch.mockRejectedValue(new Error('network down'));
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW]} />);
    await user.click(within(rowOf('Costco Wholesale')).getByRole('button', { name: 'Rename' }));
    await user.type(renameField(), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        title: 'Could not rename document',
        message: 'Could not rename the document.',
        variant: 'danger',
      }),
    );
    expect(renameField()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

// ─── Duplicates (Release E2-5, O-S89-E6) ───────────────────────────────────────
//
// A document the server links to an earlier one says so under its name — in
// the server's words for the original — and the name opens that document.

describe('duplicates', () => {
  it('says "Possible duplicate of <name>" under a document the soft rule suspects, and the name opens the original', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const suspect = row({
      document_id: 44,
      display_name: 'suspect.pdf',
      display_name_source: 'filename',
      counterparty: null,
      read_as: null,
      accounting_status: 'needs_review',
      duplicate_of: { id: 41, name: 'Costco Wholesale' },
    });
    render(<DocumentStatusList {...base} items={[suspect]} onOpen={onOpen} />);
    const tr = rowOf('suspect.pdf');
    expect(tr).toHaveTextContent('Possible duplicate of Costco Wholesale');
    expect(tr).not.toHaveTextContent('Already uploaded');
    await user.click(within(tr).getByRole('button', { name: 'Costco Wholesale' }));
    expect(onOpen).toHaveBeenLastCalledWith(41);
    // The click opened the original, not this row.
    expect(onOpen).not.toHaveBeenCalledWith(44);
  });

  it('says "Already uploaded as <name>" under a copy the server rejected', () => {
    const copy = row({
      document_id: 45,
      display_name: 'copy.pdf',
      display_name_source: 'filename',
      counterparty: null,
      read_as: null,
      accounting_status: 'rejected',
      duplicate_of: { id: 41, name: 'Costco Wholesale' },
    });
    render(<DocumentStatusList {...base} items={[copy]} />);
    const tr = rowOf('copy.pdf');
    expect(tr).toHaveTextContent('Already uploaded as Costco Wholesale');
    expect(tr).not.toHaveTextContent('Possible duplicate');
    expect(cellsOf(tr)[4]).toBe('Rejected');
  });

  it('says nothing about duplicates on a document the server links to none', () => {
    render(<DocumentStatusList {...base} items={[SUPPLIER_ROW, FILENAME_ROW, MANUAL_ROW]} />);
    for (const name of ['Costco Wholesale', 'scan-0007.pdf', 'May rent']) {
      const tr = rowOf(name);
      expect(tr).not.toHaveTextContent('duplicate');
      expect(tr).not.toHaveTextContent('Already uploaded');
    }
  });
});
