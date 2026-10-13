// fileSha256 (Release E2-1, O-S89-E6): the hash of a file about to be
// uploaded, computed in the browser with WebCrypto — the same SHA-256 hex the
// server stores at intake — or null where WebCrypto is not available, in
// which case the precheck is skipped and the server's own check still applies.
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileSha256 } from './fileSha256';

const HELLO = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fileSha256', () => {
  it("computes the file's SHA-256 as lower-case hex with WebCrypto", async () => {
    vi.stubGlobal('crypto', webcrypto);
    const file = new File([new TextEncoder().encode('hello')], 'hello.txt', { type: 'text/plain' });
    expect(await fileSha256(file)).toBe(HELLO);
    // Bytes, not the name: the same bytes under another name hash the same.
    const again = new File([new TextEncoder().encode('hello')], 'other.pdf', { type: 'application/pdf' });
    expect(await fileSha256(again)).toBe(HELLO);
  });

  it('answers null where WebCrypto is not available, and never throws', async () => {
    vi.stubGlobal('crypto', {});
    const file = new File([new TextEncoder().encode('hello')], 'hello.txt');
    expect(await fileSha256(file)).toBeNull();
    vi.stubGlobal('crypto', undefined);
    expect(await fileSha256(file)).toBeNull();
  });
});
