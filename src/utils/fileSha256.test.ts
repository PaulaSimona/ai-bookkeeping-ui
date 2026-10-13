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
  it("computes the file's SHA-256 as lower-case hex with WebCrypto, handing digest a Uint8Array view", async () => {
    vi.stubGlobal('crypto', webcrypto);
    // F-S89-3 (CI #70/#71): Node 20's subtle.digest refuses the ArrayBuffer a
    // jsdom FileReader hands back; a typed-array view is accepted everywhere.
    // Spied so a regression to the raw buffer turns red on every Node.
    const digest = vi.spyOn(webcrypto.subtle, 'digest');
    const file = new File([new TextEncoder().encode('hello')], 'hello.txt', { type: 'text/plain' });
    expect(await fileSha256(file)).toBe(HELLO);
    expect(digest).toHaveBeenCalledTimes(1);
    const [algorithm, data] = digest.mock.calls[0];
    expect(algorithm).toBe('SHA-256');
    expect(ArrayBuffer.isView(data)).toBe(true);
    expect((data as Uint8Array).byteLength).toBe(5);
    // Bytes, not the name: the same bytes under another name hash the same.
    const again = new File([new TextEncoder().encode('hello')], 'other.pdf', { type: 'application/pdf' });
    expect(await fileSha256(again)).toBe(HELLO);
    digest.mockRestore();
  });

  it('answers null and warns once — never the file — when digest throws', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const digest = vi.spyOn(webcrypto.subtle, 'digest').mockRejectedValue(new TypeError('refused by the test'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = new File([new TextEncoder().encode('hello')], 'secret-invoice.pdf');
    expect(await fileSha256(file)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('fileSha256: precheck skipped', 'TypeError', 'refused by the test');
    // Neither the file's name nor its bytes reach the console.
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-invoice');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('hello');
    digest.mockRestore();
    warn.mockRestore();
  });

  it('answers null where WebCrypto is not available, and never throws', async () => {
    vi.stubGlobal('crypto', {});
    const file = new File([new TextEncoder().encode('hello')], 'hello.txt');
    expect(await fileSha256(file)).toBeNull();
    vi.stubGlobal('crypto', undefined);
    expect(await fileSha256(file)).toBeNull();
  });
});
