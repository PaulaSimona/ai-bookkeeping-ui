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
import { render, renderClient } from '../dist/server/entry-server.js';


const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DIV = '<div id="root"></div>';
const ROBOTS = '<meta name="robots" content="index, follow" />';

// The footer link list is authored ONCE, in TypeScript, for the components to
// import. This script cannot import a .ts module, so it reads the same file as
// text and extracts the paths. Parsing to zero entries is itself a failure: it
// would silently disarm G6 rather than fail the build.
const LINKS_SRC = resolve(root, 'src/constants/footerLinks.ts');
const FOOTER_PATHS = [...readFileSync(LINKS_SRC, 'utf-8').matchAll(/path:\s*'([^']+)'/g)].map(
  (m) => m[1],
);
if (FOOTER_PATHS.length === 0) {
  console.error(`prerender: parsed 0 paths from ${LINKS_SRC} — G6 would be vacuous. Failed.`);
  process.exit(1);
}

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
  // Robots goes in HERE, not in index.html. index.html is also the shell for
  // every authenticated route; a global "index, follow" would invite /dashboard
  // and /settings into the index. Only these three prerendered public routes
  // get the directive. (Canonical is NOT a precedent to copy: it is injected by
  // Django at serve time in service/urls.py, which this fence cannot touch.)
  let html = template.replace(ROOT_DIV, `<div id="root">${rendered}</div>`);
  if (!/<meta[^>]*name="robots"/.test(html)) {
    html = html.replace('</head>', `  ${ROBOTS}\n  </head>`);
  }
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

// ── Structural guards (S78 H1, Commit 1) ───────────────────────────────────
// These assert on the PRERENDERED HTML STRING — the exact bytes a JS-blind
// crawler reads — not on a DOM after hydration. Anything only true after React
// runs is, for these purposes, not true. They encode no counts: G6 iterates
// FOOTER_PATHS, so adding a service page extends the guard automatically.
const countOf = (html, re) => (html.match(re) || []).length;

const GUARDS = {
  G1: {
    what: 'exactly one <main landmark',
    check: (html) => countOf(html, /<main[\s>]/g) === 1,
    detail: (html) => `found ${countOf(html, /<main[\s>]/g)}`,
  },
  G2: {
    what: '<html lang="en-CA"',
    check: (html) => /<html[^>]*\slang="en-CA"/.test(html),
    detail: (html) => `lang is ${(html.match(/<html[^>]*\slang="([^"]*)"/) || [, 'absent'])[1]}`,
  },
  G3: {
    what: '<meta name="robots" content="index, follow">',
    check: (html) => /<meta[^>]*name="robots"[^>]*content="index,\s*follow"/.test(html),
    detail: () => 'robots meta absent or not index, follow',
  },
  G4: {
    what: 'no name="keywords" meta',
    check: (html) => !/name="keywords"/.test(html),
    detail: () => 'a keywords meta is present',
  },
  G5: {
    what: 'no visually hidden <a>',
    check: (html) =>
      ![...html.matchAll(/<a\s[^>]*style="([^"]*)"/g)].some(([, st]) =>
        /clip:\s*rect\(0|width:\s*1px/.test(st),
      ),
    detail: (html) =>
      `${[...html.matchAll(/<a\s[^>]*style="([^"]*)"/g)].filter(([, st]) => /clip:\s*rect\(0|width:\s*1px/.test(st)).length} hidden anchor(s)`,
  },
  G6: {
    what: 'every footer service path present as a plain href',
    check: (html) => FOOTER_PATHS.every((p) => html.includes(`href="${p}"`)),
    detail: (html) =>
      `missing: ${FOOTER_PATHS.filter((p) => !html.includes(`href="${p}"`)).join(', ')}`,
  },
  G7: {
    what: 'SoftwareApplication ld+json exactly once',
    check: (html) => countOf(html, /"@type":\s*"SoftwareApplication"/g) === 1,
    detail: (html) => `found ${countOf(html, /"@type":\s*"SoftwareApplication"/g)}`,
  },
  G8: {
    what: 'no screenshot placeholder',
    check: (html) => !/screenshot\s*[—-]\s*extracted receipt record/i.test(html),
    detail: () => 'the dashed placeholder caption is still rendered',
  },
  // G9 (F-S78-8, O-S79-3). The other guards ask what the prerendered bytes SAY.
  // This one asks whether those bytes SURVIVE: React keeps prerendered markup
  // only if the client's first render produces exactly the same string. When it
  // does not, React logs #418, discards the whole #root and re-renders from
  // scratch (#423) - the prerender is then dead weight that only a JS-blind
  // crawler ever benefits from, which is precisely the state "/" shipped in
  // from S61 until this guard.
  //
  // Both sides are real: the left is read back out of the file just written,
  // the right is the actual client route table rendered by renderClient(). The
  // comparison is byte-for-byte, because that is React's own test.
  //
  // Node runs this with window / document / localStorage UNDEFINED, on purpose.
  // A component that reaches for a browser global during render cannot hydrate
  // a prerendered page anyway, so it SHOULD fail here rather than in a browser.
  G9: {
    what: 'client first render is byte-identical to the prerendered #root',
    check: (html, file) => {
      const pre = rootInnerHtml(html, file);
      return pre === renderClient(urlOf(file));
    },
    detail: (html, file) => {
      const pre = rootInnerHtml(html, file);
      const now = renderClient(urlOf(file));
      let i = 0;
      while (i < pre.length && i < now.length && pre[i] === now[i]) i += 1;
      return (
        `prerendered ${pre.length} B vs client first render ${now.length} B; ` +
        `first difference at offset ${i}\n` +
        `    prerendered: ...${pre.slice(i, i + 80).replace(/\n/g, ' ')}...\n` +
        `    client     : ...${now.slice(i, i + 80).replace(/\n/g, ' ')}...`
      );
    },
  },
};

