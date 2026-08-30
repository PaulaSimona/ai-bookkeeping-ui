// Prerender pipeline (O-S61-1 / O-S61-2). After `vite build` (client) and
// `vite build --ssr` (server), this reads dist/index.html as the shell template,
// renders each public route to a static string via dist/server/entry-server.js,
// and writes dist/prerender/{index,pricing,faq}.html.
//
// The UI only EMITS these files. Relocating dist/prerender/ outside
// WHITENOISE_ROOT so Django serves them per route is Chain B's contract
// (O-S61-2) — not done here.
//
// Fails loudly (non-zero exit) if the root div is not found exactly once in the
// template, or if any render throws.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../dist/server/entry-server.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DIV = '<div id="root"></div>';

const template = readFileSync(resolve(root, 'dist/index.html'), 'utf-8');
const occurrences = template.split(ROOT_DIV).length - 1;
if (occurrences !== 1) {
  console.error(
    `prerender: expected exactly one "${ROOT_DIV}" in dist/index.html, found ${occurrences}`,
  );
  process.exit(1);
}

const ROUTES = [
  ['/', 'index.html'],
  ['/pricing', 'pricing.html'],
  ['/faq', 'faq.html'],
];

const outDir = resolve(root, 'dist/prerender');
mkdirSync(outDir, { recursive: true });

for (const [url, file] of ROUTES) {
  let rendered;
  try {
    rendered = render(url);
  } catch (err) {
    console.error(`prerender: render failed for ${url}:`, err);
    process.exit(1);
  }
  const html = template.replace(ROOT_DIV, `<div id="root">${rendered}</div>`);
  writeFileSync(resolve(outDir, file), html, 'utf-8');
  console.log(`prerender: ${url} -> dist/prerender/${file}`);
}
