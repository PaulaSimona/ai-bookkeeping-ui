// fileSha256 (Release E2-1, O-S89-E6) — the SHA-256 of a file about to be
// uploaded, computed in the browser with WebCrypto: the same hex the server
// stores at intake (accounting/duplicate_service.py compute_file_sha256), so
// the pre-upload check can ask "is this file already in the books?" with a
// hash and never the bytes.
//
// Null where WebCrypto is not available (an http origin, an old browser):
// the caller skips the precheck and uploads; the server's own hard-duplicate
// check still applies. Never throws.

const readBytes = (file: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

export const fileSha256 = async (file: Blob): Promise<string | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') return null;
  try {
    // F-S89-3 (CI #70/#71): a typed-array VIEW, never the raw ArrayBuffer —
    // Node 20's subtle.digest refuses the buffer a jsdom FileReader hands
    // back (another realm), and browsers accept either.
    const digest = await subtle.digest('SHA-256', new Uint8Array(await readBytes(file)));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    // A silent skip would hide a broken precheck: say so — the error's name
    // and message only, never the file's name or bytes.
    const { name, message } = (error ?? {}) as { name?: unknown; message?: unknown };
    console.warn('fileSha256: precheck skipped', String(name ?? 'Error'), String(message ?? ''));
    return null;
  }
};
