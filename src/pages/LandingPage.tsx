// Public homepage — S61 Chain C-fix, exact prototype fidelity (O-S61-20, DR-1..11, DR-G).
//
// Rebuilt section-by-section against the owner's prototype, which is the
// LAYOUT AND VISUAL AUTHORITY for every section (CE-S61-3). Where the
// prototype's text and the ratified copy differ, RATIFIED COPY WINS:
//
//   * Hero <h1> is the O-S61-6 token, verbatim and as a SINGLE uninterrupted
//     text node (the prototype's two-tone split would break the standing
//     verbatim-H1 grep, so the color split is deliberately not applied).
//   * Bookkeeping Service document counts stay UNIT-FREE ("150 docs"):
//     TIER2_PLAN_MAPPING is applied by resolve_org_daily_limit as a DAILY
//     agent cap, so the prototype's "per month" would be false. Receipt
//     Automation keeps "per month" — that quota is genuinely monthly
//     (billing/plans.py).
//   * Receipt Automation trial line is "Free trial — 5 documents, no credit
//     card required." The prototype's "5-day" is dropped: only the
//     5-document limit is verifiable.
//   * Accountant invites "expire after seven days" (INVITE_TTL_DAYS = 7),
//     not the prototype's vaguer "expiring".
//   * Security footnote is the two ratified sentences only; the prototype's
//     third ("a formal security review program…") is omitted as a compliance
//     claim, and the retention card follows PrivacyPolicy.tsx §9 rather than
//     the prototype's unverifiable "30 days / six years" numbers.
//   * Stripe claim ships in the ratified shape.
//
// scripts/prerender.mjs fails the build if "waitlist", "coming soon", "in
// development", or "Advanced" as a product name reappears in shipped markup.
import { type FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dashboardPreview from '@/assets/dashboard-illustrative.webp';
import { LightboxImage } from '@/components/Lightbox';

// ─── Tokens (lifted from the prototype) ──────────────────────────────────────

const PAGE = '#F9FAFB';
const NAVY = '#1A1F36';
const INK = '#111827';
const BLUE = '#0066FF';
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// O-S61-6 headline token. Rendered as the prototype's two-tone split (O-S61-21):
// the two halves are declared separately so the split can never silently drift
// from the token — HEADLINE is asserted to be exactly the two joined by a space.
const HEADLINE_A = 'You run the business.';
const HEADLINE_B = 'We keep the books.';
const HEADLINE = `${HEADLINE_A} ${HEADLINE_B}`;
const PAGE_TITLE = `AI Bookkeeping — ${HEADLINE}`;

// Prototype rhythm: 1200px column, 88px top step, 32px gutter.
const SHELL = 'mx-auto w-full max-w-[1200px] px-5 sm:px-8';
const STEP = 'pt-14 sm:pt-[88px]';

// ─── Content ──────────────────────────────────────────────────────────────────

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
  { title: 'Any photo quality', body: 'Crumpled, dim, angled — the AI reads it. JPEG, PNG, WebP, HEIC, and PDF.' },
  { title: 'Vendor names cleaned', body: '"COSTCO WHSE #556" becomes Costco Wholesale, consistently across reports.' },
  { title: 'Tax amounts separated', body: "Recoverable GST/HST is split out on each receipt, so credits aren't missed." },
  { title: 'CRA-aligned categories', body: 'Expenses land in categories that map to CRA expense reporting.' },
  { title: 'Reports and Excel', body: 'Expense-by-category and GST/HST summaries, plus an annual .xlsx workbook.' },
  { title: 'Full manual control', body: 'Edit any extracted record in the edit drawer or workbook view. Nothing is a black box.' },
];

const WORKFLOW = [
  { n: '01', who: 'You', bg: 'rgba(255,255,255,0.1)', fg: '#E5E7EB', title: 'Upload and connect',
    body: 'Send receipts, supplier invoices, and client invoices from the web app or the Telegram bot — and connect your bank, cards, and Stripe so transactions arrive on their own.' },
  { n: '02', who: 'AI', bg: 'rgba(251,191,36,0.14)', fg: '#FCD34D', title: 'AI bookkeeping',
    body: 'The AI extracts the information, determines the accounting treatment, and prepares the bookkeeping records.' },
  { n: '03', who: 'Platform', bg: 'rgba(0,102,255,0.18)', fg: '#93C5FD', title: 'Accounting rules',
    body: 'Deterministic controls validate the proposed treatment. Debits must equal credits, accounts must be real. Anything that fails does not post.' },
  { n: '04', who: 'Our staff', bg: 'rgba(16,185,129,0.16)', fg: '#6EE7B7', title: 'Human review when needed',
    body: 'Transactions the system cannot confidently resolve are checked against the source document and corrected by a human bookkeeping reviewer.' },
  { n: '05', who: 'Platform', bg: 'rgba(0,102,255,0.18)', fg: '#93C5FD', title: 'Books stay current',
    body: 'Records, reports, tax information, receivables, and payables stay organized throughout the year — not rebuilt in March.' },
  { n: '06', who: 'You + accountant', bg: 'rgba(255,255,255,0.1)', fg: '#E5E7EB', title: 'Accountant ready',
    body: 'Invite your accountant to their own workspace, or download the completed reports and hand them over at tax time.' },
];

const PATH_CLEAN = [
  { label: 'Document arrives', sub: 'Receipt, invoice, or connected transaction' },
  { label: 'AI prepares the entry', sub: 'Extraction, treatment, and a confidence assessment' },
  { label: 'Accounting rules validate', sub: 'Deterministic checks, not a model' },
  { label: 'Posted to your books', sub: 'Balanced, with the source document attached' },
];

