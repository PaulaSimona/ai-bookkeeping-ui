# CLAUDE.md — AI Bookkeeping UI (Time2Win Inc.)

Project context for Claude Code. This is the **frontend** repo (`ai-bookkeeping-ui`). The Django backend lives in a separate repo (`ai-bookkeeping`), which is where Railway builds from and where the authoritative Tier 2 specs live.

This is the UI for a production fintech SaaS with live users and real Stripe payments. Tier 1 is shipped and locked.

---

## ⛔ Non-Negotiable Guardrails

1. **Confirm the repo BEFORE editing (recon first).** Before changing anything, confirm you are in `ai-bookkeeping-ui`: run `git remote -v` (must be `PaulaSimona/ai-bookkeeping-ui`), check the branch, and check the working tree is clean. The shell has reset its cwd to the **backend** repo dir mid-session before — re-confirm cwd before any `git` operation or file edit. When the root cause of a problem is unclear, trace and report before making changes.
2. **NEVER modify existing Tier 1 functionality.** Tier 1 is tagged `v1.0-tier1`; "locked" attaches to the tag and the Tier 1 code paths, not to `main` as a whole. Tier 2 lives on `main`, which already contains the Tier 2 UI alongside locked Tier 1. The old `tier2-accounting-core` branch is **DELETED — do not recreate or reference it.** New Tier 2 frontend work goes on a **short-lived feature branch cut from current `main`**, merged back only when deploy-ready and the build passes. **Never commit unfinished work straight to `main`** (it auto-deploys to prod). If a change would touch a Tier 1 view or flow, stop and ask.
3. **This repo is PUBLIC on GitHub.** Never commit secrets, tokens, or anything sensitive. Only `VITE_`-prefixed env vars are bundled, and they must be non-secret (publishable Stripe key, API domain, price IDs) — never a secret key.
4. **Don't break the build.** A TypeScript error here fails the entire Railway deploy (the backend Docker build clones and compiles this repo). Verify imports and types before pushing.

---

## Deploy Model (important)

This repo is **not** watched by Railway directly. The backend's Dockerfile clones it during build. To ship a frontend change:

1. Push to this repo (`ai-bookkeeping-ui`, branch `main`).
2. Push a trivial commit to the backend repo (`ai-bookkeeping`) to trigger a Railway build.
3. Increment `CACHE_BUST` in Railway Variables — this forces a fresh clone of this repo during the Docker build (otherwise Docker caches the old frontend).

Skipping step 3 means your change won't appear in production.

**CACHE_BUST discipline:** always **read the live value in Railway Variables and increment that** — do NOT trust the number written in any marketing/planning `.md` doc; those drift out of sync (conflicting values have shown up). After deploy, **hard-refresh (Cmd+Shift+R) and smoke-test the live homepage** before relying on the change — and before clicking any external "Verify" button on a directory/badge site.

**End-of-task deliverables:** at the end of a build task, provide (1) a ready-to-use commit message and (2) a post-deploy verification checklist (push → backend trigger → CACHE_BUST bump → wait for green → live smoke test).

---

## Stack

- **React 18.3.1**, **Vite 6.3.5**, **TypeScript 5.8.3**, Node 20 (build)
- **State: Redux Toolkit 2.7 + react-redux 9.2.** Store slices: `auth`, `layout`, `profile`, `package`, `payments`, `billing`. **No TanStack Query currently** — fetching is done in components/hooks via axios. (For Tier 2 ledger reads, TanStack Query may be introduced; if so, additive only — do not migrate existing Redux slices.)
- **Routing:** `react-router-dom 6.30`. Routes defined in `App.tsx`.
- **Styling: Tailwind CSS v4** (`@tailwindcss/vite`), utility classes only. **No component library** (no shadcn, Radix, or Headless UI). A few legacy `.scss` files exist (`Login.scss`, `Register.scss`); prefer Tailwind for new work.
- **HTTP:** `axios 1.9`, wrapped in `src/utils/api.tsx`. Interceptors inject the JWT Bearer token, do a silent refresh via `/api/auth/refresh/` on 401, and redirect to `/login` on `token_not_valid`. **Always use this wrapped client for API calls — don't call axios or fetch directly.**
- **Payments:** `@stripe/react-stripe-js` + `@stripe/stripe-js`.
- **Error tracking:** `@sentry/react` (gated on `VITE_SENTRY_DSN`).
- Other: `localforage` (local storage abstraction), `typescript-cookie`.

---

## `src/` Layout

```
src/
  api/          # Per-feature hooks (useRegister, useDocuments, useProfile, ...)
  assets/       # Static assets (logo.svg, etc.)
  components/   # Shared UI: Badge, Button, Card, DragAndDrop, Form, Icons,
                #   Layout, Loader, Modal, Redirect, Toast
  hooks/        # Custom React hooks
  pages/        # Top-level page components (LandingPage.tsx)
  store/        # Redux store + feature slices (authSlice, layoutSlice, ...)
  styles/       # Global styles
  types/        # Shared TypeScript types
  utils/        # api.tsx, auth.tsx, store.tsx, validators, upload helpers, constants
  views/        # Route-level views: auth/, billing/, dashboard/, documents/,
                #   reports/, settings/, subscription/, ...
  App.tsx       # Router + route definitions
  main.tsx      # Entry point
```

