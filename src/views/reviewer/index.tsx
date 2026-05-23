import { type FC, useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '@/store/store';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewDoc {
  id: number;
  name: string;
  owner_email: string;
  created_at: string;
  extraction_status: string;
  review_status: 'pending_review' | 'approved' | 'corrected';
  reviewer_notes: string | null;
  extracted_data: LineItem[];
  corrected_data: CorrectedData | null;
  file_url: string | null;
}

interface LineItem {
  date?: string | null;
  vendor?: string | null;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  category?: string | null;
  low_confidence?: boolean;
}

interface CorrectedData {
  vendor?: string;
  date?: string;
  subtotal?: number;
  taxes?: number;
  tip?: number;
  total?: number;
  category?: string;
  currency?: string;
  description?: string;
}

interface FormState {
  vendor: string;
  date: string;
  category: string;
  currency: string;
  description: string;
  subtotal: string;
  taxes: string;
  tip: string;
  total: string;
  reviewer_notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isImage(url: string | null): boolean {
  if (!url) return false;
  const lower = url.split('?')[0].toLowerCase();
  return IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

function firstLineItem(doc: ReviewDoc): LineItem | null {
  return (doc.extracted_data ?? []).find((i) => i.description !== '_total') ?? null;
}

function totalItem(doc: ReviewDoc): LineItem | null {
  return (doc.extracted_data ?? []).find((i) => i.description === '_total') ?? null;
}

function buildForm(doc: ReviewDoc): FormState {
  if (doc.corrected_data) {
    const c = doc.corrected_data;
    return {
      vendor:         c.vendor       ?? '',
      date:           c.date         ?? '',
      category:       c.category     ?? '',
      currency:       c.currency     ?? 'CAD',
      description:    c.description  ?? '',
      subtotal:       c.subtotal     != null ? String(c.subtotal) : '',
      taxes:          c.taxes        != null ? String(c.taxes)    : '',
      tip:            c.tip          != null ? String(c.tip)      : '',
      total:          c.total        != null ? String(c.total)    : '',
      reviewer_notes: doc.reviewer_notes ?? '',
    };
  }
  const first  = firstLineItem(doc);
  const totRow = totalItem(doc);
  const lineItems = (doc.extracted_data ?? []).filter((i) => i.description !== '_total');
  const subtotal = lineItems.reduce(
    (s, i) => s + (typeof i.amount === 'number' ? i.amount : 0), 0,
  );
  return {
    vendor:         first?.vendor      ?? '',
    date:           first?.date        ?? '',
    category:       first?.category    ?? '',
    currency:       first?.currency    ?? 'CAD',
    description:    first?.description ?? '',
    subtotal:       subtotal > 0 ? subtotal.toFixed(2) : '',
    taxes:          '0.00',
    tip:            '0.00',
    total:          totRow?.amount != null
                      ? String(totRow.amount)
                      : subtotal > 0 ? subtotal.toFixed(2) : '',
    reviewer_notes: doc.reviewer_notes ?? '',
  };
}

function fmt(date: string) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? date : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Review status badge ───────────────────────────────────────────────────────

const REVIEW_STATUS: Record<ReviewDoc['review_status'], { label: string; cls: string }> = {
  pending_review: { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 ring-amber-200'  },
  approved:       { label: 'Approved',  cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  corrected:      { label: 'Corrected', cls: 'bg-blue-50 text-blue-700 ring-blue-200'     },
};

const ReviewBadge: FC<{ status: ReviewDoc['review_status'] }> = ({ status }) => {
  const { label, cls } = REVIEW_STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 ring-gray-200' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
};

// ─── Input helpers ────────────────────────────────────────────────────────────

const Label: FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
    {children}
  </label>
);

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition bg-white';

// ─── File preview ─────────────────────────────────────────────────────────────

const FilePreview: FC<{ doc: ReviewDoc | null }> = ({ doc }) => {
  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">Select a document to preview</p>
      </div>
    );
  }
  if (!doc.file_url) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-400">No file attached</p>
      </div>
    );
  }
  if (isImage(doc.file_url)) {
    return (
      <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
        <img
          src={doc.file_url}
          alt={doc.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-hidden">
      <iframe
        src={doc.file_url}
        title={doc.name}
        className="w-full h-full border-0"
      />
    </div>
  );
};

// ─── Right panel ──────────────────────────────────────────────────────────────

const RightPanel: FC<{
  doc: ReviewDoc | null;
  onApprove: (id: number) => Promise<void>;
  onCorrect: (id: number, form: FormState) => Promise<void>;
  saving: boolean;
}> = ({ doc, onApprove, onCorrect, saving }) => {
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    setForm(doc ? buildForm(doc) : null);
  }, [doc?.id]);

  // Auto-calculate total when subtotal/taxes/tip change
  useEffect(() => {
    if (!form) return;
    const sub  = parseFloat(form.subtotal) || 0;
    const tax  = parseFloat(form.taxes)    || 0;
    const tip  = parseFloat(form.tip)      || 0;
    const calc = (sub + tax + tip).toFixed(2);
    if (form.total !== calc) {
      setForm((f) => f ? { ...f, total: calc } : f);
    }
  }, [form?.subtotal, form?.taxes, form?.tip]);

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => f ? { ...f, [field]: e.target.value } : f);

  if (!doc || !form) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Select a document from the queue</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* File meta */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
          <p className="text-xs text-gray-400">{doc.owner_email} · {fmt(doc.created_at)}</p>
        </div>
        <ReviewBadge status={doc.review_status} />
      </div>

      {/* Top half — file preview */}
      <div className="h-[45%] shrink-0 flex flex-col overflow-hidden border-b border-gray-100">
        <FilePreview doc={doc} />
      </div>

      {/* Bottom half — form */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="px-6 py-5 space-y-4">

          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendor</Label>
              <input type="text" value={form.vendor} onChange={set('vendor')} placeholder="Store or business name" className={inputCls} />
            </div>
            <div>
              <Label>Date</Label>
              <input type="date" value={form.date} onChange={set('date')} className={inputCls} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={set('category')} className={inputCls}>
                <option value="">— Select category —</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Currency</Label>
              <input type="text" value={form.currency} onChange={set('currency')} placeholder="CAD" maxLength={3} className={inputCls} />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <input type="text" value={form.description} onChange={set('description')} placeholder="Brief description" className={inputCls} />
          </div>

          {/* Amounts row */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Subtotal</Label>
              <input type="number" step="0.01" min="0" value={form.subtotal} onChange={set('subtotal')} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <Label>Taxes</Label>
              <input type="number" step="0.01" min="0" value={form.taxes} onChange={set('taxes')} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <Label>Tip</Label>
              <input type="number" step="0.01" min="0" value={form.tip} onChange={set('tip')} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <Label>Total</Label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.total}
                onChange={set('total')}
                placeholder="0.00"
                className={`${inputCls} font-semibold`}
              />
            </div>
          </div>

          {/* Reviewer notes */}
          <div>
            <Label>Reviewer Notes</Label>
            <textarea
              value={form.reviewer_notes}
              onChange={set('reviewer_notes')}
              rows={2}
              placeholder="Optional notes about this document…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex gap-3">
        <button
          onClick={() => onApprove(doc.id)}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : '✓'}
          Approve
        </button>
        <button
          onClick={() => onCorrect(doc.id, form)}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : '💾'}
          Save Corrections
        </button>
      </div>
    </div>
  );
};

