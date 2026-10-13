// DocumentFilters (Release E2-3, O-S89-E5 / O-S89-E7): the Tier 2 document
// list's filters — document date range, upload date range, supplier, name
// search, sort — each set filter shown as a chip that clears with one click,
// and "Clear all" when anything is set. PRESENTATIONAL: the state is the
// page's (held in the URL); this component only reports changes.
import { type FC, type FormEvent, useEffect, useState } from 'react';
import { DOCUMENT_SORTS, type DocumentListFilters } from '@/hooks/useDocumentList';

export interface SupplierOption {
  id: string;
  name: string;
}

interface Props {
  filters: DocumentListFilters;
  suppliers: SupplierOption[];
  // A change: the keys to set (undefined clears a key). The page goes back
  // to page one on any change.
  onChange: (patch: Partial<DocumentListFilters>) => void;
  onClear: () => void;
  // The status chip's label, so its chip reads as the chips do.
  statusLabel?: string | null;
}

const SORT_OPTIONS: { value: (typeof DOCUMENT_SORTS)[number]; label: string }[] = [
  { value: '-document_date', label: 'Document date, newest first' },
  { value: 'document_date', label: 'Document date, oldest first' },
  { value: '-created_at', label: 'Uploaded, newest first' },
  { value: 'created_at', label: 'Uploaded, oldest first' },
];

const fieldCls =
  'h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';

// A date range as a chip reads it: "from – to", "from –", "– to".
const rangeText = (from?: string, to?: string): string =>
  from && to ? `${from} – ${to}` : from ? `from ${from}` : `to ${to}`;

// One set filter as a chip: its label, and ✕ to clear just that one.
const Chip: FC<{ label: string; onClear: () => void; clearName: string }> = ({ label, onClear, clearName }) => (
  <span className="inline-flex h-8 items-center gap-2 rounded-lg bg-[var(--color-primary-light)] px-3 text-[13px] font-medium text-[var(--color-primary)]">
    <span>{label}</span>
    <button type="button" onClick={onClear} aria-label={clearName} className="hover:text-gray-900">
      ✕
    </button>
  </span>
);

export const DocumentFilters: FC<Props> = ({ filters, suppliers, onChange, onClear, statusLabel }) => {
  // The search is applied on submit (Enter or the button), never per
  // keystroke: each application is a request.
  const [draft, setDraft] = useState(filters.q ?? '');
  useEffect(() => {
    setDraft(filters.q ?? '');
  }, [filters.q]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    onChange({ q: q || undefined });
  };

  const supplierName = suppliers.find((s) => s.id === filters.counterparty)?.name;
  const chips: { key: string; label: string; clear: Partial<DocumentListFilters> }[] = [];
  if (filters.status) {
    chips.push({ key: 'status', label: `Status · ${statusLabel ?? filters.status}`, clear: { status: undefined } });
  }
  if (filters.documentDateFrom || filters.documentDateTo) {
    chips.push({
      key: 'document_date',
      label: `Document date · ${rangeText(filters.documentDateFrom, filters.documentDateTo)}`,
      clear: { documentDateFrom: undefined, documentDateTo: undefined },
    });
  }
  if (filters.uploadedFrom || filters.uploadedTo) {
    chips.push({
      key: 'uploaded',
      label: `Uploaded · ${rangeText(filters.uploadedFrom, filters.uploadedTo)}`,
      clear: { uploadedFrom: undefined, uploadedTo: undefined },
    });
  }
  if (filters.counterparty) {
    chips.push({
      key: 'supplier',
      label: `Supplier · ${supplierName ?? filters.counterparty.slice(0, 8)}`,
      clear: { counterparty: undefined },
    });
  }
  if (filters.q) {
    chips.push({ key: 'search', label: `Search · “${filters.q}”`, clear: { q: undefined } });
  }
  const anySet = chips.length > 0 || Boolean(filters.sort);

  return (
    <div className="space-y-3" data-testid="document-filters">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Document date from
          <input
            type="date"
            aria-label="Document date from"
            value={filters.documentDateFrom ?? ''}
            onChange={(e) => onChange({ documentDateFrom: e.target.value || undefined })}
            className={fieldCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          to
          <input
            type="date"
            aria-label="Document date to"
            value={filters.documentDateTo ?? ''}
            onChange={(e) => onChange({ documentDateTo: e.target.value || undefined })}
            className={fieldCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Uploaded from
          <input
            type="date"
            aria-label="Uploaded from"
            value={filters.uploadedFrom ?? ''}
            onChange={(e) => onChange({ uploadedFrom: e.target.value || undefined })}
            className={fieldCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          to
          <input
            type="date"
            aria-label="Uploaded to"
            value={filters.uploadedTo ?? ''}
            onChange={(e) => onChange({ uploadedTo: e.target.value || undefined })}
            className={fieldCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Supplier
          <select
            aria-label="Supplier"
            value={filters.counterparty ?? ''}
            onChange={(e) => onChange({ counterparty: e.target.value || undefined })}
            className={fieldCls}
          >
            <option value="">Any supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <form onSubmit={submitSearch} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Name
            <input
              type="search"
              aria-label="Search by name"
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Name, filename or supplier"
              className={`${fieldCls} w-56`}
            />
          </label>
          <button
            type="submit"
            className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-600 hover:bg-gray-50"
          >
            Search
          </button>
        </form>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Sort
          <select
            aria-label="Sort"
            value={filters.sort ?? ''}
            onChange={(e) => onChange({ sort: e.target.value || undefined })}
            className={fieldCls}
          >
            <option value="">Newest upload first</option>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {anySet && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              clearName={`Clear ${chip.key.replace('_', ' ')} filter`}
              onClear={() => onChange(chip.clear)}
            />
          ))}
          <button
            type="button"
            onClick={onClear}
            className="h-8 px-2 text-[13px] font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
