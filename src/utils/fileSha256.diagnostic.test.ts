// DIAGNOSTIC (to be replaced) — S89 PROMPT 10, CI #70 on Release E2.
//
// fileSha256 returned null in CI (Node 20) although the test stubs Node's
// WebCrypto; locally (Node 24) it passes. The helper's catch swallows the
// reason, so its steps are repeated here inline (D1, D3, D4; jsdom's Blob has
// no arrayBuffer(), so that road is not exercised here), each in its
// own test and with NO try/catch: whichever throws under Node 20 prints its
// real error in the CI log. Not a merge candidate — replaced by the fix once
// the cause is known. The product file and its test are untouched.
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BYTES = new TextEncoder().encode('hello');

const sample = () => new File([BYTES], 'hello.txt', { type: 'text/plain' });

const readWithFileReader = (file: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

const describeBuffer = (value: unknown): string =>
  `${Object.prototype.toString.call(value)} instanceof ArrayBuffer=${value instanceof ArrayBuffer} ` +
  `byteLength=${(value as ArrayBuffer)?.byteLength}`;

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fileSha256 diagnostic (CI #70)', () => {
  it('D1 FileReader.readAsArrayBuffer gives a 5-byte ArrayBuffer', async () => {
    const result = await readWithFileReader(sample());
    expect(
      result.byteLength,
      `node=${process.version} jsdom FileReader result: ${describeBuffer(result)}`,
    ).toBe(5);
  });


  it('D3 webcrypto.subtle.digest accepts the FileReader buffer', async () => {
    const buffer = await readWithFileReader(sample());
    const digest = await webcrypto.subtle.digest('SHA-256', buffer);
    expect(digest.byteLength, `digest of ${describeBuffer(buffer)}`).toBe(32);
  });

  it('D4 webcrypto.subtle.digest accepts a Uint8Array view of the FileReader buffer', async () => {
    const buffer = await readWithFileReader(sample());
    const digest = await webcrypto.subtle.digest('SHA-256', new Uint8Array(buffer));
    expect(digest.byteLength, `digest of a view over ${describeBuffer(buffer)}`).toBe(32);
  });

});