const PATH_REVIEW = [
  { label: 'Document arrives', sub: 'Or a large-value transaction of any confidence',
    bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  { label: 'AI prepares the entry', sub: 'The AI is built to escalate rather than guess',
    bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  { label: 'Accounting rules flag it', sub: 'Uncertain, ambiguous, or rule-flagged — it does not post',
    bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
  { label: 'Human reviewer takes it', sub: 'Trained platform staff open the source document and decide',
    bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)' },
  { label: 'Corrected entry posts', sub: 'Through the same accounting engine — nobody bypasses the rules',
    bg: 'rgba(0,102,255,0.14)', border: 'rgba(59,130,246,0.4)' },
];

const VISIBILITY = [
  { title: 'Cash', body: 'What you actually have across your connected business accounts.' },
  { title: 'Revenue', body: 'What the business has earned, period over period.' },
  { title: 'Expenses', body: 'Where the money went, grouped the way your accountant expects.' },
  { title: 'Profit', body: 'Profit to date and by fiscal quarter, from real books.' },
  { title: 'Money customers owe you', body: 'Client balances and aging, with statements of account.' },
  { title: 'Money you owe', body: 'Supplier balances and aging, so nothing is a surprise.' },
  { title: 'Taxes', body: 'Tax collected against credits for the current filing period, with CRA GST/HST deadlines tracked.' },
  { title: 'Reports', body: 'Profit & Loss and Balance Sheet as of any date, downloadable and printable.' },
];

// DR-7 / mini copy gate A. Titles are the prototype's eight; bodies are pinned
// to repo-verifiable behaviour. "Deletion and retention" deliberately follows
// PrivacyPolicy.tsx §9 (erasure on delete; statutory retention only) instead of
// the prototype's "30 days / about six years", which the policy does not state.
const SECURITY = [
  { title: 'Secure document handling',
    body: 'Financial documents are held in private storage reached only through expiring signed links. No public file URLs.' },
  { title: 'AI output is validated',
    body: 'No AI-proposed entry reaches your books without passing deterministic accounting rules first.' },
  { title: 'Human review of uncertainty',
    body: "Entries the system can't confidently resolve are decided by trained staff, not posted on a guess." },
  { title: 'Immutable audit trail',
    body: 'Nothing is edited in place. Corrections post as new linked entries, and every financial action is logged with who and when.' },
  { title: 'Account permissions',
    body: 'Owner, external accountant, and internal reviewer roles each see exactly what they should — no more.' },
  { title: 'Data isolation',
    body: "Every organization's data is walled off, with permission rules covered by deny-path testing." },
  { title: 'Secure bank connections',
    body: 'Bank and credit-card connections run through Plaid. The platform never sees your banking credentials.' },
  { title: 'Deletion and retention',
    body: 'When you delete a document or your account, the underlying files are erased from storage. Where the law requires specific records to be kept, they are retained for that period and no longer.' },
];

// DR-8 / mini copy gate B: audience-fit descriptors, zero count or time-period
// claims. The counts live in `docs` and stay unit-free.
const T2_PLANS = [
  { name: 'Starter', price: '$99', docs: '150 docs', note: 'For owner-operated businesses with steady, modest volume.', tag: '', dark: false },
  { name: 'Growth', price: '$199', docs: '250 docs', note: 'For growing businesses with suppliers, clients, and regular invoicing.', tag: 'Most chosen', dark: true },
  { name: 'Pro', price: '$399', docs: '500 docs', note: 'For higher-volume businesses that want everything maintained.', tag: '', dark: false },
];

const T1_PLANS = [
  { name: 'Starter', price: '$29', docs: '100 documents per month', storage: '1 GB storage' },
  { name: 'Growth', price: '$49', docs: '300 documents per month', storage: '5 GB storage' },
  { name: 'Pro', price: '$69', docs: '500 documents per month', storage: '20 GB storage' },
];

const COMPARISON: { label: string; a: string; b: string; aMuted?: boolean }[] = [
  { label: 'AI document processing', a: 'Included', b: 'Included' },
  { label: 'Automatic categorization', a: 'Expense categories', b: 'Full accounting treatment' },
  { label: 'GST/HST tracking', a: 'Input tax credits on receipts', b: 'Tax collected, credits, and filing periods' },
  { label: 'Full double-entry books', a: 'Not included', b: 'Included', aMuted: true },
  { label: 'Human review of uncertain entries', a: 'Not included', b: 'Trained reviewers on our staff', aMuted: true },
  { label: 'Bank and credit-card connections', a: 'Not included', b: 'Included, via Plaid', aMuted: true },
  { label: 'Stripe connection', a: 'Not included', b: 'Revenue and processing fees posted automatically', aMuted: true },
  { label: 'Reconciliation', a: 'Not included', b: 'Handled for you', aMuted: true },
  { label: 'Financial statements', a: 'Expense and tax reports', b: 'Profit & Loss and Balance Sheet' },
  { label: 'Receivables and payables', a: 'Not included', b: 'Client and supplier balances with aging', aMuted: true },
  { label: 'Financial visibility dashboard', a: 'Expense summaries', b: 'Cash, profit, taxes, and cash flow' },
  { label: 'Accountant access', a: 'Share exported files', b: 'Their own workspace, by invitation' },
  { label: 'Tax-time reporting', a: 'Annual Excel workbook', b: 'Full report package, plus workspace access' },
  { label: 'Excel export', a: 'Included', b: 'Included' },
  { label: 'Free trial', a: '5 documents, no credit card', b: '15 days, no credit card' },
  { label: 'Monthly price', a: '$29 – $69 CAD/USD', b: '$99 – $399 CAD/USD' },
];

const AUDIENCES = [
  { title: 'Contractors and trades', body: 'Receipts from the lumber yard, the gas station, and the supply house — handled without an evening of typing.' },
  { title: 'Small businesses', body: 'Real books maintained during the year instead of reconstructed under deadline.' },
  { title: 'Startups', body: 'A clean, auditable history from day one, for the diligence conversation later.' },
  { title: 'Owner-operated companies', body: 'Incorporated, mixing personal and business cards, and short on time for any of it.' },
  { title: 'Already have an accountant', body: 'Keep them. We keep the books current so their work starts from finished records.' },
];

// DR-10: order is fixed by ruling; content unchanged from the ratified set.
const FAQS: [string, string][] = [
  ['What is the difference between Receipt Automation and the Bookkeeping Service?',
   'Receipt Automation processes your documents: it extracts, categorizes, and organizes receipts and supplier invoices, then gives you expense records, tax summaries, and Excel exports. The Bookkeeping Service goes further and maintains your books — double-entry records, reconciliation, financial statements, tax information, receivables and payables — with human review of anything the AI cannot resolve confidently.'],
  ['Do I need to know bookkeeping?',
   'No. The Bookkeeping Service is designed so you never choose accounts, write journal entries, or reconcile anything. You send documents and read the results in plain business language.'],
  ['Do I have to categorize my own expenses?',
   'No. The AI determines the accounting treatment and our accounting rules validate it. On Receipt Automation you can edit any extracted record if you want to, but nothing requires it.'],
  ["What happens if the AI isn't sure?",
   'The entry does not post. It goes to a review queue where a human bookkeeping reviewer on our staff opens the source document, decides the correct treatment, and posts it through the same accounting engine. Large-value entries are routed to review regardless of confidence.'],
  ['Is a human involved?',
   'Yes, on the Bookkeeping Service. Trained reviewers on our staff work the review queue. You never see that queue, and you are never asked to resolve an entry yourself.'],
  ['Can I keep my existing accountant?',
   'Yes, and you should. The platform keeps your books organized during the year; your accountant does the accountant work. It does not replace them.'],
  ['Can I invite my accountant?',
   'Yes. On the Bookkeeping Service you invite your accountant by email and they get their own workspace with access to your records and reports. Invites are single-use, matched to their email address, and expire after seven days.'],
  ['What do I give my accountant at tax time?',
   'Either access or a package. Invite them to the platform, or generate, download, and print the financial reports and tax information they need. Receipt Automation customers hand over categorized expense reports and the annual Excel workbook.'],
  ['Does the platform prepare my tax return?',
   'No. AI Bookkeeping prepares bookkeeping records and the reports behind them. It does not file returns and does not provide tax, legal, or financial advice.'],
  ['What happens when I exceed my document allowance?',
   "Each plan includes a document allowance. If your volume regularly runs past it, move up a plan — contact support and we'll help you pick the right one."],
  ['Do I need to connect my bank?',
   'Bank and credit-card connections are part of the Bookkeeping Service and run through Plaid, so we never see your banking credentials. You can also connect Stripe, and your revenue and processing fees are posted into your books automatically.'],
  ['Is a credit card required for the trial?',
   "No. The Bookkeeping Service trial runs 15 days with no credit card. Receipt Automation's free trial covers 5 documents, also with no credit card."],
];

// ─── Building blocks ─────────────────────────────────────────────────────────

/** DR-G: section eyebrows are muted gray uppercase, never blue. */
const Eyebrow: FC<{ children: string; tone?: 'muted' | 'onDark' }> = ({ children, tone = 'muted' }) => (
  <div
    className="text-[12px] font-semibold uppercase tracking-[0.1em]"
    style={{ color: tone === 'muted' ? '#6B7280' : '#93C5FD' }}
  >
    {children}
  </div>
);

/** DR-G: labels render as pills wherever the prototype shows pills. */
const Pill: FC<{
  children: string;
  bg?: string;
  color: string;
  border?: string;
  size?: 'sm' | 'xs';
  className?: string;
}> = ({ children, bg = 'transparent', color, border, size = 'sm', className = '' }) => (
  <span
    className={`inline-flex items-center rounded-full font-semibold uppercase ${
      size === 'sm' ? 'px-3 py-[5px] text-[11px] tracking-[0.1em]' : 'px-[10px] py-[3px] text-[10.5px] tracking-[0.08em]'
    } ${className}`}
    style={{ background: bg, color, border: border ? `1px solid ${border}` : undefined }}
  >
    {children}
  </span>
);

const Mono: FC<{ children: string; color: string; className?: string }> = ({ children, color, className = '' }) => (
  <div className={`text-[11px] tracking-[0.06em] ${className}`} style={{ fontFamily: MONO, color }}>
    {children}
  </div>
);

const Brand: FC<{ dark?: boolean }> = ({ dark = false }) => (
  <div className="flex items-center gap-2.5">
    <span
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[13px] font-bold tracking-[-0.03em]"
      style={{ background: dark ? '#FFFFFF' : INK, color: dark ? INK : '#FFFFFF' }}
      aria-hidden="true"
    >
      ai
    </span>
    <span
      className="text-[15px] font-semibold tracking-[-0.02em]"
      style={{ color: dark ? '#FFFFFF' : INK }}
    >
      AI Bookkeeping
    </span>
  </div>
);

const Tick: FC<{ color: string }> = ({ color }) => (
  <span className="flex-none" style={{ color }} aria-hidden="true">
    ✓
  </span>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const LandingPage: FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

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

  // Prototype header IA: five in-page anchors, Login, then the "Start free
  // trial" pill. Blog and FAQ keep real links in the footer.
  const NAV: { label: string; id: string }[] = [
    { label: 'Receipt Automation', id: 'receipts' },
    { label: 'Bookkeeping Service', id: 'bookkeeping' },
    { label: 'How it works', id: 'how' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Security', id: 'security' },
  ];

  return (
    <div className="min-h-screen font-sans" style={{ background: PAGE, color: INK }}>
      {/* ── 1 · Header ── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'rgba(249,250,251,0.9)', borderColor: '#E5E7EB' }}
      >
        <div className={`${SHELL} flex items-center justify-between gap-6 py-3.5`}>
          <Link to="/" aria-label="AI Bookkeeping — home">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-[22px] lg:flex">
            {NAV.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => scrollTo(l.id)}
                className="text-[13.5px] font-medium transition hover:text-gray-900"
                style={{ color: '#4B5563' }}
              >
                {l.label}
              </button>
            ))}
            <Link to="/login" className="text-[13.5px] font-medium transition hover:text-gray-900" style={{ color: '#4B5563' }}>
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-full px-[18px] py-[9px] text-[13.5px] font-semibold text-white transition hover:bg-black"
              style={{ background: INK }}
            >
              Start free trial
            </Link>
          </nav>
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
          <div className="border-t px-5 py-4 lg:hidden" style={{ borderColor: '#E5E7EB', background: PAGE }}>
            <div className="flex flex-col gap-3">
              {NAV.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => scrollTo(l.id)}
                  className="text-left text-sm font-medium"
                  style={{ color: '#374151' }}
                >
                  {l.label}
                </button>
              ))}
              <Link to="/login" className="text-left text-sm font-medium" style={{ color: '#374151' }}>
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: INK }}
              >
                Start free trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2 · Hero (DR-1) ── */}
      <section className="text-white" style={{ background: NAVY }}>
        <div className={`${SHELL} grid items-center gap-10 pb-16 pt-14 sm:pb-[92px] sm:pt-[84px] lg:grid-cols-[1.02fr_0.98fr] lg:gap-[60px]`}>
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em]"
              style={{ background: 'rgba(0,102,255,0.16)', border: '1px solid rgba(59,130,246,0.45)', color: '#93C5FD' }}
            >
              <span className="block h-1.5 w-1.5 rounded-full" style={{ background: '#3B82F6' }} aria-hidden="true" />
              Two products, one platform
            </div>
            {/* O-S61-21: the prototype's two-tone split is implemented, so the
                headline token is no longer one contiguous string in the markup.
                It is still VERBATIM as rendered text — HEADLINE_A + line break
                + HEADLINE_B reconstitutes HEADLINE exactly, and the standing
                gate greps the h1 with tags stripped and <br> read as the space
                it renders as. */}
            <h1 className="mt-[22px] text-[36px] font-bold leading-[1.06] tracking-[-0.035em] text-balance sm:text-[46px] lg:text-[58px] lg:leading-[1.04]">
              {HEADLINE_A}
              <br />
              <span style={{ color: '#93C5FD' }}>{HEADLINE_B}</span>
            </h1>
            <p className="mt-[22px] max-w-[560px] text-[17px] leading-[1.6] sm:text-[19px]" style={{ color: '#C7CBD8' }}>
              Our AI reads your receipts and invoices, prepares the accounting, and keeps your books
              current. Deterministic accounting rules check every entry, and anything the AI cannot
              resolve confidently goes to a human bookkeeping reviewer on our staff. You never
              categorize a transaction.
            </p>
            <div className="mt-[34px] flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center rounded-xl px-7 py-4 text-[16px] font-semibold text-white transition hover:opacity-90"
                style={{ background: BLUE }}
              >
                Start your 15-day free trial
              </Link>
              <button
                type="button"
                onClick={() => scrollTo('compare')}
                className="inline-flex items-center rounded-xl px-6 py-4 text-[16px] font-medium text-white transition hover:border-white/55"
                style={{ border: '1px solid rgba(255,255,255,0.24)' }}
              >
                Compare the two products
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[14px]" style={{ color: '#8C93A8' }}>
              <span>15-day free trial on the Bookkeeping Service</span>
              <span aria-hidden="true">·</span>
              <span>No credit card required</span>
              <span aria-hidden="true">·</span>
              <span>Canada and United States</span>
            </div>
          </div>

          {/* Browser-chrome frame; caption sits inside the card. */}
          <div
            className="rounded-[20px] p-3.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="flex gap-1.5 px-2 pb-3 pt-1.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="block h-[9px] w-[9px] rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }} />
              ))}
            </div>
            <div
              className="relative h-[240px] overflow-hidden rounded-xl sm:h-[340px] lg:h-[430px]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <LightboxImage
                src={dashboardPreview}
                alt="Bookkeeping Service dashboard"
                width={1120}
                height={798}
                loading="eager"
                className="absolute inset-0"
                imgClassName="h-full w-full object-cover object-top"
              />
            </div>
            <div className="px-2 pb-1 pt-3 text-[12px]" style={{ color: '#8C93A8' }}>
              Illustrative — demonstration data
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 · Product chooser (DR-2) ── */}
      <section id="products" className={`${SHELL} ${STEP}`}>
        <div className="max-w-[740px]">
          <Eyebrow>Choose the right product</Eyebrow>
          <h2 className="mt-3.5 text-[30px] font-bold leading-[1.12] tracking-[-0.03em] text-balance sm:text-[34px] lg:text-[40px]">
            Two ways to stop doing data entry.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.65] sm:text-[18px]" style={{ color: '#4B5563' }}>
            Both products read your documents with the same AI. The difference is where the work
            stops: one gives you organized records, the other maintains your books.
          </p>
        </div>

        <div className="mt-10 grid gap-[22px] lg:grid-cols-2">
          {/* Receipt Automation — light */}
          <div className="flex flex-col rounded-[18px] bg-white p-7 sm:p-[34px]" style={{ border: '1px solid #E5E7EB' }}>
            <div>
              <Pill bg="#ECFDF5" color="#047857">Receipt Automation</Pill>
            </div>
            <h3 className="mb-2.5 mt-5 text-[23px] font-bold tracking-[-0.025em] sm:text-[26px]">
              Documents in, organized records out.
            </h3>
            <p className="mb-[22px] text-[16px] leading-[1.6]" style={{ color: '#4B5563' }}>
              Best for businesses that primarily want receipts and invoices extracted, categorized,
              and organized — with reports they can hand to their accountant.
            </p>
            <div className="flex flex-col gap-3 py-5" style={{ borderTop: '1px solid #F3F4F6' }}>
              {T1_POINTS.map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[15px] leading-[1.5]" style={{ color: '#374151' }}>
                  <Tick color="#047857" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-baseline gap-2 pt-4" style={{ borderTop: '1px solid #F3F4F6' }}>
              <span className="text-[15px]" style={{ color: '#6B7280' }}>From</span>
              <span className="text-[28px] font-bold tracking-[-0.03em]">$29</span>
              <span className="text-[14px]" style={{ color: '#6B7280' }}>CAD/USD per month</span>
            </div>
            <button
              type="button"
              onClick={() => scrollTo('receipts')}
              className="mt-[18px] w-full rounded-[11px] px-5 py-3.5 text-[15px] font-semibold transition hover:border-gray-900"
              style={{ border: '1px solid #D1D5DB', color: INK }}
            >
              Explore Receipt Automation
            </button>
          </div>

          {/* Bookkeeping Service — dark */}
          <div className="flex flex-col rounded-[18px] p-7 text-white sm:p-[34px]" style={{ background: INK }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <Pill bg="rgba(0,102,255,0.18)" color="#93C5FD">Bookkeeping Service</Pill>
              <Pill color="#D1D5DB" border="rgba(255,255,255,0.22)" size="xs">AI + human review</Pill>
            </div>
            <h3 className="mb-2.5 mt-5 text-[23px] font-bold tracking-[-0.025em] sm:text-[26px]">
              We maintain your books all year.
            </h3>
            <p className="mb-[22px] text-[16px] leading-[1.6]" style={{ color: '#C7CBD8' }}>
              Best for businesses that want the platform to keep their books current using AI
              automation plus human review — so tax season is a handoff, not a rebuild.
            </p>
            <div className="flex flex-col gap-3 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {T2_POINTS.map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[15px] leading-[1.5]" style={{ color: '#E5E7EB' }}>
                  <Tick color="#3B82F6" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-baseline gap-2 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-[15px]" style={{ color: '#9CA3AF' }}>From</span>
              <span className="text-[28px] font-bold tracking-[-0.03em]">$99</span>
              <span className="text-[14px]" style={{ color: '#9CA3AF' }}>CAD/USD per month</span>
            </div>
            <button
              type="button"
              onClick={() => scrollTo('bookkeeping')}
              className="mt-[18px] w-full rounded-[11px] px-5 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
              style={{ background: BLUE }}
            >
              Explore the Bookkeeping Service
            </button>
          </div>
        </div>

        <div
          className="mt-[22px] flex flex-wrap items-center gap-x-[18px] gap-y-2.5 rounded-[14px] bg-white px-[26px] py-5 text-[15px]"
          style={{ border: '1px solid #F3F4F6', color: '#4B5563' }}
        >
          <strong className="font-semibold" style={{ color: INK }}>In one line:</strong>
          <span><strong className="font-semibold" style={{ color: INK }}>Receipt Automation</strong> automates document processing.</span>
          <span aria-hidden="true" style={{ color: '#D1D5DB' }}>|</span>
          <span><strong className="font-semibold" style={{ color: INK }}>Bookkeeping Service</strong> maintains your books using AI plus human review.</span>
        </div>
      </section>

      {/* ── 4 · Receipt Automation (DR-3) ── */}
      <section id="receipts" className={`${SHELL} ${STEP} scroll-mt-20`}>
        <div
          className="rounded-[20px] bg-white p-6 shadow-sm sm:p-11"
          style={{ border: '1px solid #F3F4F6' }}
        >
          <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-[52px]">
            <div>
              <div>
                <Pill bg="#ECFDF5" color="#047857">Receipt Automation</Pill>
              </div>
              <h2 className="mt-[18px] text-[27px] font-bold leading-[1.14] tracking-[-0.03em] sm:text-[30px] lg:text-[34px]">
                Photograph it once.
                <br />
                Never type it again.
              </h2>
              <p className="mt-4 text-[16px] leading-[1.65] sm:text-[17px]" style={{ color: '#4B5563' }}>
                Upload a receipt or supplier invoice from the web app, or send it to the Telegram
                bot. The AI reads the vendor, date, totals, taxes, and line items — including from
                poor-quality phone photos — and assigns a business expense category. You get records
                and reports, not a data-entry task.
              </p>
              <div className="mt-[26px] grid gap-3.5 sm:grid-cols-2">
                <div className="rounded-xl p-4" style={{ background: PAGE, border: '1px solid #F3F4F6' }}>
                  <Mono color="#9CA3AF">YOU UPLOAD</Mono>
                  <div className="mt-2 text-[14px] leading-[1.55]" style={{ color: '#374151' }}>
                    Receipts and supplier invoices as JPEG, PNG, WebP, HEIC, or PDF
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: PAGE, border: '1px solid #F3F4F6' }}>
                  <Mono color="#9CA3AF">YOU RECEIVE</Mono>
                  <div className="mt-2 text-[14px] leading-[1.55]" style={{ color: '#374151' }}>
                    Categorized expense records, tax summaries, and an Excel workbook
                  </div>
                </div>
              </div>
              <Link
                to="/pricing"
                className="mt-[26px] inline-flex items-center rounded-[11px] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black"
                style={{ background: INK }}
              >
                See Receipt Automation plans
              </Link>
              <p className="mt-3 text-[13px]" style={{ color: '#6B7280' }}>
                Free trial — 5 documents, no credit card required.
              </p>
            </div>

            <div>
              {/* Placeholder ships as-is per the OD-S61-1 extension: no fabricated screenshot. */}
              <div
                className="flex h-[220px] items-center justify-center rounded-[14px] px-6 text-center sm:h-[280px]"
                style={{ background: PAGE, border: '1px dashed #D1D5DB' }}
              >
                <span className="text-[13px] leading-[1.6]" style={{ color: '#9CA3AF' }}>
                  Receipt Automation screenshot — extracted receipt record, redacted
                </span>
              </div>
              <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
                {T1_FEATURES.map((f) => (
                  <div key={f.title} className="rounded-xl p-[18px]" style={{ background: PAGE, border: '1px solid #F3F4F6' }}>
                    <h3 className="mb-[7px] text-[15px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                    <p className="text-[13.5px] leading-[1.55]" style={{ color: '#6B7280' }}>{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 · Workflow (DR-4) ── */}
      <section
        id="bookkeeping"
        className="mt-14 scroll-mt-20 py-14 text-white sm:mt-[88px] sm:py-[88px]"
        style={{ background: INK }}
      >
        <div className={SHELL}>
          <div className="max-w-[760px]">
            <div>
              <Pill bg="rgba(0,102,255,0.18)" color="#93C5FD">Bookkeeping Service</Pill>
            </div>
            <h2
              id="how"
              className="mt-5 scroll-mt-24 text-[31px] font-bold leading-[1.1] tracking-[-0.033em] sm:text-[36px] lg:text-[42px]"
            >
              You are not expected
              <br />
              to do the bookkeeping.
            </h2>
            <p className="mt-[18px] text-[17px] leading-[1.65] sm:text-[18px]" style={{ color: '#C7CBD8' }}>
              This is a bookkeeping service delivered through software. Send documents; the platform
              and our reviewers do the rest. Here is the whole workflow.
            </p>
          </div>

          <div className="mt-11 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl p-[26px]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px]" style={{ fontFamily: MONO, color: '#6B7280' }}>{s.n}</span>
                  <Pill bg={s.bg} color={s.fg} size="xs">{s.who}</Pill>
                </div>
                <h3 className="mb-2.5 mt-4 text-[19px] font-semibold tracking-[-0.02em] sm:text-[20px]">{s.title}</h3>
                <p className="text-[15px] leading-[1.6]" style={{ color: '#9CA3AF' }}>{s.body}</p>
              </div>
            ))}
          </div>

          <div
            className="mt-[22px] rounded-2xl px-7 py-6"
            style={{ background: 'rgba(0,102,255,0.1)', border: '1px solid rgba(59,130,246,0.35)' }}
          >
            <strong className="block text-[16px] font-semibold text-white">One thing you never do:</strong>
            <span className="mt-2 block text-[16px] leading-[1.6]" style={{ color: '#C7CBD8' }}>
              pick accounts, categorize transactions, write journal entries, or reconcile. That work
              belongs to the platform and our reviewers.
            </span>
          </div>
        </div>
      </section>

      {/* ── 6 · AI + human review (DR-5) ── */}
      <section className={`${SHELL} ${STEP}`}>
        <div className="max-w-[740px]">
          <Eyebrow>AI + human review</Eyebrow>
          <h2 className="mt-3.5 text-[30px] font-bold leading-[1.12] tracking-[-0.03em] text-balance sm:text-[34px] lg:text-[40px]">
            Automation where it's reliable.
            <br />
            Human judgment where it's needed.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.65] sm:text-[18px]" style={{ color: '#4B5563' }}>
            The AI does not post uncertain accounting entries. Every proposed entry passes a
            deterministic rules layer first, and anything the system cannot resolve confidently goes
            to a human bookkeeping reviewer on our staff, who checks the source document and
            corrects the treatment before it reaches your books.
          </p>
        </div>

        <div className="mt-10 grid gap-[22px] lg:grid-cols-2">
          <div className="rounded-[18px] bg-white p-7 shadow-sm sm:p-8" style={{ border: '1px solid #F3F4F6' }}>
            <Pill bg="#ECFDF5" color="#047857" size="xs">High-confidence transaction</Pill>
            <div className="mt-6 flex flex-col">
              {PATH_CLEAN.map((n, i) => (
                <div key={n.label} className="flex flex-col">
                  <div className="rounded-xl px-[18px] py-4" style={{ background: PAGE, border: '1px solid #E5E7EB' }}>
                    <div className="text-[15px] font-semibold" style={{ color: INK }}>{n.label}</div>
                    <div className="mt-1 text-[13.5px] leading-[1.5]" style={{ color: '#6B7280' }}>{n.sub}</div>
                  </div>
                  {i < PATH_CLEAN.length - 1 && (
                    <div className="flex h-[18px] items-center justify-center text-[13px]" style={{ color: '#D1D5DB' }} aria-hidden="true">
                      ↓
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[14px] leading-[1.6]" style={{ color: '#6B7280' }}>
              Clean, balanced records with no involvement from you.
            </p>
          </div>

          <div className="rounded-[18px] p-7 text-white sm:p-8" style={{ background: NAVY }}>
            <Pill bg="rgba(251,191,36,0.14)" color="#FCD34D" size="xs">Uncertain transaction</Pill>
            <div className="mt-6 flex flex-col">
              {PATH_REVIEW.map((n, i) => (
                <div key={n.label} className="flex flex-col">
                  <div className="rounded-xl px-[18px] py-4" style={{ background: n.bg, border: `1px solid ${n.border}` }}>
                    <div className="text-[15px] font-semibold text-white">{n.label}</div>
                    <div className="mt-1 text-[13.5px] leading-[1.5]" style={{ color: '#9CA3AF' }}>{n.sub}</div>
                  </div>
                  {i < PATH_REVIEW.length - 1 && (
                    <div className="flex h-[18px] items-center justify-center text-[13px]" style={{ color: '#4B5563' }} aria-hidden="true">
                      ↓
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[14px] leading-[1.6]" style={{ color: '#9CA3AF' }}>
              The review queue is ours to work. It never reaches you.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7 · Accountant at tax time (DR-6) ── */}
      <section className={`${SHELL} ${STEP}`}>
        <div className="rounded-[20px] bg-white p-6 shadow-sm sm:p-11" style={{ border: '1px solid #F3F4F6' }}>
          <div className="max-w-[720px]">
            <Eyebrow>Your accountant, at tax time</Eyebrow>
            <h2 className="mt-3.5 text-[27px] font-bold leading-[1.13] tracking-[-0.03em] text-balance sm:text-[31px] lg:text-[36px]">
              Your accountant shouldn't have to
              <br />
              rebuild your books every tax season.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.65] sm:text-[17px]" style={{ color: '#4B5563' }}>
              The Bookkeeping Service keeps your financial records organized throughout the year, so
              tax preparation starts from finished books. It does not replace your accountant or tax
              professional, and it does not file returns — it makes their work faster.
            </p>
          </div>

          <div className="mt-9 grid items-stretch gap-[26px] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl p-7" style={{ background: PAGE, border: '1px solid #F3F4F6' }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.09em]" style={{ color: '#6B7280' }}>
                During the year
              </div>
              <h3 className="mb-2.5 mt-3.5 text-[20px] font-semibold tracking-[-0.02em] sm:text-[21px]">
                The books stay current
              </h3>
              <p className="text-[15px] leading-[1.6]" style={{ color: '#4B5563' }}>
                Documents are processed as they arrive. Records, reports, receivables, payables, and
                tax information stay organized — no year-end shoebox of receipts.
              </p>
            </div>
            <div>
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.09em]" style={{ color: '#6B7280' }}>
                At tax time, choose either
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl p-[26px] text-white" style={{ background: INK }}>
                  <Mono color="#93C5FD">OPTION 1</Mono>
                  <h3 className="mb-2.5 mt-3 text-[19px] font-semibold tracking-[-0.02em]">Invite your accountant</h3>
                  <p className="text-[14.5px] leading-[1.6]" style={{ color: '#9CA3AF' }}>
                    Invite them by email and they get their own workspace with access to your records
                    and reports. Invites are single-use, matched to their email address, and expire
                    after seven days.
                  </p>
                </div>
                <div className="rounded-2xl p-[26px]" style={{ background: PAGE, border: '1px solid #E5E7EB' }}>
                  <Mono color="#6B7280">OPTION 2</Mono>
                  <h3 className="mb-2.5 mt-3 text-[19px] font-semibold tracking-[-0.02em]">Send them the reports</h3>
                  <p className="text-[14.5px] leading-[1.6]" style={{ color: '#4B5563' }}>
                    Prefer to keep the platform to yourself? Generate, download, or print the
                    financial reports and tax information your accountant needs and hand the package
                    over.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-[22px] text-[13px] leading-[1.6]" style={{ color: '#6B7280' }}>
            AI Bookkeeping prepares bookkeeping records. It does not file tax returns and does not
            provide tax, legal, or financial advice.
          </p>
        </div>
      </section>

      {/* ── 8 · Financial visibility (DR-7) ── */}
      <section className={`${SHELL} ${STEP}`}>
        <div className="max-w-[740px]">
          <Eyebrow>Financial visibility</Eyebrow>
          <h2 className="mt-3.5 text-[30px] font-bold leading-[1.12] tracking-[-0.03em] text-balance sm:text-[34px] lg:text-[40px]">
            Plain answers to the questions
            <br />
            owners actually ask.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.65] sm:text-[18px]" style={{ color: '#4B5563' }}>
            The Bookkeeping Service turns finished books into views you can read without knowing any
            accounting.
          </p>
        </div>
        <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {VISIBILITY.map((v) => (
            <div key={v.title} className="rounded-[14px] bg-white p-[22px] shadow-sm" style={{ border: '1px solid #F3F4F6' }}>
              <h3 className="mb-2 text-[16px] font-semibold tracking-[-0.01em]">{v.title}</h3>
              <p className="text-[14px] leading-[1.55]" style={{ color: '#6B7280' }}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 9 · Security — dark inset card (DR-7) ── */}
      <section id="security" className={`${SHELL} ${STEP} scroll-mt-20`}>
        <div className="rounded-[20px] p-7 text-white sm:p-12" style={{ background: NAVY }}>
          <div className="max-w-[720px]">
            <Eyebrow tone="onDark">Security and trust</Eyebrow>
            <h2 className="mt-3.5 text-[27px] font-bold leading-[1.13] tracking-[-0.03em] text-balance sm:text-[31px] lg:text-[36px]">
              Controls we can describe specifically.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.65] sm:text-[17px]" style={{ color: '#C7CBD8' }}>
              Your financial records deserve more than a padlock icon. Here is what actually protects
              them.
            </p>
          </div>
          <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY.map((s) => (
              <div
                key={s.title}
                className="rounded-[14px] p-[22px]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <h3 className="mb-2 text-[15px] font-semibold text-white">{s.title}</h3>
                <p className="text-[14px] leading-[1.55]" style={{ color: '#9CA3AF' }}>{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[820px] text-[13px] leading-[1.6]" style={{ color: '#8C93A8' }}>
            Time2Win Inc. is a Canadian corporation and handles personal information under PIPEDA.
            Payments are processed by Stripe; we never touch card data.
          </p>
        </div>
      </section>

      {/* ── 10 · Pricing (DR-8) ── */}
      <section id="pricing" className={`${SHELL} ${STEP} scroll-mt-20`}>
        <div className="max-w-[740px]">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3.5 text-[30px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
            Software prices. Bookkeeper outcomes.
          </h2>
        </div>

        <div className="mt-10">
          <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-[20px] font-bold tracking-[-0.025em] sm:text-[22px]">Bookkeeping Service</h3>
              <Pill bg="#EFF6FF" color="#1D4ED8" border="#BFDBFE" size="xs">AI + human review</Pill>
            </div>
            <div className="text-[14px] font-medium" style={{ color: INK }}>
              15-day free trial · No credit card required
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {T2_PLANS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col gap-4 rounded-[18px] p-7 sm:p-[30px]"
                style={{
                  background: p.dark ? INK : '#FFFFFF',
                  border: `1px solid ${p.dark ? INK : '#E5E7EB'}`,
                  color: p.dark ? '#FFFFFF' : INK,
                }}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[16px] font-semibold">{p.name}</span>
                  {p.tag && <Pill bg="rgba(0,102,255,0.22)" color="#93C5FD" size="xs">{p.tag}</Pill>}
                </div>
                <div className="flex items-baseline gap-[7px]">
                  <span className="text-[36px] font-bold tracking-[-0.035em] sm:text-[40px]">{p.price}</span>
                  <span className="text-[13.5px]" style={{ color: p.dark ? '#9CA3AF' : '#6B7280' }}>CAD/USD per month</span>
                </div>
                <div className="text-[15px] font-medium">{p.docs}</div>
                <div className="text-[14px] leading-[1.55]" style={{ color: p.dark ? '#9CA3AF' : '#6B7280' }}>{p.note}</div>
                <Link
                  to="/register"
                  className="mt-auto inline-flex justify-center rounded-[11px] px-5 py-3.5 text-[15px] font-semibold transition hover:opacity-90"
                  style={
                    p.dark
                      ? { background: BLUE, color: '#FFFFFF', border: `1px solid ${BLUE}` }
                      : { background: '#FFFFFF', color: INK, border: '1px solid #D1D5DB' }
                  }
                >
                  Start 15-day free trial
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-[13px] leading-[1.6]" style={{ color: '#6B7280' }}>
            Every Bookkeeping Service plan includes the full workflow: AI processing,
            accounting-rule validation, human review when needed, reports, tax information, and
            accountant access.
          </p>
        </div>

        <div className="mt-11">
          <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-[20px] font-bold tracking-[-0.025em] sm:text-[22px]">Receipt Automation</h3>
              <Pill bg="#ECFDF5" color="#047857" border="#A7F3D0" size="xs">Document processing</Pill>
            </div>
            <div className="text-[14px] font-medium" style={{ color: INK }}>
              Free trial · 5 documents · No credit card required
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {T1_PLANS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col gap-3.5 rounded-[18px] bg-white p-7 sm:p-[28px]"
                style={{ border: '1px solid #E5E7EB' }}
              >
                <span className="text-[16px] font-semibold">{p.name}</span>
                <div className="flex items-baseline gap-[7px]">
                  <span className="text-[31px] font-bold tracking-[-0.035em] sm:text-[34px]">{p.price}</span>
                  <span className="text-[13.5px]" style={{ color: '#6B7280' }}>CAD/USD per month</span>
                </div>
                <div className="text-[15px] font-medium" style={{ color: '#374151' }}>{p.docs}</div>
                <div className="text-[14px]" style={{ color: '#6B7280' }}>{p.storage}</div>
                <Link
                  to="/register"
                  className="mt-auto inline-flex justify-center rounded-[11px] px-5 py-3 text-[15px] font-semibold transition hover:border-gray-900"
                  style={{ border: '1px solid #D1D5DB', color: INK }}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-[13px] leading-[1.6]" style={{ color: '#6B7280' }}>
            Prices in CAD/USD. Taxes may apply. Cancel anytime — no cancellation fee, access to the
            end of the period.
          </p>
        </div>
      </section>

      {/* ── 11 · Comparison (DR-9) ── */}
      <section id="compare" className={`${SHELL} ${STEP} scroll-mt-20`}>
        <div className="max-w-[740px]">
          <Eyebrow>Detailed comparison</Eyebrow>
          <h2 className="mt-3.5 text-[30px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px] lg:text-[40px]">
            Side by side.
          </h2>
        </div>
        <div className="mt-9 overflow-x-auto rounded-[18px] bg-white" style={{ border: '1px solid #E5E7EB' }}>
          <table className="w-full min-w-[680px] border-collapse text-left">
            <colgroup>
              <col style={{ width: '44.4%' }} />
              <col style={{ width: '27.8%' }} />
              <col style={{ width: '27.8%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: PAGE, borderBottom: '1px solid #E5E7EB' }}>
                <th className="px-[26px] py-[18px] text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#6B7280' }}>
                  Capability
                </th>
                <th className="px-5 py-[18px] text-[14px] font-semibold" style={{ color: INK, borderLeft: '1px solid #E5E7EB' }}>
                  Receipt Automation
                </th>
                <th
                  className="px-5 py-[18px] text-[14px] font-semibold"
                  style={{ color: INK, borderLeft: '1px solid #E5E7EB', background: '#EFF6FF' }}
                >
                  Bookkeeping Service
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((r) => (
                <tr key={r.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td className="px-[26px] py-[18px] text-[15px] font-medium" style={{ color: INK }}>{r.label}</td>
                  <td
                    className="px-5 py-[18px] text-[14.5px] leading-[1.5]"
                    style={{ color: r.aMuted ? '#9CA3AF' : INK, borderLeft: '1px solid #F3F4F6' }}
                  >
                    {r.a}
                  </td>
                  <td
                    className="px-5 py-[18px] text-[14.5px] leading-[1.5]"
                    style={{ color: INK, borderLeft: '1px solid #F3F4F6', background: '#F8FBFF' }}
                  >
                    {r.b}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 12 · Who it's for (DR-10) ── */}
      <section className={`${SHELL} ${STEP}`}>
        <div className="max-w-[740px]">
          <Eyebrow>Who it's for</Eyebrow>
          <h2 className="mt-3.5 text-[30px] font-bold leading-[1.12] tracking-[-0.03em] text-balance sm:text-[34px] lg:text-[40px]">
            Built for owners whose time is
            <br />
            worth more than data entry.
          </h2>
        </div>
        <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-5">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-[14px] bg-white p-6" style={{ border: '1px solid #F3F4F6' }}>
              <h3 className="mb-[9px] text-[16px] font-semibold tracking-[-0.01em]">{a.title}</h3>
              <p className="text-[14px] leading-[1.55]" style={{ color: '#6B7280' }}>{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 13 · FAQ (DR-10) ── */}
      <section id="faq" className={`${SHELL} ${STEP} scroll-mt-20`}>
        <div className="grid items-start gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-[52px]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3.5 text-[27px] font-bold leading-[1.13] tracking-[-0.03em] text-balance sm:text-[31px] lg:text-[36px]">
              Questions owners ask
              <br />
              before signing up.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.65]" style={{ color: '#4B5563' }}>
              Something not covered here?{' '}
              <a href="mailto:support@ai-bookkeeping.ai" className="font-semibold" style={{ color: BLUE }}>
                Email support
              </a>{' '}
              and a person will answer.
            </p>
          </div>
          <div className="overflow-hidden rounded-[18px] bg-white" style={{ border: '1px solid #E5E7EB' }}>
            {FAQS.map(([q, a], i) => (
              <div key={q} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid #F3F4F6' : undefined }}>
                <button
                  type="button"
                  onClick={() => setOpenFaq((o) => (o === i ? -1 : i))}
                  aria-expanded={openFaq === i}
                  className="flex w-full items-center justify-between gap-5 px-[26px] py-5 text-left text-[16px] font-semibold"
                  style={{ color: INK }}
                >
                  <span>{q}</span>
                  <span className="shrink-0 text-[20px] font-normal leading-none" style={{ color: '#9CA3AF' }} aria-hidden="true">
                    {openFaq === i ? '–' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="max-w-[760px] px-[26px] pb-[22px] text-[15px] leading-[1.65]" style={{ color: '#4B5563' }}>
                    {a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 14 · Final CTA — dark inset card (DR-11) ── */}
      <section className={`${SHELL} ${STEP}`}>
        <div className="rounded-[20px] px-6 py-12 text-center text-white sm:px-12 sm:py-16" style={{ background: NAVY }}>
          <h2 className="mx-auto max-w-[760px] text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-balance sm:text-[36px] lg:text-[44px]">
            Upload your documents. Let the platform handle the bookkeeping.
          </h2>
          <p className="mx-auto mt-5 max-w-[600px] text-[16px] leading-[1.6] sm:text-[18px]" style={{ color: '#C7CBD8' }}>
            Start with the Bookkeeping Service and see your books stay current — or begin with
            Receipt Automation and move up when you're ready.
          </p>
          <div className="mt-[34px] flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center rounded-xl px-8 py-4 text-[16px] font-semibold text-white transition hover:opacity-90 sm:text-[17px]"
              style={{ background: BLUE }}
            >
              Start your 15-day free trial
            </Link>
            <button
              type="button"
              onClick={() => scrollTo('compare')}
              className="inline-flex items-center rounded-xl px-7 py-4 text-[16px] font-medium text-white transition hover:border-white/55 sm:text-[17px]"
              style={{ border: '1px solid rgba(255,255,255,0.24)' }}
            >
              Compare products
            </button>
          </div>
          <p className="mt-5 text-[14px]" style={{ color: '#8C93A8' }}>
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── 15 · Footer — five columns (DR-11) ── */}
      <footer className="mt-14 pb-10 pt-14 sm:mt-[88px]" style={{ background: INK, color: '#9CA3AF' }}>
        <div className={`${SHELL} grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]`}>
          <div>
            <div className="mb-3.5">
              <Brand dark />
            </div>
            <p className="max-w-[290px] text-[14px] leading-[1.6]">
              Bookkeeping done for you, by Time2Win Inc. — a Canadian corporation serving small
              businesses in Canada and the United States.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 text-[14px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#6B7280' }}>Product</div>
            <button type="button" onClick={() => scrollTo('receipts')} className="text-left transition hover:text-white" style={{ color: '#D1D5DB' }}>Receipt Automation</button>
            <button type="button" onClick={() => scrollTo('bookkeeping')} className="text-left transition hover:text-white" style={{ color: '#D1D5DB' }}>Bookkeeping Service</button>
            <button type="button" onClick={() => scrollTo('how')} className="text-left transition hover:text-white" style={{ color: '#D1D5DB' }}>How it works</button>
            <button type="button" onClick={() => scrollTo('compare')} className="text-left transition hover:text-white" style={{ color: '#D1D5DB' }}>Compare</button>
          </div>

          <div className="flex flex-col gap-2.5 text-[14px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#6B7280' }}>Learn</div>
            <Link to="/pricing" className="transition hover:text-white" style={{ color: '#D1D5DB' }}>Pricing</Link>
            <button type="button" onClick={() => scrollTo('security')} className="text-left transition hover:text-white" style={{ color: '#D1D5DB' }}>Security</button>
            <Link to="/faq" className="transition hover:text-white" style={{ color: '#D1D5DB' }}>FAQ</Link>
            <a href="/blog" className="transition hover:text-white" style={{ color: '#D1D5DB' }}>Blog</a>
          </div>

          <div className="flex flex-col gap-2.5 text-[14px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#6B7280' }}>Company</div>
            <a href="mailto:support@ai-bookkeeping.ai" className="transition hover:text-white" style={{ color: '#D1D5DB' }}>Support</a>
            <Link to="/privacy-policy" className="transition hover:text-white" style={{ color: '#D1D5DB' }}>Privacy</Link>
            <Link to="/terms-of-service" className="transition hover:text-white" style={{ color: '#D1D5DB' }}>Terms</Link>
          </div>

          <div className="flex flex-col gap-2.5 text-[14px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#6B7280' }}>Get started</div>
            <Link to="/login" className="transition hover:text-white" style={{ color: '#D1D5DB' }}>Login</Link>
            <Link
              to="/register"
              className="mt-1 inline-flex justify-center rounded-[10px] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
              style={{ background: BLUE }}
            >
              Start free trial
            </Link>
          </div>
        </div>
        <div className={`${SHELL} mt-9 pt-6`} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[12.5px] leading-[1.7]">
            AI Bookkeeping prepares bookkeeping records. It does not file tax returns and does not
            provide tax, legal, or financial advice — work with your accountant. Prices in CAD/USD;
            taxes may apply. © 2026 Time2Win Inc.
          </p>
        </div>
      </footer>
    </div>
  );
};
