// Tier 2 upload zone (§14 14A-3, D-14A3-2/3/7). Its OWN Tier 2 component —
// visual + interaction patterns are reused from the live Tier 1 upload zone
// (src/views/documents/index.tsx) but NOTHING is imported from Tier 1: only
// the shared api client and design tokens. Tier 2's upload is a two-step
// chain per file — POST the document (Tier 1 endpoint, shared), then trigger
// the Tier 2 accounting extraction so the agent picks the document up.
//
// Files are processed STRICTLY SEQUENTIALLY: each upload decrements the plan
// quota and each extract is charged against the per-org daily extraction
// throttle, so a burst would both over-spend and trip the throttle. One file
// at a time, awaited end-to-end.
import { type FC, type DragEvent, type ChangeEvent, useRef, useState } from 'react';
import api from '@/utils/api';

// Same accept list as the Tier 1 live input.
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif,.heic,.heif';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB client cap — oversize files are never sent.

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Calm, owner-facing strings — no internals, no error-body text ever rendered.
const MSG = {
  uploading: 'Uploading…',
  uploaded: 'Uploaded',
  throttled: 'Uploaded — daily processing limit reached, resumes tomorrow',
  delayed: 'Uploaded — processing delayed',
  oversize: 'File exceeds 10 MB',
  errDocs: 'Document limit reached for your plan',
  errStorage: 'Storage limit reached for your plan',
  errUnsupported: "This file type isn't supported",
  errUpload: 'Upload failed — please try again',
} as const;

type Tone = 'pending' | 'ok' | 'warn' | 'error';
type CardState = 'uploading' | 'done';

interface FileCard {
  id: number;
  name: string;
  state: CardState;
  message: string;
  tone: Tone;
}

interface Props {
  // Called after each successful upload+extract chain (a document reached the
  // server). Commit 3 wires it to the status-list refetch; unused-safe now.
  onUploaded?: () => void;
}

export const Tier2UploadZone: FC<Props> = ({ onUploaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<FileCard[]>([]);

  const cardId = useRef(0);
  // Once the daily extraction limit is hit, suppress ALL further extract calls
  // for the life of this component — subsequent files still upload and get the
  // same calm message rather than each re-hitting the throttle.
  const throttledRef = useRef(false);

  const addCard = (name: string, state: CardState, message: string, tone: Tone): number => {
    const id = cardId.current++;
    setCards((prev) => [{ id, name, state, message, tone }, ...prev]);
    return id;
  };
  const updateCard = (id: number, message: string, tone: Tone) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, state: 'done', message, tone } : c)));
  };

  // The api interceptor resolves non-401 HTTP errors (returns error.response)
  // and resolves cancellations to null; a terminal-401 rejects. The try/catch
  // is only a safety net turning a thrown terminal-401 into a null response so
  // the sequential loop never dies mid-batch — all OUTCOME branching is on the
  // resolved response's status, never on the exception.
  const post = async (url: string, body: unknown): Promise<any | null> => {
    try {
      return await api.post(url, body);
    } catch {
      return null;
    }
  };

  // Map an upload response to a card message; null message means 201 success.
  const uploadErrorMessage = (res: any): string | null => {
    if (res?.status === 201) return null;
    const code = res?.data?.error_code;
    if (code === 'not_enough_documents') return MSG.errDocs;
    if (code === 'not_enough_storage') return MSG.errStorage;
    if (res?.status === 400) return MSG.errUnsupported; // invalid_file / other 400 validation
    return MSG.errUpload; // 500 / null / anything else
  };

  // POST the Tier 2 extract trigger (empty body). One automatic retry on any
  // non-2xx that isn't a throttle. 429 → session-wide suppression.
  const runExtract = async (documentId: number): Promise<'ok' | 'throttled' | 'failed'> => {
    if (throttledRef.current) return 'throttled';
    const url = `/api/accounting/documents/${documentId}/extract/`;

    let res = await post(url, {});
    if (res?.status === 429) { throttledRef.current = true; return 'throttled'; }
    if (res?.status >= 200 && res?.status < 300) return 'ok';

    // one automatic retry
    res = await post(url, {});
    if (res?.status === 429) { throttledRef.current = true; return 'throttled'; }
    if (res?.status >= 200 && res?.status < 300) return 'ok';
    return 'failed';
  };

  const processOne = async (file: File) => {
    if (file.size > MAX_BYTES) {
      addCard(file.name, 'done', MSG.oversize, 'error'); // never sent
      return;
    }

    const id = addCard(file.name, 'uploading', MSG.uploading, 'pending');

    let b64: string;
    try {
      b64 = await toBase64(file);
    } catch {
      updateCard(id, MSG.errUpload, 'error');
      return;
    }

    const res = await post('/api/documents/upload', { image: b64, type: file.type, name: file.name });
    const errMsg = uploadErrorMessage(res);
    if (errMsg) { updateCard(id, errMsg, 'error'); return; }

    // 201 (incl. "uploaded with extraction failure") — the document row exists.
    const documentId = res?.data?.document_id;
    if (documentId == null) {
      updateCard(id, MSG.delayed, 'warn');
      onUploaded?.();
      return;
    }

    const verdict = await runExtract(documentId);
    if (verdict === 'ok') updateCard(id, MSG.uploaded, 'ok');
    else if (verdict === 'throttled') updateCard(id, MSG.throttled, 'warn');
    else updateCard(id, MSG.delayed, 'warn'); // upload is never rolled back on extract failure

    onUploaded?.();
  };

  const processFiles = async (files: FileList) => {
    setBusy(true);
    for (const file of Array.from(files)) {
      await processOne(file); // strictly one at a time
    }
    setBusy(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    if (busy) return;
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (busy) { e.target.value = ''; return; }
    if (e.target.files?.length) processFiles(e.target.files);
    e.target.value = '';
  };

  const toneClass: Record<Tone, string> = {
    pending: 'text-gray-500',
    ok: 'text-emerald-600',
    warn: 'text-amber-600',
    error: 'text-red-600',
  };

  return (
    <div>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 transition-colors ${
          busy
            ? 'border-gray-200 bg-gray-50 cursor-wait'
            : drag
            ? 'border-[#0066FF] bg-blue-50 cursor-pointer'
            : 'border-gray-200 bg-white hover:border-[#0066FF] hover:bg-blue-50/40 cursor-pointer'
        }`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Uploading and processing…</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#0066FF]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">
              Drag &amp; drop receipts or invoices, or <span className="text-[#0066FF]">browse</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">JPEG, PNG, WebP, HEIC or PDF · Max 10 MB · multiple files welcome</p>
          </>
        )}
      </div>

      {/* Per-file cards — nothing disappears silently (D-14A3-7). */}
      {cards.length > 0 && (
        <ul className="mt-4 space-y-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-white px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{card.name}</span>
              <span className={`flex shrink-0 items-center gap-2 text-xs font-medium ${toneClass[card.tone]}`}>
                {card.state === 'uploading' && (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {card.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
};
