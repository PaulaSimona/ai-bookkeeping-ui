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
    const digest = await subtle.digest('SHA-256', await readBytes(file));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
};