// The #root inner HTML of a written file: everything between the opening
// <div id="root"> and the last </div> before </body>. Anchored on </body>
// rather than on the module script, because Vite hoists that script into
// <head> - i.e. it sits BEFORE #root, not after it.
// Failing to extract is an ERROR, not an empty string: an empty left-hand side
// would compare nothing against nothing and make G9 silently vacuous.
const rootInnerHtml = (html, file) => {
  const open = '<div id="root">';
  const start = html.indexOf(open);
  const bodyClose = html.lastIndexOf('</body>');
  const end = bodyClose === -1 ? -1 : html.lastIndexOf('</div>', bodyClose);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`prerender: cannot locate #root in dist/prerender/${file}`);
  }
  return html.slice(start + open.length, end);
};

// Recover a written file's url from ROUTES, so G9 encodes no route list of its
// own: adding a prerendered route extends the guard by itself.
const urlOf = (file) => {
  const hit = ROUTES.find(([, f]) => f === file);
  if (!hit) throw new Error(`prerender: no ROUTES entry for ${file}`);
  return hit[0];
};

// "/" carries the full set. /pricing and /faq are public prerendered routes that
// share the shell and the footer, so they carry the ones about the shell and the
// footer — not the ones about landing-page-only content. G9 is on ALL THREE: it
// is the only guard whose passing routes are also the evidence that it can fail
// for a real reason rather than by construction.
const GUARD_PLAN = {
  'index.html': ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'],
  'pricing.html': ['G1', 'G2', 'G3', 'G6', 'G9'],
  'faq.html': ['G1', 'G2', 'G3', 'G6', 'G9'],
};

let failed = 0;
for (const [file, html] of written) {
  for (const id of GUARD_PLAN[file] || []) {
    const g = GUARDS[id];
    if (g.check(html, file)) continue;
    failed += 1;
    console.error(`prerender: GUARD ${id} FAILED on dist/prerender/${file} — ${g.what}: ${g.detail(html, file)}`);
  }
}

if (failed > 0) {
  console.error(`prerender: ${failed} structural guard failure(s). Build failed.`);
  process.exit(1);
}
const planned = Object.values(GUARD_PLAN).reduce((n, ids) => n + ids.length, 0);
console.log(
  `prerender: ${planned} structural guard(s) green across ${written.length} file(s) ` +
    `(G6 over ${FOOTER_PATHS.length} service paths)`,
);
