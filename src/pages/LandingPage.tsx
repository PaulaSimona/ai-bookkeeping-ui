// Public homepage (S61 Chain A — final rebuild, O-S61-5 / O-S61-6).
//
// Copy contract (O-S61-5):
//   * Two products only — "Receipt Automation" (live today, $29/$49/$69 CAD)
//     and "Bookkeeping Service" (live, purchasable, $99/$199/$399 CAD
//     Starter/Growth/Pro, 15-day free trial). "Advanced" appears NOWHERE as a
//     tier/product name.
//   * No waitlist framing, no "in development / coming soon / at launch".
//   * Hero <h1> is the O-S61-6 owner headline token, verbatim.
//   * Claims limited to trace-proven truth (see the ruling): receipt/document
//     automation, bank + card connections, real double-entry books, financial
//     statements, human bookkeeper review of uncertain entries, CA + US small
//     businesses, no contracts / cancel anytime, 15-day trial no credit card.
//   * CTAs: free trial → /register, plan exploration → /pricing, blog → plain
//     <a href="/blog"> (Django-served), login → /login.
import { type FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logoSvg from '@/assets/logo.svg';
import dashboardPreview from '@/assets/advanced-preview.webp';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const NAVY = '#1A1F36';

// O-S61-6 owner headline token — used verbatim as the hero <h1> and the tab title.
const HEADLINE = 'You run the business. We keep the books.';
const PAGE_TITLE = `AI Bookkeeping — ${HEADLINE}`;

// ─── Content ──────────────────────────────────────────────────────────────────

// In-page anchors use hash scrolling; cross-route links are real hrefs. `external`
// = served outside the SPA (Django-rendered /blog), so a plain anchor + real
// navigation, never a react-router Link.
const NAV_LINKS: { label: string; to: string; hash?: boolean; external?: boolean }[] = [
  { label: 'Bookkeeping Service', to: 'bookkeeping', hash: true },
  { label: 'Receipt Automation', to: 'receipts', hash: true },
  { label: 'How it works', to: 'how', hash: true },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog', external: true },
  { label: 'FAQ', to: '/faq' },
];

const BOOKKEEPING_INCLUDES = [
  'Bank and card connections keep your books current all year.',
  'Real double-entry books — not a spreadsheet, not a folder of receipts.',
  'Financial statements you can hand your accountant at tax time.',
  'When AI is uncertain, a human reviewer checks the transaction before it reaches your books.',
];

const RECEIPTS_INCLUDES = [
  'Photograph a receipt once; it is read and categorized for you.',
  'Documents in, organized records out — no manual data entry.',
  'Available today on every Receipt Automation plan.',
];

const STEPS = [
  {
    n: '01',
    title: 'Connect and send',
    body: 'Connect your bank and cards, or snap a receipt. Documents flow in automatically.',
  },
  {
    n: '02',
    title: 'We keep the books',
    body: 'Entries are drafted, validated, and posted. Anything uncertain is reviewed by a human bookkeeper first.',
  },
  {
    n: '03',
    title: 'You get clean records',
    body: 'Double-entry books and financial statements stay current — ready for you or your accountant.',
  },
];

const RECEIPT_PLANS = [
  { name: 'Starter', price: '29', note: '100 receipts / month' },
  { name: 'Growth', price: '49', note: '300 receipts / month' },
  { name: 'Pro', price: '69', note: '500 receipts / month' },
];

const BOOKKEEPING_PLANS = [
  { name: 'Starter', price: '99', note: 'Full books, reviewed' },
  { name: 'Growth', price: '199', note: 'For growing volume' },
  { name: 'Pro', price: '399', note: 'For established books' },
];

// ─── Small building blocks ──────────────────────────────────────────────────

const Check: FC = () => (
  <svg
    className="mt-0.5 h-5 w-5 flex-none text-blue-600"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const LandingPage: FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // The static index.html title is the site-wide default; the homepage owns its own.
  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  // JSON-LD — inject-on-mount / remove-on-unmount. Offers list BOTH products'
  // published prices (O-S61-5). The Organization node lives statically in
  // index.html (exactly one site-wide), so it is not injected here.
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'AI Bookkeeping',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://www.ai-bookkeeping.ai/',
      description:
        'Bookkeeping done for you. Receipt Automation reads and categorizes your documents; the Bookkeeping Service maintains real double-entry books with bank and card connections, financial statements, and human bookkeeper review of every uncertain entry.',
      offers: [
        { '@type': 'Offer', name: 'Receipt Automation — Starter', price: '29', priceCurrency: 'CAD' },
        { '@type': 'Offer', name: 'Receipt Automation — Growth', price: '49', priceCurrency: 'CAD' },
        { '@type': 'Offer', name: 'Receipt Automation — Pro', price: '69', priceCurrency: 'CAD' },
        { '@type': 'Offer', name: 'Bookkeeping Service — Starter', price: '99', priceCurrency: 'CAD' },
        { '@type': 'Offer', name: 'Bookkeeping Service — Growth', price: '199', priceCurrency: 'CAD' },
        { '@type': 'Offer', name: 'Bookkeeping Service — Pro', price: '399', priceCurrency: 'CAD' },
      ],
    });
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const navLink = (l: (typeof NAV_LINKS)[number], cls: string) => {
    if (l.hash) {
      return (
        <button key={l.label} type="button" onClick={() => scrollTo(l.to)} className={cls}>
          {l.label}
        </button>
      );
    }
    if (l.external) {
      return (
        <a key={l.label} href={l.to} className={cls}>
          {l.label}
        </a>
      );
    }
    return (
      <Link key={l.label} to={l.to} className={cls} onClick={() => setMobileMenuOpen(false)}>
        {l.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-gray-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-[#F9FAFB]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoSvg} alt="AI Bookkeeping" className="h-8 w-auto" />
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((l) =>
              navLink(l, 'text-sm font-medium text-gray-600 transition hover:text-gray-900'),
            )}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Start free trial
            </Link>
          </div>
          <button
            type="button"
            className="md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-[#F9FAFB] px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((l) =>
                navLink(l, 'text-left text-sm font-medium text-gray-700'),
              )}
              <Link to="/login" className="text-left text-sm font-medium text-gray-700">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Start free trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-600">
          Bookkeeping done for you
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl" style={{ color: NAVY }}>
          {HEADLINE}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Two ways to stop doing data entry: automated receipt capture, or a full
          Bookkeeping Service that keeps real double-entry books for you — for
          small businesses in Canada and the United States.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700"
          >
            Start free trial
          </Link>
          <Link
            to="/pricing"
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-800 transition hover:border-gray-400"
          >
            See pricing →
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          15-day free trial — no credit card required. No contracts, cancel anytime.
        </p>
      </section>

      {/* ── Two products ── */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Bookkeeping Service */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
              Bookkeeping Service
            </h2>
            <p className="mt-2 text-gray-600">
              We keep your books organized throughout the year. Bank and card
              connections, real double-entry records, and financial statements,
              with a human bookkeeper reviewing every uncertain entry.
            </p>
            <p className="mt-4 text-lg font-semibold text-gray-900">
              $99 / $199 / $399 CAD per month
            </p>
            <p className="text-sm text-gray-500">Starter · Growth · Pro</p>
            <button
              type="button"
              onClick={() => scrollTo('bookkeeping')}
              className="mt-6 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Explore the Bookkeeping Service →
            </button>
          </div>
          {/* Receipt Automation */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
              Receipt Automation
            </h2>
            <p className="mt-2 text-gray-600">
              Photograph a receipt once and never type it again. Documents are
              read and categorized automatically — available today.
            </p>
            <p className="mt-4 text-lg font-semibold text-gray-900">
              $29 / $49 / $69 CAD per month
            </p>
            <p className="text-sm text-gray-500">Starter · Growth · Pro</p>
            <button
              type="button"
              onClick={() => scrollTo('receipts')}
              className="mt-6 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Explore Receipt Automation →
            </button>
          </div>
        </div>
      </section>

      {/* ── Bookkeeping Service ── */}
      <section id="bookkeeping" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Bookkeeping Service
            </p>
            <h2 className="mt-2 text-3xl font-bold" style={{ color: NAVY }}>
              Your books, kept current all year.
            </h2>
            <ul className="mt-6 space-y-3">
              {BOOKKEEPING_INCLUDES.map((item) => (
                <li key={item} className="flex gap-3 text-gray-700">
                  <Check />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="rounded-xl bg-blue-600 px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-blue-700"
              >
                Start your 15-day free trial
              </Link>
              <Link
                to="/pricing"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center text-base font-semibold text-gray-800 transition hover:border-gray-400"
              >
                See plans →
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            <img src={dashboardPreview} alt="The Bookkeeping Service dashboard" className="w-full" />
          </div>
        </div>
      </section>

      {/* ── Receipt Automation ── */}
      <section id="receipts" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Receipt Automation
          </p>
          <h2 className="mt-2 text-3xl font-bold" style={{ color: NAVY }}>
            Photograph it once. Never type it again.
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {RECEIPTS_INCLUDES.map((item) => (
              <li key={item} className="flex gap-3 rounded-xl border border-gray-100 bg-[#F9FAFB] p-4 text-gray-700">
                <Check />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-gray-600">
            Free trial — 5 documents included, no credit card required. Plans from
            $29 CAD/month.
          </p>
          <div className="mt-6">
            <Link
              to="/pricing"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View Receipt Automation plans →
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold" style={{ color: NAVY }}>
          You are not expected to do the bookkeeping.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-bold text-blue-600">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold" style={{ color: NAVY }}>
                {s.title}
              </h3>
              <p className="mt-2 text-gray-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold" style={{ color: NAVY }}>
            Software prices. Bookkeeper outcomes.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
            Simple monthly pricing in CAD. No contracts, cancel anytime.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold" style={{ color: NAVY }}>
                Bookkeeping Service
              </h3>
              <ul className="mt-4 space-y-2">
                {BOOKKEEPING_PLANS.map((p) => (
                  <li key={p.name} className="flex items-baseline justify-between border-b border-gray-100 pb-2">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-gray-900">
                      <span className="text-lg font-bold">${p.price}</span>
                      <span className="text-sm text-gray-500"> CAD/mo · {p.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-gray-500">15-day free trial — no credit card required.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold" style={{ color: NAVY }}>
                Receipt Automation
              </h3>
              <ul className="mt-4 space-y-2">
                {RECEIPT_PLANS.map((p) => (
                  <li key={p.name} className="flex items-baseline justify-between border-b border-gray-100 pb-2">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-gray-900">
                      <span className="text-lg font-bold">${p.price}</span>
                      <span className="text-sm text-gray-500"> CAD/mo · {p.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-gray-500">Free trial — 5 documents, no credit card required.</p>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700"
            >
              Start free trial
            </Link>
            <Link
              to="/pricing"
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-800 transition hover:border-gray-400"
            >
              Compare plans →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ teaser ── */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
          Questions owners ask before signing up.
        </h2>
        <p className="mt-3 text-gray-600">
          Plain answers on how it works, what's included, security, and getting started.
        </p>
        <Link
          to="/faq"
          className="mt-6 inline-block rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-800 transition hover:border-gray-400"
        >
          Read the FAQ →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="text-white" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <img src={logoSvg} alt="AI Bookkeeping" className="h-8 w-auto brightness-0 invert" />
            <p className="mt-4 text-sm text-white/70">
              Bookkeeping done for you, by Time2Win Inc. — a Canadian corporation
              serving small businesses in Canada and the United States.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Product</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/pricing" className="text-white/70 transition hover:text-white">Pricing</Link></li>
              <li><button type="button" onClick={() => scrollTo('bookkeeping')} className="text-white/70 transition hover:text-white">Bookkeeping Service</button></li>
              <li><button type="button" onClick={() => scrollTo('receipts')} className="text-white/70 transition hover:text-white">Receipt Automation</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Learn</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="/blog" className="text-white/70 transition hover:text-white">Blog</a></li>
              <li><Link to="/faq" className="text-white/70 transition hover:text-white">FAQ</Link></li>
              <li><button type="button" onClick={() => scrollTo('how')} className="text-white/70 transition hover:text-white">How it works</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="mailto:support@ai-bookkeeping.ai" className="text-white/70 transition hover:text-white">Contact</a></li>
              <li><Link to="/privacy-policy" className="text-white/70 transition hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="text-white/70 transition hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-6 text-center text-sm text-white/60">
          © 2026 Time2Win Inc.
        </div>
      </footer>
    </div>
  );
};