**Conventions:**
- Reuse existing `components/` primitives (Button, Card, Modal, Form, Toast) rather than building new ones.
- Keep API calls in `api/` hooks or `utils/api.tsx`, not inline in views.
- Shared types go in `types/`; don't redefine the same shape in multiple files.
- Match the existing Tailwind styling patterns in neighboring views for visual consistency.

---

## Icons note (learned the hard way)

A bad `lucide-react` import once failed the whole build (`TS2307: Cannot find module`). When adding an icon, verify it actually exists in the installed `lucide-react` version, or use an inline SVG. Check the existing `components/Icons` first.

---

## Marketing / SEO

Most marketing, SEO, blog, and directory/badge work happens in **this** repo (the public-facing site).

- **"Featured On" badge strip** — lives in `pages/LandingPage.tsx`, between the "What Our Users Say" testimonial section and the footer. It's a centered `flex-wrap` row (`gap-6`) so new badges drop in with **no restructuring**. Badges are normalized to a matched height (`h-11 w-auto`) so they sit as a tidy set. Live badges: **BetaList, LaunchBuff**. Add new ones (tools.cafe, PeerPush, Capterra, G2, …) as additional `<a><img></a>` entries in this row. **Footer stays copyright + nav links only — no badges in the footer.**
- **Blog** content is markdown registered in a content index, with new slugs also added to `sitemap.xml`. Confirm the exact in-repo paths (`src/content/blog/` and its index) before editing rather than assuming.
- For any badge that requires the directory to **verify** it on your site, see the SPA-crawler trap below — the rendered strip alone will NOT pass a JS-blind verifier.

### Badge / directory verification — the SPA-crawler trap (learned the hard way)

This is a Vite + React SPA: the production `index.html` ships an almost-empty `<body>` with just `<div id="root"></div>`. **Everything visible — including any badge rendered in `LandingPage.tsx` — is injected by JavaScript after load.**

Many directory/badge verifiers (**LaunchBuff confirmed**; expect the same from Capterra, G2, and similar) fetch the **raw HTML and do NOT run JavaScript**. They see the empty root, not the rendered badge, and report "badge not found" even though the badge is clearly visible in a browser.

**FIX:** add the required badge as a **static, visually-hidden `<a><img></a>` directly in `index.html`**, immediately after `<div id="root"></div>`. Vite copies `index.html` through to `dist/` and preserves static markup, so it survives the build and lives in the raw server HTML the crawler reads. Hide it with the 1px/`clip:rect(0 0 0 0)` technique so users never see it — the visible badge stays the rendered one in `LandingPage.tsx`.

**Confirm after deploy** before clicking the verifier's "Verify" button:
```
curl -s https://ai-bookkeeping.ai/ | grep <badgename>
```
(or View Source + Cmd+F) — the link must appear in the **raw** HTML.

---

## Tier 2 (Advanced) — Frontend Notes

Tier 2 adds the accounting product (ledger, journal entries, chart of accounts, review queue).

**Branch model (per backend Addendum 02 — this corrects older instructions in earlier versions of this file):** Tier 2 lives on `main`, which already contains the Tier 2 UI alongside locked Tier 1. The `tier2-accounting-core` branch is **deleted — do not recreate or reference it.** New Tier 2 frontend work goes on a short-lived feature branch off current `main`, merged when deploy-ready.

**Authoritative backend specs:** `MASTER_T2.md` (supersedes the old `TIER_2_BRIEFING.md`); and `ADDENDUM_02_BRANCH_MODEL_AND_REVIEWER_SPLIT.md` for the branch model and reviewer architecture. When in doubt about Tier 2 behavior, those win over this file.

Key UI implications:

- **Product model: Tier 1 upgrades IN PLACE to Tier 2.** One product, two tiers, one account/login. The **design system and auth/account are shared**; separation is by tier (functionality, dashboards, reviewers). Don't build a separate Tier 2 app shell — extend within the shared shell, gated by tier.
- **Roles** — clients are `owner` and `accountant`. The old `bookkeeper` role was **renamed to `accountant`** (don't reference `bookkeeper` anywhere). `reviewer` and `super-user` are **internal staff**, not client roles. Gate UI by role, but the backend enforces permissions too (UI gating is UX, not security).
- **Reviewer split (Addendum 02 — corrects the old "extend `/reviewer`" note):** do **NOT** reuse the Tier 1 `/reviewer` for the Tier 2 queue. The `/reviewer` dashboard that exists today is actually the **Tier-2-shaped reviewer, currently misplaced in front of Tier 1**. Target architecture: wire that existing reviewer to the **Tier 2** dashboard (the `MASTER_T2.md` §15 internal console), and **build a separate, dedicated Tier 1 reviewer** for Tier-1-native fields. Each reviewer serves its own tier; shared design system only. (The dedicated Tier 1 reviewer is still the outstanding piece — verify current state before relying on either.)
- **Ledger/balance views are read-heavy** — good candidates for TanStack Query caching if introduced (additive only; don't migrate existing Redux slices).
- **Money display** — always format from the backend's `Decimal` values; never do money math in JS floats. Display only.

When given a Tier 2 task, prefix mentally with: *short-lived feature branch off current `main` (NOT `tier2-accounting-core` — it's deleted); don't commit unfinished work to `main` (it auto-deploys); don't touch Tier 1; reuse existing components; use the wrapped api client; don't break the build.*

---

*Frontend context file. The authoritative Tier 2 specs live in the backend repo (`MASTER_T2.md` + addenda). Tier 1 remains locked at `v1.0-tier1`.*