// ─── Reviewer Dashboard ───────────────────────────────────────────────────────

export const ReviewerDashboard: FC = () => {
  const navigate = useNavigate();
  const auth     = useSelector((s: RootState) => s.auth);
  const isStaff  = auth.user?.user?.is_staff ?? auth.user?.is_staff ?? false;

  const [docs, setDocs]           = useState<ReviewDoc[]>([]);
  const [selected, setSelected]   = useState<ReviewDoc | null>(null);
  const [mode, setMode]           = useState<'pending' | 'all'>('pending');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  // Redirect non-staff users
  useEffect(() => {
    if (!auth.inProgress && !isStaff) {
      navigate('/dashboard', { replace: true });
    }
  }, [auth.inProgress, isStaff, navigate]);

  const fetchDocs = useCallback(() => {
    const url = mode === 'pending' ? '/api/reviewer/queue/' : '/api/reviewer/queue/all/';
    setLoading(true);
    api.get(url)
      .then((res) => {
        if (Array.isArray(res?.data)) {
          setDocs(res.data);
          // Keep selection in sync — if selected doc still exists, update it
          setSelected((prev) => {
            if (!prev) return null;
            return res.data.find((d: ReviewDoc) => d.id === prev.id) ?? null;
          });
        }
      })
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const advanceQueue = (updatedDoc: ReviewDoc) => {
    setDocs((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    if (mode === 'pending') {
      // Remove the just-reviewed doc and select next pending
      const remaining = docs.filter((d) => d.id !== updatedDoc.id);
      setSelected(remaining[0] ?? null);
      setDocs(remaining);
    } else {
      setSelected(updatedDoc);
    }
  };

  const handleApprove = async (id: number) => {
    setSaving(true);
    try {
      const res = await api.post(`/api/reviewer/documents/${id}/approve/`);
      if (res?.data) advanceQueue(res.data);
    } finally {
      setSaving(false);
    }
  };

  const handleCorrect = async (id: number, form: FormState) => {
    setSaving(true);
    try {
      const corrected_data: CorrectedData = {
        vendor:      form.vendor      || undefined,
        date:        form.date        || undefined,
        category:    form.category    || undefined,
        currency:    form.currency    || 'CAD',
        description: form.description || undefined,
        subtotal:    parseFloat(form.subtotal) || 0,
        taxes:       parseFloat(form.taxes)    || 0,
        tip:         parseFloat(form.tip)      || 0,
        total:       parseFloat(form.total)    || 0,
      };
      const res = await api.post(`/api/reviewer/documents/${id}/correct/`, {
        corrected_data,
        reviewer_notes: form.reviewer_notes || null,
      });
      if (res?.data) advanceQueue(res.data);
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = docs.filter((d) => d.review_status === 'pending_review').length;

  if (auth.inProgress) return null;

  return (
    <div className="flex h-full overflow-hidden bg-white">

      {/* ── LEFT PANEL ── */}
      <div className="w-[30%] shrink-0 border-r border-gray-100 flex flex-col overflow-hidden bg-white">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-lg font-bold text-gray-900">Review Queue</h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-[#0066FF] text-white text-xs font-bold px-2 py-0.5 min-w-[22px]">
                {pendingCount}
              </span>
            )}
          </div>

          {/* Toggle */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            {(['pending', 'all'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  mode === m
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {m === 'pending' ? 'Pending' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 space-y-2">
                <div className="h-3.5 w-3/4 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
              </div>
            ))
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="text-3xl">🎉</div>
              <p className="text-sm font-medium text-gray-600">All caught up!</p>
              <p className="text-xs text-gray-400">No documents to review.</p>
            </div>
          ) : (
            docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelected(doc)}
                className={`w-full text-left rounded-xl px-4 py-3.5 transition-colors ${
                  selected?.id === doc.id
                    ? 'bg-[#0066FF]/8 ring-1 ring-[#0066FF]/30'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                    {doc.name}
                  </p>
                  <ReviewBadge status={doc.review_status} />
                </div>
                <p className="text-xs text-gray-400 truncate">{doc.owner_email}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmt(doc.created_at)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <RightPanel
        doc={selected}
        onApprove={handleApprove}
        onCorrect={handleCorrect}
        saving={saving}
      />
    </div>
  );
};
