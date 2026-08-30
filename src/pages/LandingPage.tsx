// Public homepage — S61 Chain C, prototype-fidelity rebuild (O-S61-16).
//
// Supersedes the Chain A page. Section sequence, layout, spacing rhythm, type
// hierarchy, and color treatment follow the owner's prototype; the COPY is
// governed separately and was ratified across two copy gates in S61 Prompt 9.
//
// Copy contract (unchanged from O-S61-5, plus the Prompt-9 rulings):
//   * Two products only — "Receipt Automation" ($29/$49/$69 CAD) and the
//     "Bookkeeping Service" ($99/$199/$399 CAD). "Advanced" is NOT a product,
//     plan, or tier name anywhere. scripts/prerender.mjs fails the build if the
//     retired positioning ("waitlist" / "coming soon" / "in development" /
//     "Advanced" as a product name) reappears in the shipped markup.
//   * Hero <h1> is the O-S61-6 owner headline token, verbatim.
//   * Bookkeeping Service document counts are UNIT-FREE ("150 docs") — the
//     backend mechanism (TIER2_PLAN_MAPPING + resolve_org_daily_limit) is a
//     DAILY agent cap, so "per month" would be false. Receipt Automation counts
//     DO carry "per month" — that quota is genuinely monthly (billing/plans.py).
//   * Security section states only repo-verifiable controls. The PIPEDA/Stripe
//     footnote is two sentences by ruling; no certification or badge claims.
//   * Hero visual is an illustrative mockup captioned "Illustrative —
//     demonstration data" (OD-S61-1), wired through the Lightbox (O-S61-18).
import { type FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logoSvg from '@/assets/logo.svg';
import dashboardPreview from '@/assets/dashboard-illustrative.webp';
import { LightboxImage } from '@/components/Lightbox';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const NAVY = '#1A1F36';
const INK = '#111827';
const BLUE = '#0066FF';

// O-S61-6 owner headline token — used verbatim as the hero <h1> and tab title.
const HEADLINE = 'You run the business. We keep the books.';
const PAGE_TITLE = `AI Bookkeeping — ${HEADLINE}`;

// Prototype rhythm: 1200px column, 88px vertical step, 32px gutter. Mobile
// steps down to a 20px gutter and a ~56px vertical step.
const SHELL = 'mx-auto w-full max-w-[1200px] px-5 sm:px-8';
const STEP = 'pt-14 sm:pt-[88px]';

// ─── Content ──────────────────────────────────────────────────────────────────

// In-page anchors use hash scrolling; cross-route links are real hrefs.
// `external` = served outside the SPA (Django-rendered /blog), so a plain
// anchor and a real navigation, never a react-router Link.
const NAV_LINKS: { label: string; to: string; hash?: boolean; external?: boolean }[] = [
  { label: 'Bookkeeping Service', to: 'bookkeeping', hash: true },
  { label: 'Receipt Automation', to: 'receipts', hash: true },
  { label: 'How it works', to: 'how', hash: true },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog', external: true },
  { label: 'FAQ', to: '/faq' },
];

const T1_POINTS = [
  'Upload from the web app or send to the Telegram bot',
  'AI extracts vendor, date, totals, taxes, and line items',
  'Automatic business expense categorization and GST/HST tracking',
  'Reports and a full-year Excel workbook for your accountant',
];

const T2_POINTS = [
  'Everything in Receipt Automation, plus complete books',
  'Bank, card, and Stripe connections, with reconciliation',
  'Human reviewer resolves anything the AI cannot settle',
  'Profit & Loss, Balance Sheet, tax and cash-flow views',
  'Invite your accountant, or hand them the reports',
];

const T1_FEATURES = [
  {
    title: 'Any photo quality',
    body: 'Crumpled, dim, angled — the AI reads it. JPEG, PNG, WebP, HEIC, and PDF.',
  },
  {
    title: 'Vendor names cleaned',
    body: '"COSTCO WHSE #556" becomes Costco Wholesale, consistently across reports.',
  },
  {
    title: 'Tax amounts separated',
    body: "Recoverable GST/HST is split out on each receipt, so credits aren't missed.",
  },
  {
    title: 'CRA-aligned categories',
    body: 'Expenses land in categories that map to CRA expense reporting.',
  },
  {
    title: 'Reports and Excel',
    body: 'Expense-by-category and GST/HST summaries, plus an annual .xlsx workbook.',
  },
  {
    title: 'Full manual control',
    body: 'Edit any extracted record in the edit drawer or workbook view. Nothing is a black box.',
  },
];

const WORKFLOW = [
  {
    n: '01',
    who: 'You',
    bg: 'rgba(255,255,255,0.1)',
    fg: '#E5E7EB',
    title: 'Upload and connect',
    body: 'Send receipts, supplier invoices, and client invoices from the web app or the Telegram bot — and connect your bank, cards, and Stripe so transactions arrive on their own.',
  },
  {
    n: '02',
    who: 'AI',
    bg: 'rgba(251,191,36,0.14)',
    fg: '#FCD34D',
    title: 'AI bookkeeping',
    body: 'The AI extracts the information, determines the accounting treatment, and prepares the bookkeeping records.',
  },
  {
    n: '03',
    who: 'Platform',
    bg: 'rgba(0,102,255,0.18)',
    fg: '#93C5FD',
    title: 'Accounting rules',
    body: 'Deterministic controls validate the proposed treatment. Debits must equal credits, accounts must be real. Anything that fails does not post.',
  },
  {
    n: '04',
    who: 'Our staff',
    bg: 'rgba(16,185,129,0.16)',
    fg: '#6EE7B7',
    title: 'Human review when needed',
    body: 'Transactions the system cannot confidently resolve are checked against the source document and corrected by a human bookkeeping reviewer.',
  },
  {
    n: '05',
    who: 'Platform',
    bg: 'rgba(0,102,255,0.18)',
    fg: '#93C5FD',
    title: 'Books stay current',
    body: 'Records, reports, tax information, receivables, and payables stay organized throughout the year — not rebuilt in March.',
  },
  {
    n: '06',
    who: 'You + accountant',
    bg: 'rgba(255,255,255,0.1)',
    fg: '#E5E7EB',
    title: 'Accountant ready',
    body: 'Invite your accountant to their own workspace, or download the completed reports and hand them over at tax time.',
  },
];

const PATH_CLEAN = [
  { label: 'Document arrives', sub: 'Receipt, invoice, or connected transaction' },
  { label: 'AI prepares the entry', sub: 'Extraction, treatment, and a confidence assessment' },
  { label: 'Accounting rules validate', sub: 'Deterministic checks, not a model' },
  { label: 'Posted to your books', sub: 'Balanced, with the source document attached' },
];

const PATH_REVIEW = [
  { label: 'Document arrives', sub: 'Or a large-value transaction of any confidence', accent: false },
  { label: 'AI prepares the entry', sub: 'The AI is built to escalate rather than guess', accent: false },
  {
    label: 'Accounting rules flag it',
    sub: 'Uncertain, ambiguous, or rule-flagged — it does not post',
    accent: false,
  },
  {
    label: 'Human reviewer takes it',
    sub: 'Trained platform staff open the source document and decide',
    accent: true,
  },
  {
    label: 'Corrected entry posts',
    sub: 'Through the same accounting engine — nobody bypasses the rules',
    accent: false,
    final: true,
  },
];

const VISIBILITY = [
  { title: 'Cash', body: 'What you actually have across your connected business accounts.' },
  { title: 'Revenue', body: 'What the business has earned, period over period.' },
  { title: 'Expenses', body: 'Where the money went, grouped the way your accountant expects.' },
  { title: 'Profit', body: 'Profit to date and by fiscal quarter, from real books.' },
  {
    title: 'Money customers owe you',
    body: 'Client balances and aging, with statements of account.',
  },
  { title: 'Money you owe', body: 'Supplier balances and aging, so nothing is a surprise.' },
  {
    title: 'Taxes',
    body: 'Tax collected against credits for the current filing period, with CRA GST/HST deadlines tracked.',
  },
  {
    title: 'Reports',
    body: 'Profit & Loss and Balance Sheet as of any date, downloadable and printable.',
  },
];

const SECURITY = [
  {
    title: 'Encrypted at rest',
    body: 'Financial documents live in private storage reached only through expiring signed links, and sensitive credentials such as bank connection tokens are encrypted at rest. No public file URLs.',
  },
  {
    title: 'Your business is walled off',
    body: "Every business's data is isolated from every other, and the permission rules are covered by deny-path tests.",
  },
  {
    title: 'Human review of uncertainty',
    body: 'No AI-proposed entry reaches your books without passing deterministic accounting rules first. Entries the system cannot confidently resolve are decided by trained staff, not posted on a guess.',
  },
  {
    title: 'Nothing is quietly rewritten',
    body: 'An issued invoice is immutable. Corrections and voids post as new, linked entries with who and when recorded, so the trail of what changed is always readable.',
  },
];

// Bookkeeping Service counts are unit-free by ruling — see the copy contract.
const T2_PLANS = [
  {
    name: 'Starter',
    price: '$99',
    docs: '150 docs',
    note: 'Full books, reviewed',
    tag: '',
    dark: false,
  },
  {
    name: 'Growth',
    price: '$199',
    docs: '250 docs',
    note: 'For growing volume',
    tag: 'Most chosen',
    dark: true,
  },
  {
    name: 'Pro',
    price: '$399',
    docs: '500 docs',
    note: 'For established books',
    tag: '',
    dark: false,
  },
];

// Receipt Automation counts ARE monthly and verified against billing/plans.py.
const T1_PLANS = [
  { name: 'Starter', price: '$29', docs: '100 documents per month', storage: '1 GB storage' },
  { name: 'Growth', price: '$49', docs: '300 documents per month', storage: '5 GB storage' },
  { name: 'Pro', price: '$69', docs: '500 documents per month', storage: '20 GB storage' },
];

const COMPARISON: { label: string; a: string; b: string; aMuted?: boolean }[] = [
  { label: 'AI document processing', a: 'Included', b: 'Included' },
  { label: 'Automatic categorization', a: 'Expense categories', b: 'Full accounting treatment' },
  {
    label: 'GST/HST tracking',
    a: 'Input tax credits on receipts',
    b: 'Tax collected, credits, and filing periods',
  },
  { label: 'Full double-entry books', a: 'Not included', b: 'Included', aMuted: true },
  {
    label: 'Human review of uncertain entries',
    a: 'Not included',
    b: 'Trained reviewers on our staff',
    aMuted: true,
  },
  {
    label: 'Bank and credit-card connections',
    a: 'Not included',
    b: 'Included, via Plaid',
    aMuted: true,
  },
  {
    label: 'Stripe connection',
    a: 'Not included',
    b: 'Revenue and processing fees posted automatically',
    aMuted: true,
  },
  { label: 'Reconciliation', a: 'Not included', b: 'Handled for you', aMuted: true },
  {
    label: 'Financial statements',
    a: 'Expense and tax reports',
    b: 'Profit & Loss and Balance Sheet',
  },
  {
    label: 'Receivables and payables',
    a: 'Not included',
    b: 'Client and supplier balances with aging',
    aMuted: true,
  },
  {
    label: 'Financial visibility dashboard',
    a: 'Expense summaries',
    b: 'Cash, profit, taxes, and cash flow',
  },
  {
    label: 'Accountant access',
    a: 'Share exported files',
    b: 'Their own workspace, by invitation',
  },
  {
    label: 'Tax-time reporting',
    a: 'Annual Excel workbook',
    b: 'Full report package, plus workspace access',
  },
  { label: 'Excel export', a: 'Included', b: 'Included' },
  { label: 'Free trial', a: '5 documents, no credit card', b: '15 days, no credit card' },
  { label: 'Monthly price', a: '$29 – $69 CAD/USD', b: '$99 – $399 CAD/USD' },
];

const AUDIENCES = [
  {
    title: 'Contractors and trades',
    body: 'Receipts from the lumber yard, the gas station, and the supply house — handled without an evening of typing.',
  },
  {
    title: 'Small businesses',
    body: 'Real books maintained during the year instead of reconstructed under deadline.',
  },
  {
    title: 'Startups',
    body: 'A clean, auditable history from day one, for the diligence conversation later.',
  },
  {
    title: 'Owner-operated companies',
    body: 'Incorporated, mixing personal and business cards, and short on time for any of it.',
  },
  {
    title: 'Already have an accountant',
    body: 'Keep them. We keep the books current so their work starts from finished records.',
  },
];

const FAQS: [string, string][] = [
  [
    'What is the difference between Receipt Automation and the Bookkeeping Service?',
    'Receipt Automation processes your documents: it extracts, categorizes, and organizes receipts and supplier invoices, then gives you expense records, tax summaries, and Excel exports. The Bookkeeping Service goes further and maintains your books — double-entry records, reconciliation, financial statements, tax information, receivables and payables — with human review of anything the AI cannot resolve confidently.',
  ],
  [
    'Do I need to know bookkeeping?',
    'No. The Bookkeeping Service is designed so you never choose accounts, write journal entries, or reconcile anything. You send documents and read the results in plain business language.',
  ],
  [
    "What happens if the AI isn't sure?",
    'The entry does not post. It goes to a review queue where a human bookkeeping reviewer on our staff opens the source document, decides the correct treatment, and posts it through the same accounting engine. Large-value entries are routed to review regardless of confidence.',
  ],
  [
    'Is a human involved?',
    'Yes, on the Bookkeeping Service. Trained reviewers on our staff work the review queue. You never see that queue, and you are never asked to resolve an entry yourself.',
  ],
  [
    'Can I keep my existing accountant?',
    'Yes, and you should. The platform keeps your books organized during the year; your accountant does the accountant work. It does not replace them.',
  ],
  [
    'Do I need to connect my bank?',
    'Bank and credit-card connections are part of the Bookkeeping Service and run through Plaid, so we never see your banking credentials. You can also connect Stripe, and your revenue and processing fees are posted into your books automatically.',
  ],
  [
    'Does the platform prepare my tax return?',
    'No. AI Bookkeeping prepares bookkeeping records and the reports behind them. It does not file returns and does not provide tax, legal, or financial advice.',
  ],
  [
    'Is a credit card required for the trial?',
    "No. The Bookkeeping Service trial runs 15 days with no credit card. Receipt Automation's free trial covers 5 documents, also with no credit card.",
  ],
  [
    'Do I have to categorize my own expenses?',
    'No. The AI determines the accounting treatment and our accounting rules validate it. On Receipt Automation you can edit any extracted record if you want to, but nothing requires it.',
  ],
  [
    'Can I invite my accountant?',
    'Yes. On the Bookkeeping Service you invite your accountant by email and they get their own workspace with access to your records and reports. Invites are single-use, matched to their email address, and expire after seven days.',
  ],
  [
    'What do I give my accountant at tax time?',
    'Either access or a package. Invite them to the platform, or generate, download, and print the financial reports and tax information they need. Receipt Automation customers hand over categorized expense reports and the annual Excel workbook.',
  ],
  [
    'What happens when I exceed my document allowance?',
    "Each plan includes a document allowance. If your volume regularly runs past it, move up a plan — contact support and we'll help you pick the right one.",
  ],
];

// ─── Small building blocks ──────────────────────────────────────────────────

const Eyebrow: FC<{ children: string; tone?: 'light' | 'dark' }> = ({ children, tone = 'light' }) => (
  <p
    className="text-[11px] font-semibold uppercase tracking-[0.1em]"
    style={{ color: tone === 'light' ? BLUE : '#93C5FD' }}
  >
    {children}
  </p>
);

const Tick: FC<{ color: string }> = ({ color }) => (
  <span className="mt-px flex-none" style={{ color }} aria-hidden="true">
    ✓
  </span>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const LandingPage: FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Prototype opens the first question; the server and the first client render
  // agree on 0, so hydration matches and the answer is in the crawled HTML.
  const [openFaq, setOpenFaq] = useState(0);

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
    <div className="min-h-screen bg-white font-sans text-[#111827]">
      {/* ── 1 · Header ── */}
      <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/85 backdrop-blur-md">
        <div className={`${SHELL} flex items-center justify-between py-4`}>
          <Link to="/" className="flex items-center gap-2">
            <img src={logoSvg} alt="AI Bookkeeping" width={140} height={32} className="h-8 w-auto" />
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((l) =>
              navLink(l, 'text-sm font-medium text-gray-600 transition hover:text-gray-900'),
            )}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: BLUE }}
            >
              Start free trial
            </Link>
          </div>
          <button
            type="button"
            className="lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((l) => navLink(l, 'text-left text-sm font-medium text-gray-700'))}
              <Link to="/login" className="text-left text-sm font-medium text-gray-700">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg px-4 py-2 text-center text-sm font-semibold text-white"
                style={{ backgroundColor: BLUE }}
              >
                Start free trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2 · Hero ── */}
      <section className="text-white" style={{ backgroundColor: NAVY }}>
        <div className={`${SHELL} pb-16 pt-14 sm:pb-[92px] sm:pt-[84px]`}>
          <div className="mx-auto max-w-[860px] text-center">
            <Eyebrow tone="dark">Two products, one platform</Eyebrow>
            <h1 className="mt-[22px] text-[34px] font-bold leading-[1.06] tracking-[-0.035em] sm:text-[44px] lg:text-[58px] lg:leading-[1.04]">
              {HEADLINE}
            </h1>
            <p className="mx-auto mt-6 max-w-[720px] text-[16px] leading-[1.65] text-[#C7CDD9] sm:text-[17px]">
              Our AI reads your receipts and invoices, prepares the accounting, and keeps your
              books current. Deterministic accounting rules check every entry, and anything the
              AI cannot resolve confidently goes to a human bookkeeping reviewer on our staff.
              You never categorize a transaction.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/register"
                className="w-full rounded-xl px-6 py-3.5 text-center text-[15px] font-semibold text-white transition hover:opacity-90 sm:w-auto"
                style={{ backgroundColor: BLUE }}
              >
                Start your 15-day free trial
              </Link>
              <button
                type="button"
                onClick={() => scrollTo('compare')}
                className="w-full rounded-xl border border-white/25 px-6 py-3.5 text-center text-[15px] font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Compare the two products
              </button>
            </div>
            <p className="mt-5 text-[13px] text-[#9AA3B4]">
              15-day free trial on the Bookkeeping Service · No credit card required · Canada and
              United States
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-[980px]">
            <LightboxImage
              src={dashboardPreview}
              alt="Bookkeeping Service dashboard"
              width={1120}
              height={798}
              loading="eager"
              caption={<span className="text-white/60">Illustrative — demonstration data</span>}
              imgClassName="w-full rounded-2xl border border-white/10 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── 3 · Two products ── */}
      <section id="products" className={`${SHELL} ${STEP}`}>
        <Eyebrow>Choose the right product</Eyebrow>
        <h2 className="mt-3.5 max-w-[820px] text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
          Two ways to stop doing data entry.
        </h2>
        <p className="mt-4 max-w-[760px] text-[16px] leading-[1.6] text-[#4B5563]">
          Both products read your documents with the same AI. The difference is where the work
          stops: one gives you organized records, the other maintains your books.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Receipt Automation */}
          <div className="flex flex-col rounded-[18px] border border-[#E5E7EB] bg-white p-7 sm:p-[34px]">
            <span className="self-start rounded-full bg-[#ECFDF5] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#047857]">
              Receipt Automation
            </span>
            <h3 className="mt-5 mb-2.5 text-[22px] font-bold tracking-[-0.025em] sm:text-[26px]">
              Documents in, organized records out.
            </h3>
            <p className="mb-[22px] text-[16px] leading-[1.6] text-[#4B5563]">
              Best for businesses that primarily want receipts and invoices extracted,
              categorized, and organized — with reports they can hand to their accountant.
            </p>
            <div className="flex flex-col gap-3 border-t border-[#F3F4F6] py-5">
              {T1_POINTS.map((t) => (
                <div key={t} className="flex gap-2.5 text-[15px] leading-[1.5] text-[#374151]">
                  <Tick color="#047857" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-baseline gap-2 border-t border-[#F3F4F6] pt-4">
              <span className="text-[15px] text-[#6B7280]">From</span>
              <span className="text-[28px] font-bold tracking-[-0.03em]">$29</span>
              <span className="text-[14px] text-[#6B7280]">CAD/USD per month</span>
            </div>
            <button
              type="button"
              onClick={() => scrollTo('receipts')}
              className="mt-5 self-start text-[15px] font-semibold"
              style={{ color: BLUE }}
            >
              Explore Receipt Automation →
            </button>
          </div>

          {/* Bookkeeping Service */}
          <div
            className="flex flex-col rounded-[18px] p-7 text-white sm:p-[34px]"
            style={{ backgroundColor: INK }}
          >
            <span className="self-start rounded-full bg-[#0066FF]/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#93C5FD]">
              Bookkeeping Service · AI + human review
            </span>
            <h3 className="mt-5 mb-2.5 text-[22px] font-bold tracking-[-0.025em] sm:text-[26px]">
              We maintain your books all year.
            </h3>
            <p className="mb-[22px] text-[16px] leading-[1.6] text-[#9CA3AF]">
              Best for businesses that want the platform to keep their books current using AI
              automation plus human review — so tax season is a handoff, not a rebuild.
            </p>
            <div className="flex flex-col gap-3 border-t border-white/10 py-5">
              {T2_POINTS.map((t) => (
                <div key={t} className="flex gap-2.5 text-[15px] leading-[1.5] text-[#E5E7EB]">
                  <Tick color="#3B82F6" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-baseline gap-2 border-t border-white/10 pt-4">
              <span className="text-[15px] text-[#9CA3AF]">From</span>
              <span className="text-[28px] font-bold tracking-[-0.03em]">$99</span>
              <span className="text-[14px] text-[#9CA3AF]">CAD/USD per month</span>
            </div>
            <button
              type="button"
              onClick={() => scrollTo('bookkeeping')}
              className="mt-5 self-start text-[15px] font-semibold text-[#93C5FD]"
            >
              Explore the Bookkeeping Service →
            </button>
          </div>
        </div>

        <p className="mt-8 rounded-2xl bg-[#F9FAFB] px-6 py-5 text-center text-[15px] leading-[1.6] text-[#4B5563]">
          <span className="font-semibold text-[#111827]">In one line: </span>
          <span className="font-semibold text-[#111827]">Receipt Automation</span> automates
          document processing. <span className="px-1.5 text-[#D1D5DB]">|</span>{' '}
          <span className="font-semibold text-[#111827]">Bookkeeping Service</span> maintains your
          books using AI plus human review.
        </p>
      </section>

      {/* ── 4 · Receipt Automation ── */}
      <section id="receipts" className={`${SHELL} ${STEP}`}>
        <Eyebrow>Receipt Automation</Eyebrow>
        <h2 className="mt-4 max-w-[820px] text-[26px] font-bold leading-[1.14] tracking-[-0.03em] sm:text-[30px] lg:text-[34px]">
          Photograph it once. Never type it again.
        </h2>
        <p className="mt-4 max-w-[820px] text-[16px] leading-[1.6] text-[#4B5563]">
          Upload a receipt or supplier invoice from the web app, or send it to the Telegram bot.
          The AI reads the vendor, date, totals, taxes, and line items — including from
          poor-quality phone photos — and assigns a business expense category. You get records and
          reports, not a data-entry task.
        </p>

        <div className="mt-8 grid gap-4 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <h3 className="mb-[7px] text-[15px] font-semibold tracking-[-0.01em] text-[#6B7280]">
              YOU UPLOAD
            </h3>
            <p className="text-[15px] leading-[1.55] text-[#111827]">
              Receipts and supplier invoices as JPEG, PNG, WebP, HEIC, or PDF
            </p>
          </div>
          <div className="sm:border-l sm:border-[#E5E7EB] sm:pl-8">
            <h3 className="mb-[7px] text-[15px] font-semibold tracking-[-0.01em] text-[#6B7280]">
              YOU RECEIVE
            </h3>
            <p className="text-[15px] leading-[1.55] text-[#111827]">
              Categorized expense records, tax summaries, and an Excel workbook
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link
            to="/pricing"
            className="rounded-xl px-5 py-3 text-[15px] font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: BLUE }}
          >
            See Receipt Automation plans
          </Link>
          <span className="text-[14px] text-[#6B7280]">
            Free trial — 5 documents, no credit card required.
          </span>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {T1_FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <h3 className="mb-[7px] text-[15px] font-semibold tracking-[-0.01em]">{f.title}</h3>
              <p className="text-[14px] leading-[1.6] text-[#6B7280]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5 · Bookkeeping Service workflow ── */}
      <section
        id="bookkeeping"
        className="mt-14 py-14 text-white sm:mt-[88px] sm:py-[88px]"
        style={{ backgroundColor: INK }}
      >
        <div className={SHELL}>
          <Eyebrow tone="dark">Bookkeeping Service</Eyebrow>
          <h2
            id="how"
            className="mt-5 max-w-[880px] scroll-mt-24 text-[30px] font-bold leading-[1.1] tracking-[-0.033em] sm:text-[36px] lg:text-[42px]"
          >
            You are not expected to do the bookkeeping.
          </h2>
          <p className="mt-4 max-w-[800px] text-[16px] leading-[1.6] text-[#9CA3AF]">
            This is a bookkeeping service delivered through software. Send documents; the platform
            and our reviewers do the rest. Here is the whole workflow.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW.map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold tracking-[0.08em] text-white/40">
                    {s.n}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                    style={{ backgroundColor: s.bg, color: s.fg }}
                  >
                    {s.who}
                  </span>
                </div>
                <h3 className="mb-2.5 mt-4 text-[19px] font-semibold tracking-[-0.02em] sm:text-[20px]">
                  {s.title}
                </h3>
                <p className="text-[14px] leading-[1.6] text-[#9CA3AF]">{s.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 text-[15px] leading-[1.6] text-[#D1D5DB]">
            <span className="font-semibold text-white">One thing you never do: </span>
            pick accounts, categorize transactions, write journal entries, or reconcile. That work
            belongs to the platform and our reviewers.
          </p>
        </div>
      </section>

      {/* ── 6 · AI + human review ── */}
      <section className={`${SHELL} ${STEP}`}>
        <Eyebrow>AI + human review</Eyebrow>
        <h2 className="mt-3.5 max-w-[880px] text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
          Automation where it's reliable. Human judgment where it's needed.
        </h2>
        <p className="mt-4 max-w-[860px] text-[16px] leading-[1.6] text-[#4B5563]">
          The AI does not post uncertain accounting entries. Every proposed entry passes a
          deterministic rules layer first, and anything the system cannot resolve confidently goes
          to a human bookkeeping reviewer on our staff, who checks the source document and
          corrects the treatment before it reaches your books.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7">
            <h3 className="mb-5 text-[16px] font-semibold tracking-[-0.01em] text-[#047857]">
              High-confidence transaction
            </h3>
            <div className="flex flex-col gap-2">
              {PATH_CLEAN.map((n, i) => (
                <div key={n.label}>
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                    <p className="text-[15px] font-medium">{n.label}</p>
                    <p className="text-[13px] leading-[1.5] text-[#6B7280]">{n.sub}</p>
                  </div>
                  {i < PATH_CLEAN.length - 1 && (
                    <p className="py-1 text-center text-[13px] text-[#9CA3AF]" aria-hidden="true">
                      ↓
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-5 text-[14px] leading-[1.6] text-[#4B5563]">
              Clean, balanced records with no involvement from you.
            </p>
          </div>

          <div className="rounded-2xl p-6 text-white sm:p-7" style={{ backgroundColor: INK }}>
            <h3 className="mb-5 text-[16px] font-semibold tracking-[-0.01em] text-[#FCD34D]">
              Uncertain transaction
            </h3>
            <div className="flex flex-col gap-2">
              {PATH_REVIEW.map((n, i) => (
                <div key={n.label}>
                  <div
                    className="rounded-xl border px-4 py-3"
                    style={{
                      backgroundColor: n.accent
                        ? 'rgba(251,191,36,0.12)'
                        : n.final
                          ? 'rgba(0,102,255,0.14)'
                          : 'rgba(255,255,255,0.05)',
                      borderColor: n.accent
                        ? 'rgba(251,191,36,0.35)'
                        : n.final
                          ? 'rgba(59,130,246,0.4)'
                          : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    <p className="text-[15px] font-medium">{n.label}</p>
                    <p className="text-[13px] leading-[1.5] text-[#9CA3AF]">{n.sub}</p>
                  </div>
                  {i < PATH_REVIEW.length - 1 && (
                    <p className="py-1 text-center text-[13px] text-white/35" aria-hidden="true">
                      ↓
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-5 text-[14px] leading-[1.6] text-[#9CA3AF]">
              The review queue is ours to work. It never reaches you.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7 · Your accountant, at tax time ── */}
      <section className={`${SHELL} ${STEP}`}>
        <Eyebrow>Your accountant, at tax time</Eyebrow>
        <h2 className="mt-3.5 max-w-[900px] text-[26px] font-bold leading-[1.13] tracking-[-0.03em] sm:text-[30px] lg:text-[36px]">
          Your accountant shouldn't have to rebuild your books every tax season.
        </h2>
        <p className="mt-4 max-w-[860px] text-[16px] leading-[1.6] text-[#4B5563]">
          The Bookkeeping Service keeps your financial records organized throughout the year, so
          tax preparation starts from finished books. It does not replace your accountant or tax
          professional, and it does not file returns — it makes their work faster.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
              During the year
            </p>
            <h3 className="mb-2.5 mt-3.5 text-[19px] font-semibold tracking-[-0.02em] sm:text-[21px]">
              The books stay current
            </h3>
            <p className="text-[14px] leading-[1.6] text-[#4B5563]">
              Documents are processed as they arrive. Records, reports, receivables, payables, and
              tax information stay organized — no year-end shoebox of receipts.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: BLUE }}>
              Option 1
            </p>
            <h3 className="mb-2.5 mt-3 text-[18px] font-semibold tracking-[-0.02em] sm:text-[19px]">
              Invite your accountant
            </h3>
            <p className="text-[14px] leading-[1.6] text-[#4B5563]">
              Invite them by email and they get their own workspace with access to your records
              and reports. Invites are single-use, matched to their email address, and expire
              after seven days.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: BLUE }}>
              Option 2
            </p>
            <h3 className="mb-2.5 mt-3 text-[18px] font-semibold tracking-[-0.02em] sm:text-[19px]">
              Send them the reports
            </h3>
            <p className="text-[14px] leading-[1.6] text-[#4B5563]">
              Prefer to keep the platform to yourself? Generate, download, or print the financial
              reports and tax information your accountant needs and hand the package over.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[13px] leading-[1.6] text-[#6B7280]">
          AI Bookkeeping prepares bookkeeping records. It does not file tax returns and does not
          provide tax, legal, or financial advice.
        </p>
      </section>

      {/* ── 8 · Financial visibility ── */}
      <section className={`${SHELL} ${STEP}`}>
        <Eyebrow>Financial visibility</Eyebrow>
        <h2 className="mt-3.5 max-w-[880px] text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
          Plain answers to the questions owners actually ask.
        </h2>
        <p className="mt-4 max-w-[800px] text-[16px] leading-[1.6] text-[#4B5563]">
          The Bookkeeping Service turns finished books into views you can read without knowing any
          accounting.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VISIBILITY.map((v) => (
            <div key={v.title} className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <h3 className="mb-2 text-[16px] font-semibold tracking-[-0.01em]">{v.title}</h3>
              <p className="text-[14px] leading-[1.6] text-[#6B7280]">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 9 · Security ── */}
      <section
        id="security"
        className="mt-14 py-14 text-white sm:mt-[88px] sm:py-[88px]"
        style={{ backgroundColor: NAVY }}
      >
        <div className={SHELL}>
          <Eyebrow tone="dark">Security and trust</Eyebrow>
          <h2 className="mt-3.5 max-w-[860px] text-[26px] font-bold leading-[1.13] tracking-[-0.03em] sm:text-[30px] lg:text-[36px]">
            Controls we can describe specifically.
          </h2>
          <p className="mt-4 max-w-[800px] text-[16px] leading-[1.6] text-[#9CA3AF]">
            Your financial records deserve more than a padlock icon. Here is what actually
            protects them.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {SECURITY.map((s) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="mb-2 text-[15px] font-semibold text-white">{s.title}</h3>
                <p className="text-[14px] leading-[1.6] text-[#9CA3AF]">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-7 max-w-[860px] text-[13px] leading-[1.65] text-[#9AA3B4]">
            Time2Win Inc. is a Canadian corporation and handles personal information under PIPEDA.
            Payments are processed by Stripe; we never touch card data.
          </p>
        </div>
      </section>

      {/* ── 10 · Pricing ── */}
      <section id="pricing" className={`${SHELL} ${STEP}`}>
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="mt-3.5 text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
          Software prices. Bookkeeper outcomes.
        </h2>

        {/* Bookkeeping Service */}
        <div className="mt-10">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-[20px] font-bold tracking-[-0.025em] sm:text-[22px]">
              Bookkeeping Service
            </h3>
            <span className="text-[14px] text-[#6B7280]">AI + human review</span>
          </div>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            15-day free trial · No credit card required
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {T2_PLANS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col rounded-2xl border p-6"
                style={{
                  backgroundColor: p.dark ? INK : '#FFFFFF',
                  borderColor: p.dark ? INK : '#E5E7EB',
                  color: p.dark ? '#FFFFFF' : '#111827',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[16px] font-semibold">{p.name}</span>
                  {p.tag && (
                    <span className="rounded-full bg-[#0066FF]/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#93C5FD]">
                      {p.tag}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[34px] font-bold tracking-[-0.03em]">{p.price}</span>
                  <span className="text-[13px]" style={{ color: p.dark ? '#9CA3AF' : '#6B7280' }}>
                    CAD/USD per month
                  </span>
                </div>
                <p className="mt-4 text-[15px] font-medium">{p.docs}</p>
                <p className="mt-1 text-[14px]" style={{ color: p.dark ? '#9CA3AF' : '#6B7280' }}>
                  {p.note}
                </p>
                <Link
                  to="/register"
                  className="mt-6 rounded-xl px-5 py-3 text-center text-[15px] font-semibold transition hover:opacity-90"
                  style={
                    p.dark
                      ? { backgroundColor: BLUE, color: '#FFFFFF' }
                      : { backgroundColor: '#FFFFFF', color: '#111827', border: '1px solid #D1D5DB' }
                  }
                >
                  Start 15-day free trial
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-[900px] text-[14px] leading-[1.6] text-[#6B7280]">
            Every Bookkeeping Service plan includes the full workflow: AI processing,
            accounting-rule validation, human review when needed, reports, tax information, and
            accountant access.
          </p>
        </div>

        {/* Receipt Automation */}
        <div className="mt-12">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-[20px] font-bold tracking-[-0.025em] sm:text-[22px]">
              Receipt Automation
            </h3>
            <span className="text-[14px] text-[#6B7280]">Document processing</span>
          </div>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            Free trial · 5 documents · No credit card required
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {T1_PLANS.map((p) => (
              <div key={p.name} className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-6">
                <span className="text-[16px] font-semibold">{p.name}</span>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[34px] font-bold tracking-[-0.03em]">{p.price}</span>
                  <span className="text-[13px] text-[#6B7280]">CAD/USD per month</span>
                </div>
                <p className="mt-4 text-[15px] font-medium">{p.docs}</p>
                <p className="mt-1 text-[14px] text-[#6B7280]">{p.storage}</p>
                <Link
                  to="/register"
                  className="mt-6 rounded-xl border border-[#D1D5DB] bg-white px-5 py-3 text-center text-[15px] font-semibold text-[#111827] transition hover:border-gray-400"
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-[13px] leading-[1.6] text-[#6B7280]">
          Prices in CAD/USD. Taxes may apply. Cancel anytime — no cancellation fee, access to the
          end of the period.
        </p>
      </section>

      {/* ── 11 · Detailed comparison ── */}
      <section id="compare" className={`${SHELL} ${STEP} scroll-mt-20`}>
        <Eyebrow>Detailed comparison</Eyebrow>
        <h2 className="mt-3.5 text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
          Side by side.
        </h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-[#E5E7EB]">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB]">
                <th className="px-5 py-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                  Capability
                </th>
                <th className="px-5 py-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                  Receipt Automation
                </th>
                <th className="px-5 py-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                  Bookkeeping Service
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.label} className="border-t border-[#F3F4F6]">
                  <td className="px-5 py-4 text-[14px] font-medium text-[#111827]">{r.label}</td>
                  <td
                    className="px-5 py-4 text-[14px]"
                    style={{ color: r.aMuted ? '#9CA3AF' : '#111827' }}
                  >
                    {r.a}
                  </td>
                  <td className="px-5 py-4 text-[14px] text-[#111827]">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 12 · Who it's for ── */}
      <section className={`${SHELL} ${STEP}`}>
        <Eyebrow>Who it's for</Eyebrow>
        <h2 className="mt-3.5 max-w-[900px] text-[28px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
          Built for owners whose time is worth more than data entry.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
              <h3 className="mb-2.5 text-[16px] font-semibold tracking-[-0.01em]">{a.title}</h3>
              <p className="text-[14px] leading-[1.6] text-[#6B7280]">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 13 · FAQ ── */}
      <section id="faq" className={`${SHELL} ${STEP}`}>
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="mt-3.5 max-w-[860px] text-[26px] font-bold leading-[1.13] tracking-[-0.03em] sm:text-[30px] lg:text-[36px]">
          Questions owners ask before signing up.
        </h2>
        <p className="mt-4 text-[15px] text-[#4B5563]">
          Something not covered here?{' '}
          <a href="mailto:support@ai-bookkeeping.ai" className="font-medium" style={{ color: BLUE }}>
            Email support
          </a>{' '}
          and a person will answer.
        </p>
        <div className="mt-8 rounded-2xl border border-[#E5E7EB] bg-white px-6">
          {FAQS.map(([q, a], i) => (
            <div key={q} className="border-b border-[#F3F4F6] last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenFaq((o) => (o === i ? -1 : i))}
                aria-expanded={openFaq === i}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-[15px] font-medium"
              >
                <span>{q}</span>
                <span className="shrink-0 text-[20px] font-normal text-[#9CA3AF]" aria-hidden="true">
                  {openFaq === i ? '–' : '+'}
                </span>
              </button>
              {openFaq === i && (
                <p className="pb-5 pr-8 text-[14px] leading-[1.65] text-[#6B7280]">{a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 14 · Final CTA ── */}
      <section className={`${SHELL} ${STEP} pb-14 text-center sm:pb-[88px]`}>
        <h2 className="mx-auto max-w-[760px] text-[30px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[36px] lg:text-[44px]">
          Upload your documents. Let the platform handle the bookkeeping.
        </h2>
        <p className="mx-auto mt-5 max-w-[720px] text-[16px] leading-[1.6] text-[#4B5563]">
          Start with the Bookkeeping Service and see your books stay current — or begin with
          Receipt Automation and move up when you're ready.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="w-full rounded-xl px-6 py-3.5 text-center text-[15px] font-semibold text-white transition hover:opacity-90 sm:w-auto"
            style={{ backgroundColor: BLUE }}
          >
            Start your 15-day free trial
          </Link>
          <button
            type="button"
            onClick={() => scrollTo('compare')}
            className="w-full rounded-xl border border-[#D1D5DB] bg-white px-6 py-3.5 text-center text-[15px] font-semibold text-[#111827] transition hover:border-gray-400 sm:w-auto"
          >
            Compare products
          </button>
        </div>
        <p className="mt-4 text-[13px] text-[#6B7280]">
          No credit card required. Cancel anytime.
        </p>
      </section>

      {/* ── 15 · Footer ── */}
      <footer className="mt-14 text-white sm:mt-[88px]" style={{ backgroundColor: NAVY }}>
        <div className={`${SHELL} grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4`}>
          <div>
            <img
              src={logoSvg}
              alt="AI Bookkeeping"
              width={140}
              height={32}
              className="h-8 w-auto brightness-0 invert"
            />
            <p className="mt-4 text-[14px] leading-[1.6] text-white/70">
              Bookkeeping done for you, by Time2Win Inc. — a Canadian corporation serving small
              businesses in Canada and the United States.
            </p>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white">Product</h3>
            <ul className="mt-4 space-y-2 text-[14px]">
              <li>
                <Link to="/pricing" className="text-white/70 transition hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('bookkeeping')}
                  className="text-white/70 transition hover:text-white"
                >
                  Bookkeeping Service
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('receipts')}
                  className="text-white/70 transition hover:text-white"
                >
                  Receipt Automation
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('compare')}
                  className="text-white/70 transition hover:text-white"
                >
                  Compare
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white">Learn</h3>
            <ul className="mt-4 space-y-2 text-[14px]">
              <li>
                <a href="/blog" className="text-white/70 transition hover:text-white">
                  Blog
                </a>
              </li>
              <li>
                <Link to="/faq" className="text-white/70 transition hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('how')}
                  className="text-white/70 transition hover:text-white"
                >
                  How it works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('security')}
                  className="text-white/70 transition hover:text-white"
                >
                  Security
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-2 text-[14px]">
              <li>
                <a
                  href="mailto:support@ai-bookkeeping.ai"
                  className="text-white/70 transition hover:text-white"
                >
                  Support
                </a>
              </li>
              <li>
                <Link to="/privacy-policy" className="text-white/70 transition hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="text-white/70 transition hover:text-white">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className={`${SHELL} border-t border-white/10 py-6`}>
          <p className="text-center text-[13px] leading-[1.6] text-white/60">
            AI Bookkeeping prepares bookkeeping records. It does not file tax returns and does not
            provide tax, legal, or financial advice — work with your accountant. Prices in
            CAD/USD; taxes may apply. © 2026 Time2Win Inc.
          </p>
        </div>
      </footer>
    </div>
  );
};
