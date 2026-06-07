import { type FC, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { useOrgMe, useAccounts, type Account } from '@/hooks/useAccounts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewLine {
  id: string;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  debit: string | null;
  credit: string | null;
  description: string;
  tax_code: string;
  line_order: number;
}

interface ReviewEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: string;
  source: string;
  confidence: string | null;
  agent_rationale: string | null;
  needs_review: boolean;
  routing_reason: string | null;
  source_document_id: number | null;
  source_document_name: string | null;
  source_document_url: string | null;
  total_debits: string;
  total_credits: string;
  lines: ReviewLine[];
  created_at: string;
  updated_at: string;
}

interface EditLine {
  account_id: string;
  debit: string;
  credit: string;
  description: string;
}

// ─── Constants / helpers ──────────────────────────────────────────────────────

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function isImage(url: string | null): boolean {
  if (!url) return false;
  const lower = url.split('?')[0].toLowerCase();
  return IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

function fmt(date: string) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? date : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toEditLines(entry: ReviewEntry): EditLine[] {
  return [...entry.lines]
    .sort((a, b) => a.line_order - b.line_order)
    .map((l) => ({
      account_id: l.account_id,
      debit: l.debit ?? '',
      credit: l.credit ?? '',
      description: l.description ?? '',
    }));
}

// ─── Badges ───────────────────────────────────────────────────────────────────

const ConfidenceBadge: FC<{ value: string | null }> = ({ value }) => {
  if (value == null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border bg-white/5 text-white/40 border-white/10">
        No confidence score
      </span>
    );
  }
  const pct = Math.round(parseFloat(value) * 100);
  const cls =
    pct >= 95
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : pct >= 80
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        : 'bg-red-500/10 text-red-400 border-red-500/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${cls}`}>
      {pct}% confidence
    </span>
  );
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/5 text-white/50 border-white/10',
  posted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  reversed: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const StatusBadge: FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
    {status}
  </span>
);

// ─── File preview (mirrors Tier-1 reviewer's FilePreview) ────────────────────

const FilePreview: FC<{ entry: ReviewEntry | null }> = ({ entry }) => {
  if (!entry) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white/[0.02]">
        <p className="text-sm text-white/30">Select an entry to preview its source document</p>
      </div>
    );
  }
  if (!entry.source_document_url) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white/[0.02]">
        <p className="text-sm text-white/30">No source document attached</p>
      </div>
    );
  }
  if (isImage(entry.source_document_url)) {
    return (
      <div className="flex-1 overflow-hidden bg-white/[0.02] flex items-center justify-center">
        <img
          src={entry.source_document_url}
          alt={entry.source_document_name ?? 'Source document'}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-hidden">
      <iframe
        src={entry.source_document_url}
        title={entry.source_document_name ?? 'Source document'}
        className="w-full h-full border-0"
      />
    </div>
  );
};

// ─── Editable line row ────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-white/15 bg-[#0f172a] px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition';

const LineRow: FC<{
  line: EditLine;
  accounts: Account[];
  onChange: (next: EditLine) => void;
}> = ({ line, accounts, onChange }) => {
  const set = (field: keyof EditLine) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...line, [field]: e.target.value });

  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-5">
        <select value={line.account_id} onChange={set('account_id')} className={inputCls}>
          <option value="">— Select account —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <input type="number" step="0.01" min="0" value={line.debit} onChange={set('debit')} placeholder="Debit" className={inputCls} />
      </div>
      <div className="col-span-2">
        <input type="number" step="0.01" min="0" value={line.credit} onChange={set('credit')} placeholder="Credit" className={inputCls} />
      </div>
      <div className="col-span-3">
        <input type="text" value={line.description} onChange={set('description')} placeholder="Line description" className={inputCls} />
      </div>
    </div>
  );
};

// ─── Right panel ──────────────────────────────────────────────────────────────

