// DocumentFilters (Release E2-3, O-S89-E5 / O-S89-E7): the document list's
// filters report changes under the hook's keys; each set filter is a chip
// that clears with one click; "Clear all" shows only when something is set.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentFilters } from './DocumentFilters';

const SUPPLIER_A = 'c0c0c0c0-0000-4000-8000-000000000001';
const SUPPLIER_B = 'c0c0c0c0-0000-4000-8000-000000000002';
const SUPPLIERS = [
  { id: SUPPLIER_A, name: 'Costco Wholesale' },
  { id: SUPPLIER_B, name: 'Office Depot' },
];

const onChange = vi.fn();
const onClear = vi.fn();
const renderFilters = (filters = {}, statusLabel: string | null = null) =>
  render(
    <DocumentFilters
      filters={filters}
      suppliers={SUPPLIERS}
      onChange={onChange}
      onClear={onClear}
      statusLabel={statusLabel}
    />,
  );

beforeEach(() => {
  onChange.mockReset();
  onClear.mockReset();
});

describe('the document filters', () => {
  it('offers both date ranges, the suppliers by name, a name search and the sorts; nothing set shows no chip', () => {
    renderFilters();
    for (const name of ['Document date from', 'Document date to', 'Uploaded from', 'Uploaded to']) {
      expect(screen.getByLabelText(name)).toHaveValue('');
    }
    const supplier = screen.getByRole('combobox', { name: 'Supplier' });
    expect(within(supplier).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Any supplier',
      'Costco Wholesale',
      'Office Depot',
    ]);
    const sort = screen.getByRole('combobox', { name: 'Sort' });
    expect(within(sort).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual([
      '',
      '-document_date',
      'document_date',
      '-created_at',
      'created_at',
    ]);
    expect(screen.queryByLabelText('Active filters')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a document date range under its keys, and clears a side when it is emptied', () => {
    const view = renderFilters();
    fireEvent.change(screen.getByLabelText('Document date from'), { target: { value: '2026-05-01' } });
    expect(onChange).toHaveBeenLastCalledWith({ documentDateFrom: '2026-05-01' });
    fireEvent.change(screen.getByLabelText('Document date to'), { target: { value: '2026-05-31' } });
    expect(onChange).toHaveBeenLastCalledWith({ documentDateTo: '2026-05-31' });
    // The fields show the state they are given; emptying a set side clears it.
    view.rerender(
      <DocumentFilters
        filters={{ documentDateFrom: '2026-05-01', documentDateTo: '2026-05-31' }}
        suppliers={SUPPLIERS}
        onChange={onChange}
        onClear={onClear}
      />,
    );
    expect(screen.getByLabelText('Document date to')).toHaveValue('2026-05-31');
    fireEvent.change(screen.getByLabelText('Document date to'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ documentDateTo: undefined });
  });

  it('reports an upload date range under its keys', () => {
    renderFilters();
    fireEvent.change(screen.getByLabelText('Uploaded from'), { target: { value: '2026-04-01' } });
    expect(onChange).toHaveBeenLastCalledWith({ uploadedFrom: '2026-04-01' });
    fireEvent.change(screen.getByLabelText('Uploaded to'), { target: { value: '2026-04-30' } });
    expect(onChange).toHaveBeenLastCalledWith({ uploadedTo: '2026-04-30' });
  });

  it('reports the chosen supplier by its id, and Any supplier clears it', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Supplier' }), 'Office Depot');
    expect(onChange).toHaveBeenLastCalledWith({ counterparty: SUPPLIER_B });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Supplier' }), 'Any supplier');
    expect(onChange).toHaveBeenLastCalledWith({ counterparty: undefined });
  });

  it('applies the name search on submit only, trimmed, and a blank search clears it', async () => {
    const user = userEvent.setup();
    renderFilters();
    const search = screen.getByRole('searchbox', { name: 'Search by name' });
    await user.type(search, '  costco ');
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ q: 'costco' });
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(onChange).toHaveBeenLastCalledWith({ q: undefined });
    expect(search).toHaveAttribute('maxlength', '100');
  });

  it('reports the sort, and the default clears it', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'Document date, oldest first');
    expect(onChange).toHaveBeenLastCalledWith({ sort: 'document_date' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'Newest upload first');
    expect(onChange).toHaveBeenLastCalledWith({ sort: undefined });
  });

  it('shows every set filter as a chip that clears with one click, in the server\'s words', async () => {
    const user = userEvent.setup();
    renderFilters(
      {
        status: 'posted',
        documentDateFrom: '2026-05-01',
        documentDateTo: '2026-05-31',
        uploadedFrom: '2026-04-01',
        counterparty: SUPPLIER_A,
        q: 'costco',
      },
      'Posted',
    );
    const chips = screen.getByLabelText('Active filters');
    expect(chips).toHaveTextContent('Status · Posted');
    expect(chips).toHaveTextContent('Document date · 2026-05-01 – 2026-05-31');
    expect(chips).toHaveTextContent('Uploaded · from 2026-04-01');
    expect(chips).toHaveTextContent('Supplier · Costco Wholesale');
    expect(chips).toHaveTextContent('Search · “costco”');

    await user.click(within(chips).getByRole('button', { name: 'Clear document date filter' }));
    expect(onChange).toHaveBeenLastCalledWith({ documentDateFrom: undefined, documentDateTo: undefined });
    await user.click(within(chips).getByRole('button', { name: 'Clear supplier filter' }));
    expect(onChange).toHaveBeenLastCalledWith({ counterparty: undefined });
    await user.click(within(chips).getByRole('button', { name: 'Clear status filter' }));
    expect(onChange).toHaveBeenLastCalledWith({ status: undefined });
    await user.click(within(chips).getByRole('button', { name: 'Clear search filter' }));
    expect(onChange).toHaveBeenLastCalledWith({ q: undefined });
    await user.click(within(chips).getByRole('button', { name: 'Clear uploaded filter' }));
    expect(onChange).toHaveBeenLastCalledWith({ uploadedFrom: undefined, uploadedTo: undefined });
    expect(onClear).not.toHaveBeenCalled();
  });

  it('Clear all shows only when something is set, and clears everything at once; the fields show the state', async () => {
    const user = userEvent.setup();
    const view = renderFilters({ q: 'costco', sort: '-document_date', counterparty: SUPPLIER_B });
    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('costco');
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('-document_date');
    expect(screen.getByRole('combobox', { name: 'Supplier' })).toHaveValue(SUPPLIER_B);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClear).toHaveBeenCalledTimes(1);

    view.rerender(
      <DocumentFilters filters={{}} suppliers={SUPPLIERS} onChange={onChange} onClear={onClear} />,
    );
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('');
  });
});
