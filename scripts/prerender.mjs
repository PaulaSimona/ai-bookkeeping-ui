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
// template, if any render throws, or if a copy tripwire fires (see below).
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

const written = [];
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
  written.push([file, html]);
  console.log(`prerender: ${url} -> dist/prerender/${file}`);
}

// ── Copy tripwires (S61 Chain C, Commit 1) ──────────────────────────────────
// The retired positioning must never reappear in shipped markup. These run over
// the FINAL prerendered output — the exact bytes a JS-blind crawler reads — and
// FAIL the build (non-zero) on any hit, so a regression can never merge quietly.
//
// "advanced" is deliberately CONTEXT-SCOPED, not a bare substring: the word is a
// legitimate English adjective ("advanced AI"), and bare matching also trips on
// build artifacts like hashed asset filenames. It fails only when the word sits
// next to plan/tier/product vocabulary — i.e. used as a PRODUCT NAME, which is
// what O-S61-5 retired. Genuine lowercase adjective uses that still collide can
// be exempted by adding the offending line's distinctive substring to ALLOWLIST.
// ALLOWLIST starts empty on purpose: an entry is a deliberate, reviewable act.
const ALLOWLIST = [];

const TRIPWIRES = [
  { name: 'waitlist', re: /waitlist/gi },
  { name: 'coming soon', re: /coming\s+soon/gi },
  { name: 'in development', re: /in\s+development/gi },
  {
    name: 'advanced-as-product',
    re: /\badvanced\b[^<>]{0,40}?\b(plan|plans|tier|tiers|product|products|subscription|edition|package)\b|\b(plan|plans|tier|tiers|product|products|subscription|edition|package)\b[^<>]{0,40}?\badvanced\b/gi,
  },
];

let tripped = 0;
for (const [file, html] of written) {
  const lines = html.split('\n');
  for (const { name, re } of TRIPWIRES) {
    lines.forEach((line, i) => {
      re.lastIndex = 0;
      const hit = re.exec(line);
      if (!hit) return;
      if (ALLOWLIST.some((a) => line.includes(a))) return;
      tripped += 1;
      // Print the matched line, trimmed around the hit so the offender is legible.
      const from = Math.max(0, hit.index - 90);
      console.error(
        `prerender: TRIPWIRE "${name}" in dist/prerender/${file}:${i + 1}\n` +
          `  ...${line.slice(from, hit.index + hit[0].length + 90).trim()}...`,
      );
    });
  }
}

if (tripped > 0) {
  console.error(
    `prerender: ${tripped} copy tripwire hit(s) — retired positioning is present ` +
      `in the shipped markup. Build failed.`,
  );
  process.exit(1);
}
console.log(`prerender: copy tripwires clean across ${written.length} file(s)`);
