import {
  type FC,
  type DragEvent,
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { getToken } from '@/utils/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  date?: string;
  vendor?: string;
  description?: string;
  category?: string;
  amount?: number;
  tax_amount?: number;
  currency?: string;
  low_confidence?: boolean;
}

interface Doc {
  id: number;
  name: string;
  created_at: string;
  type_file: string;
  size: number;
  file?: string | null;
  extraction_status: 'pending' | 'done' | 'failed' | 'needs_clarification' | 'unreadable';
  extracted_data: LineItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic', 'image/heif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);

const fmtBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;

const docDate = (doc: Doc) => {
  const raw = doc.extracted_data?.[0]?.date;
  const d = raw ? new Date(raw) : new Date(doc.created_at);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

const docVendor = (doc: Doc) =>
  doc.extracted_data?.[0]?.vendor?.trim() ||
  doc.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');

const docCategory = (doc: Doc) => doc.extracted_data?.[0]?.category ?? '—';

// Use the explicit _total row if present; otherwise sum purchased items only.
const docTotal = (doc: Doc) => {
  const items = doc.extracted_data ?? [];
  const totalRow = items.find((i) => i.description === '_total');
  if (totalRow && typeof totalRow.amount === 'number') return totalRow.amount;
  return items
    .filter((i) => i.description !== '_total')
    .reduce((s, item) => s + (typeof item.amount === 'number' ? item.amount : 0), 0);
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<Doc['extraction_status'], { label: string; cls: string }> = {
  done:                { label: 'Categorized',  cls: 'bg-emerald-50 text-emerald-700' },
  failed:              { label: 'Failed',        cls: 'bg-red-50 text-red-700'         },
  pending:             { label: 'Processing',    cls: 'bg-amber-50 text-amber-700'     },
  needs_clarification: { label: 'Needs review',  cls: 'bg-blue-50 text-blue-700'       },
  unreadable:          { label: 'Unreadable',    cls: 'bg-orange-50 text-orange-700'   },
};

const StatusBadge: FC<{ status: Doc['extraction_status'] }> = ({ status }) => {
  const { label, cls } = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

// ─── Details drawer ───────────────────────────────────────────────────────────

const DetailsDrawer: FC<{ doc: Doc | null; onClose: () => void; onEdit?: (doc: Doc) => void }> = ({ doc, onClose, onEdit }) => {
  if (!doc) return null;
  const allItems = doc.extracted_data ?? [];
  const items = allItems.filter((i) => i.description !== '_total');
  const totalAmount = docTotal(doc);
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900 truncate max-w-[280px]">
              {docVendor(doc)}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{docDate(doc)} · {fmtBytes(doc.size)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status */}
        <div className="px-6 py-3 border-b border-gray-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={doc.extraction_status} />
            {items.length > 0 && (
              <span className="text-xs text-gray-400">{items.length} line item{items.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {doc.file && (
            <a
              href={doc.file}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-[#0066FF] hover:underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View original
            </a>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {doc.extraction_status === 'failed' && (
            <div className="text-sm bg-red-50 rounded-lg px-4 py-3">
              <p className="text-red-600">AI extraction failed for this document. You can re-upload it or enter the data manually.</p>
              {onEdit && (
                <button
                  onClick={() => { onClose(); onEdit(doc); }}
                  className="mt-3 w-full rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  Enter data manually →
                </button>
              )}
            </div>
          )}
          {doc.extraction_status === 'pending' && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
              This document is still being processed.
            </p>
          )}
          {doc.extraction_status === 'needs_clarification' && (
            <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-3">
              The AI needs clarification on the category. Check Telegram for a follow-up.
            </p>
          )}
          {items.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Extracted line items</p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.description ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.category ?? '—'} {item.date ? `· ${item.date}` : ''}
                      </p>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {typeof item.amount === 'number' ? fmt(item.amount) : '—'}
                      </p>
                      {typeof item.tax_amount === 'number' && item.tax_amount > 0 && (
                        <p className="text-xs text-gray-400">Tax {fmt(item.tax_amount)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-600">Total</span>
                <span className="text-sm font-bold text-gray-900">{fmt(totalAmount)}</span>
              </div>
            </div>
          )}
          {items.length === 0 && doc.extraction_status === 'done' && (
            <p className="text-sm text-gray-400">No line items were extracted.</p>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Upload zone ──────────────────────────────────────────────────────────────

interface UploadZoneProps {
  onFile: (file: File) => void;
  uploading: boolean;
  error: string;
}

const UploadZone: FC<UploadZoneProps> = ({ onFile, uploading, error }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  return (
    <div className="mb-8">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-12 transition-colors cursor-pointer ${
          drag
            ? 'border-[#0066FF] bg-blue-50'
            : uploading
            ? 'border-gray-200 bg-gray-50 cursor-wait'
            : 'border-gray-200 bg-white hover:border-[#0066FF] hover:bg-blue-50/40'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Uploading and extracting data…</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#0066FF]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">
              Drag & drop a receipt or invoice, or{' '}
              <span className="text-[#0066FF]">browse</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">JPEG, PNG, WebP, HEIC or PDF · Max 10 MB</p>
          </>
        )}
      </div>

      {error === '__trial_expired__' ? (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-4">
          <span>You've used your 5 free trial documents — choose a plan to continue.</span>
          <Link
            to="/subscription"
            className="shrink-0 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            Upgrade now →
          </Link>
        </div>
      ) : error === '__quota_docs__' ? (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-4">
          <span>You've reached your document quota.</span>
          <Link
            to="/subscription"
            className="shrink-0 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            Upgrade now →
          </Link>
        </div>
      ) : error === '__quota_storage__' ? (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-4">
          <span>You've run out of storage space.</span>
          <Link
            to="/subscription"
            className="shrink-0 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            Upgrade now →
          </Link>
        </div>
      ) : error ? (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr>
    {[72, 140, 110, 80, 90, 40].map((w, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Groceries',
  'Meals & Entertainment',
  'Office Supplies',
  'Travel & Transportation',
  'Fuel & Vehicle',
  'Software & Subscriptions',
  'Professional Services',
  'Utilities & Communications',
  'Advertising & Marketing',
  'Insurance',
  'Other Business Expenses',
] as const;

// ─── Edit drawer ───────────────────────────────────────────────────────────────

interface EditForm {
  vendor: string;
  category: string;
  amount: string;
  date: string;
  notes?: string;
}

const EditDrawer: FC<{
  doc: Doc;
  onSave: (id: number, form: EditForm) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}> = ({ doc, onSave, onClose, saving }) => {
  const existingNotes = (doc.extracted_data ?? []).find((i: any) => i.description === '_notes');
  const [form, setForm] = useState<EditForm>({
    vendor:   docVendor(doc),
    category: docCategory(doc) === '—' ? '' : docCategory(doc),
    amount:   docTotal(doc) > 0 ? String(docTotal(doc)) : '',
    date:     doc.extracted_data?.[0]?.date ?? '',
    notes:    (existingNotes as any)?.notes ?? '',
  });

  const set = (field: keyof EditForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(doc.id, form);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit document</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{doc.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor</label>
            <input
              type="text"
              value={form.vendor}
              onChange={set('vendor')}
              placeholder="Store or business name"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={set('category')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition bg-white"
            >
              <option value="">— Select category —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Total amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={set('amount')}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 pl-8 pr-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
              />
            </div>
          </div>

          {form.category === 'Meals & Entertainment' && (
            <p className="text-xs text-gray-400 italic -mt-2">
              Include any gratuity in the total amount paid.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={set('date')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea
              value={form.notes ?? ''}
              onChange={set('notes')}
              placeholder="e.g. Business lunch with client, includes tip"
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={(e) => { e.preventDefault(); onSave(doc.id, form); }}
            className="flex-1 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
              : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
};

// ─── Confirm delete modal ─────────────────────────────────────────────────────

const ConfirmDeleteModal: FC<{
  doc: Doc;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ doc, deleting, onConfirm, onCancel }) => (
  <>
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Delete document?</h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-[220px]">{docVendor(doc)}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          This will permanently remove the document and restore your upload quota. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting…</>
              : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  </>
);

// ─── Documents page ───────────────────────────────────────────────────────────

export const Documents: FC = () => {
  const [docs, setDocs]           = useState<Doc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [selected, setSelected]   = useState<Doc | null>(null);
  const [confirmDoc, setConfirmDoc] = useState<Doc | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editDoc, setEditDoc]       = useState<Doc | null>(null);
  const [saving, setSaving]         = useState(false);

  const fetchDocs = useCallback(() => {
    api
      .get('/api/documents/')
      .then((res) => { if (Array.isArray(res?.data)) setDocs(res.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleFile = async (file: File) => {
    // Safari on iOS/macOS sometimes reports an empty MIME for HEIC — fall back
    // to the filename so those uploads aren't blocked client-side (the backend
    // validates by magic bytes regardless).
    const isHeicByName = file.type === '' && /\.(heic|heif)$/i.test(file.name);
    if (!ACCEPTED.includes(file.type) && !isHeicByName) {
      setUploadErr('Only JPEG, PNG, WebP, HEIC images and PDFs are accepted.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadErr('File must be under 10 MB.');
      return;
    }

    setUploading(true);
    setUploadErr('');

    // ── Diagnostics (remove once upload is confirmed working) ──────────────
    const token = getToken();
    console.log('[upload] cookie token present:', !!token);
    console.log('[upload] Authorization header will be:', `Bearer ${token}`);
    console.log('[upload] posting to: /api/documents/upload');
    console.log('[upload] file:', { name: file.name, type: file.type, size: file.size });
    // ───────────────────────────────────────────────────────────────────────

    try {
      const b64 = await toBase64(file);
      const res = await api.post('/api/documents/upload', {
        image: b64,
        type: file.type,
        name: file.name,
      });

      console.log('[upload] response status:', res?.status);
      console.log('[upload] response data:', res?.data);

      if (res?.status === 201) {
        fetchDocs();
      } else {
        const code = res?.data?.error_code;
        const msg  = res?.data?.error;
        console.warn('[upload] non-201 response — error_code:', code, '| error:', msg);
        if (code === 'trial_expired') {
          setUploadErr('__trial_expired__');
        } else if (code === 'not_enough_documents') {
          setUploadErr('__quota_docs__');
        } else if (code === 'not_enough_storage') {
          setUploadErr('__quota_storage__');
        } else {
          setUploadErr(msg ?? 'Upload failed. Please try again.');
        }
      }
    } catch (err: unknown) {
      console.error('[upload] caught exception:', err);
      setUploadErr('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (id: number, form: EditForm) => {
    setSaving(true);
    try {
      const res = await api.patch(`/api/documents/${id}/`, {
        vendor:   form.vendor   || undefined,
        category: form.category || undefined,
        amount:   form.amount   ? parseFloat(form.amount) : undefined,
        date:     form.date     || undefined,
        notes:    form.notes    ?? '',
      });
      if (res?.data) {
        setDocs((prev) => prev.map((d) => (d.id === id ? (res.data as Doc) : d)));
      }
      setEditDoc(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: Doc) => {
    setDeletingId(doc.id);
    try {
      await api.delete(`/api/documents/${doc.id}/`);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } finally {
      setDeletingId(null);
      setConfirmDoc(null);
    }
  };

  const sorted = [...docs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto px-8 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload receipts and invoices — AI extracts and categorizes them automatically.
          </p>
        </div>

        {/* Upload zone */}
        <UploadZone onFile={handleFile} uploading={uploading} error={uploadErr} />

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              All Documents
              {!loading && docs.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {docs.length} total
                </span>
              )}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Date', 'Vendor', 'Category', 'Amount', 'Status', '', ''].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-600">No documents yet</p>
                        <p className="text-xs text-gray-400">Upload your first receipt or invoice above.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sorted.map((doc) => (
                    <tr key={doc.id} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{docDate(doc)}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 max-w-[180px] truncate">
                        {docVendor(doc)}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{docCategory(doc)}</td>
                      <td className="px-6 py-4 font-medium text-gray-900 tabular-nums whitespace-nowrap">
                        {docTotal(doc) > 0 ? fmt(docTotal(doc)) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={doc.extraction_status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelected(doc)}
                            className="text-xs font-medium text-[#0066FF] hover:underline"
                          >
                            Details
                          </button>
                          {doc.file && (
                            <a
                              href={doc.file}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
                              title="View original file"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 w-20">
                        <div className="flex items-center gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => setEditDoc(doc)}
                            title="Edit document"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#0066FF] hover:bg-blue-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setConfirmDoc(doc)}
                            title="Delete document"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Details drawer */}
      <DetailsDrawer
        doc={selected}
        onClose={() => setSelected(null)}
        onEdit={(doc) => { setSelected(null); setEditDoc(doc); }}
      />

      {/* Edit drawer */}
      {editDoc && (
        <EditDrawer
          doc={editDoc}
          saving={saving}
          onSave={handleSave}
          onClose={() => setEditDoc(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDoc && (
        <ConfirmDeleteModal
          doc={confirmDoc}
          deleting={deletingId === confirmDoc.id}
          onConfirm={() => handleDelete(confirmDoc)}
          onCancel={() => setConfirmDoc(null)}
        />
      )}
    </div>
  );
};
