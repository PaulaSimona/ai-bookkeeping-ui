// Tier2UploadZone (Release E2-5, O-S89-E6): before a file is uploaded its
// SHA-256 is computed in the browser and the server is asked whether the
// same bytes are already in the org's books. An exact copy is stopped with
// "Already uploaded as <name> on <date>" and a way to open that document;
// otherwise — found nothing, no answer, no WebCrypto — the upload proceeds
// exactly as before: POST the document, then the Tier 2 extract.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '@/utils/api';
import { fileSha256 } from '@/utils/fileSha256';
import { Tier2UploadZone } from './Tier2UploadZone';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/utils/fileSha256', () => ({ fileSha256: vi.fn() }));

const post = api.post as unknown as Mock<(url: string, body?: unknown) => Promise<unknown>>;
const sha = fileSha256 as unknown as Mock<(file: Blob) => Promise<string | null>>;

const UPLOAD_URL = '/api/documents/upload';
const PRECHECK_URL = '/api/accounting/documents/precheck/';
const HASH = 'ab'.repeat(32);

const file = (name = 'receipt.pdf') =>
  new File([new TextEncoder().encode('%PDF-1.4 receipt')], name, { type: 'application/pdf' });

// What the server answers to each POST, by URL.
const serve = (answers: Record<string, unknown>) => {
  post.mockImplementation((url) => Promise.resolve(answers[url] ?? { status: 404, data: {} }));
};

const upload = async (user: ReturnType<typeof userEvent.setup>, f: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, f);
};

const postsTo = (url: string) => post.mock.calls.filter(([u]) => u === url);

beforeEach(() => {
  post.mockReset();
  sha.mockReset();
  sha.mockResolvedValue(HASH);
});

describe('the upload zone and the pre-upload duplicate check', () => {
  it('hashes the file and asks the server first, then uploads and extracts when nothing is found', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    serve({
      [PRECHECK_URL]: { status: 200, data: { exists: false } },
      [UPLOAD_URL]: { status: 201, data: { document_id: 41 } },
      '/api/accounting/documents/41/extract/': { status: 200, data: {} },
    });
    render(<Tier2UploadZone onUploaded={onUploaded} />);

    await upload(user, file());

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(post.mock.calls.map(([u]) => u)).toEqual([
      PRECHECK_URL,
      UPLOAD_URL,
      '/api/accounting/documents/41/extract/',
    ]);
    expect(postsTo(PRECHECK_URL)[0][1]).toEqual({ sha256: HASH });
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('stops an exact copy: says what it was uploaded as and when, offers to open it, and never posts the file', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    const onOpenDocument = vi.fn();
    serve({
      [PRECHECK_URL]: {
        status: 200,
        data: { exists: true, document_id: 41, name: 'Costco Wholesale', uploaded_at: '2026-05-05T10:00:01Z' },
      },
      [UPLOAD_URL]: { status: 201, data: { document_id: 99 } },
    });
    render(<Tier2UploadZone onUploaded={onUploaded} onOpenDocument={onOpenDocument} />);

    await upload(user, file('copy.pdf'));

    expect(await screen.findByText('Already uploaded as Costco Wholesale on 2026-05-05')).toBeInTheDocument();
    expect(postsTo(UPLOAD_URL)).toHaveLength(0);
    expect(onUploaded).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Open Costco Wholesale' }));
    expect(onOpenDocument).toHaveBeenCalledWith(41);
    // The file's own name is still on its card.
    expect(screen.getByText('copy.pdf')).toBeInTheDocument();
  });

  it('uploads anyway when the check has no answer — a limit, a refusal or a lost connection never blocks', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    post.mockImplementation((url) => {
      if (url === PRECHECK_URL) return Promise.resolve({ status: 429, data: { detail: 'Request was throttled.' } });
      if (url === UPLOAD_URL) return Promise.resolve({ status: 201, data: { document_id: 41 } });
      return Promise.resolve({ status: 200, data: {} });
    });
    render(<Tier2UploadZone onUploaded={onUploaded} />);
    await upload(user, file());
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(postsTo(UPLOAD_URL)).toHaveLength(1);

    post.mockImplementation((url) => {
      if (url === PRECHECK_URL) return Promise.reject(new Error('network down'));
      if (url === UPLOAD_URL) return Promise.resolve({ status: 201, data: { document_id: 42 } });
      return Promise.resolve({ status: 200, data: {} });
    });
    await upload(user, file('second.pdf'));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2));
    expect(postsTo(UPLOAD_URL)).toHaveLength(2);
  });

  it('uploads without asking when the hash cannot be computed (no WebCrypto)', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    sha.mockResolvedValue(null);
    serve({
      [UPLOAD_URL]: { status: 201, data: { document_id: 41 } },
      '/api/accounting/documents/41/extract/': { status: 200, data: {} },
    });
    render(<Tier2UploadZone onUploaded={onUploaded} />);
    await upload(user, file());
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(postsTo(PRECHECK_URL)).toHaveLength(0);
    expect(postsTo(UPLOAD_URL)).toHaveLength(1);
  });

  it('takes files one at a time: the copy is stopped, the next file still goes through', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    sha.mockResolvedValueOnce(HASH).mockResolvedValueOnce('cd'.repeat(32));
    post.mockImplementation((url, body) => {
      if (url === PRECHECK_URL) {
        const { sha256 } = body as { sha256: string };
        return Promise.resolve(
          sha256 === HASH
            ? { status: 200, data: { exists: true, document_id: 41, name: 'Costco Wholesale', uploaded_at: '2026-05-05T10:00:01Z' } }
            : { status: 200, data: { exists: false } },
        );
      }
      if (url === UPLOAD_URL) return Promise.resolve({ status: 201, data: { document_id: 77 } });
      return Promise.resolve({ status: 200, data: {} });
    });
    render(<Tier2UploadZone onUploaded={onUploaded} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, [file('copy.pdf'), file('fresh.pdf')]);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Already uploaded as Costco Wholesale on 2026-05-05')).toBeInTheDocument();
    expect(postsTo(UPLOAD_URL)).toHaveLength(1);
    expect(postsTo(UPLOAD_URL)[0][1]).toMatchObject({ name: 'fresh.pdf' });
  });
});