const RightPanel: FC<{
  entry: ReviewEntry | null;
  accounts: Account[];
  onSave: (id: string, description: string, lines: EditLine[]) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  saving: boolean;
}> = ({ entry, accounts, onSave, onApprove, saving }) => {
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<EditLine[]>([]);

  useEffect(() => {
    setDescription(entry?.description ?? '');
    setLines(entry ? toEditLines(entry) : []);
  }, [entry?.id]);

  if (!entry) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-white/[0.02]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white/40">Select a draft from the queue</p>
          </div>
        </div>
      </div>
    );
  }

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Entry meta */}
      <div className="px-6 py-3 border-b border-white/10 bg-[#0A1628] shrink-0 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {entry.entry_number} · {entry.source_document_name ?? 'No source document'}
          </p>
          <p className="text-xs text-white/40">{fmt(entry.entry_date)} · created {fmt(entry.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceBadge value={entry.confidence} />
          <StatusBadge status={entry.status} />
        </div>
      </div>

      {/* Top half — source document preview */}
      <div className="h-[35%] shrink-0 flex flex-col overflow-hidden border-b border-white/10">
        <FilePreview entry={entry} />
      </div>

      {/* Bottom half — agent reasoning + editable lines */}
      <div className="flex-1 overflow-y-auto bg-white/[0.02]">
        <div className="px-6 py-5 space-y-5">

          {/* Why this needs review */}
          {(entry.routing_reason || entry.agent_rationale) && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-4 py-3 space-y-1.5">
              {entry.routing_reason && (
                <p className="text-xs text-amber-400">
                  <span className="font-semibold uppercase tracking-wide">Routed to review: </span>
                  {entry.routing_reason}
                </p>
              )}
              {entry.agent_rationale && (
                <p className="text-xs text-white/50 leading-relaxed">
                  <span className="font-semibold uppercase tracking-wide text-white/40">Agent rationale: </span>
                  {entry.agent_rationale}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Entry description"
              className={inputCls}
            />
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide">Proposed lines</label>
              <span className={`text-xs font-medium ${balanced ? 'text-emerald-400' : 'text-red-400'}`}>
                Dr {totalDebit.toFixed(2)} · Cr {totalCredit.toFixed(2)} {balanced ? '(balanced)' : '(unbalanced)'}
              </span>
            </div>
            <div className="grid grid-cols-12 gap-2 px-0.5 mb-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
              <div className="col-span-5">Account</div>
              <div className="col-span-2">Debit</div>
              <div className="col-span-2">Credit</div>
              <div className="col-span-3">Description</div>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <LineRow
                  key={i}
                  line={line}
                  accounts={accounts}
                  onChange={(next) => setLines((prev) => prev.map((l, idx) => (idx === i ? next : l)))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="shrink-0 px-6 py-4 border-t border-white/10 bg-[#0A1628] flex gap-3">
        <button
          onClick={() => onSave(entry.id, description, lines)}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '💾'}
          Save edits
        </button>
        <button
          onClick={() => onApprove(entry.id)}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✓'}
          Approve &amp; Post
        </button>
      </div>
    </div>
  );
};

// ─── Accounting Review queue ──────────────────────────────────────────────────

export const AccountingReview: FC = () => {
  const navigate = useNavigate();
  const { role, isLoading: orgLoading } = useOrgMe();
  const canReview = role === 'owner' || role === 'bookkeeper';

  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [selected, setSelected] = useState<ReviewEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { accounts } = useAccounts({ active: true });

  // Redirect users without review access — same structural pattern as the
  // Tier-1 reviewer's isStaff redirect, gated on org role instead (the
  // backend enforces org-role on this queue, not is_staff).
  useEffect(() => {
    if (!orgLoading && !canReview) {
      navigate('/dashboard', { replace: true });
    }
  }, [orgLoading, canReview, navigate]);

  const fetchEntries = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/accounting/review/')
      .then((res) => {
        if (Array.isArray(res?.data)) {
          setEntries(res.data);
          setSelected((prev) => {
            if (!prev) return null;
            return res.data.find((e: ReviewEntry) => e.id === prev.id) ?? null;
          });
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? 'Failed to load the review queue');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const advanceQueue = (updatedEntry: ReviewEntry, removeFromQueue: boolean) => {
    if (removeFromQueue) {
      const remaining = entries.filter((e) => e.id !== updatedEntry.id);
      setEntries(remaining);
      setSelected(remaining[0] ?? null);
    } else {
      setEntries((prev) => prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e)));
      setSelected(updatedEntry);
    }
  };

  const handleSave = async (id: string, description: string, lines: EditLine[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch(`/api/accounting/review/${id}/`, {
        description,
        lines: lines.map((l, i) => ({
          account_id: l.account_id,
          debit: l.debit !== '' ? l.debit : null,
          credit: l.credit !== '' ? l.credit : null,
          description: l.description,
          line_order: i,
        })),
      });
      if (res?.data) advanceQueue(res.data, false);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.response?.data?.non_field_errors?.[0] ?? 'Failed to save edits');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/api/accounting/review/${id}/approve/`);
      if (res?.data) advanceQueue(res.data, true);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to approve and post this entry');
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading || !canReview) return null;

  return (
    <div className="flex h-full overflow-hidden bg-[#0f172a] text-white">

      {/* ── LEFT PANEL — queue ── */}
      <div className="w-[32%] shrink-0 border-r border-white/10 flex flex-col overflow-hidden bg-[#0f172a]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold text-white">Accounting Review</h1>
            {entries.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-[#0066FF] text-white text-xs font-bold px-2 py-0.5 min-w-[22px]">
                {entries.length}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40">AI-drafted entries awaiting human review before posting</p>
        </div>

        {/* Error state */}
        {error && (
          <div className="mx-3 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 space-y-2">
                <div className="h-3.5 w-3/4 bg-white/8 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-white/8 rounded animate-pulse" />
              </div>
            ))
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="text-3xl">🎉</div>
              <p className="text-sm font-medium text-white/60">All caught up!</p>
              <p className="text-xs text-white/30">No drafts waiting for review.</p>
            </div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelected(entry)}
                className={`w-full text-left rounded-xl px-4 py-3.5 transition-colors ${
                  selected?.id === entry.id
                    ? 'bg-[#0066FF]/10 ring-1 ring-[#0066FF]/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-white truncate leading-tight">
                    {entry.source_document_name ?? entry.entry_number}
                  </p>
                  <ConfidenceBadge value={entry.confidence} />
                </div>
                <p className="text-xs text-white/40 truncate">{entry.description || '—'}</p>
                <p className="text-xs text-white/30 mt-0.5">{fmt(entry.entry_date)} · {entry.entry_number}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <RightPanel
        entry={selected}
        accounts={accounts}
        onSave={handleSave}
        onApprove={handleApprove}
        saving={saving}
      />
    </div>
  );
};
