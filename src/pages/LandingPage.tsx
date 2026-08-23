// Public homepage (S32 C2 — full rebuild to the approved prototype).
//
// Copy rulings in force:
//   O-S32-1(a) — canonical Tier 1 trial line is "Free trial — 5 documents
//                included, no credit card required". No trial DURATION is
//                stated for Tier 1: the backend has no time-based trial gate,
//                so the document count is the only honest limit to quote.
//   O-S32-2    — security is stated as structural properties, never as a
//                borrowed-authority adjective.
//   O-S31-M1   — no Tier 1 human-review claim. Every reviewer statement here is
//                tagged Advanced / in development.
//   O-S31-M2   — no instruction to send in bank or card statements anywhere.
// Advanced pricing is never published; Tier 1 ($29 CAD/month) is.
//
// The waitlist form is the shared component (components/marketing/WaitlistForm)
// rather than a fourth local copy.
import { type FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logoSvg from '@/assets/logo.svg';
import advancedPreview from '@/assets/advanced-preview.webp';
import { WaitlistForm } from '@/components/marketing/WaitlistForm';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const NAVY = '#1A1F36';
const SKY = '#93C5FD';

const PAGE_TITLE = 'AI Bookkeeping — You run the business. We keep the books.';

// ─── Content ──────────────────────────────────────────────────────────────────

// `external: true` = served outside the SPA (Django-rendered), so it must be a
// plain anchor and a real navigation, never a react-router Link (O-S46-11).
const NAV_LINKS: { label: string; to: string; hash?: boolean; external?: boolean }[] = [
  { label: 'Advanced', to: 'advanced', hash: true },
  { label: 'How it works', to: 'how', hash: true },
  { label: 'Available today', to: 'today', hash: true },
  { label: 'Plans', to: 'pricing', hash: true },
  { label: 'Blog', to: '/blog', external: true },
  { label: 'FAQ', to: '/faq' },
];

const DIY_LIST = [
  'You categorize every transaction.',
  'You maintain the vendor and customer lists.',
  'You decide what a credit-card payment was for.',
  'Mistakes surface at year end, when they are expensive.',
];

const ADVANCED_LIST = [
  'Entries are drafted, validated, and posted for you.',
  'Supplier and client records are maintained by our staff.',
  'Card payments post as settlements, not double-counted expenses.',
  'Anything uncertain routes to an internal reviewer.',
];

const MECHANISM = [
  {
    n: '01',
    tag: 'Flexible',
    title: 'AI intelligence',
    body: 'Reads receipts, invoices, and connected bank transactions, then proposes a balanced entry with a confidence score.',
  },
  {
    n: '02',
    tag: 'Strict',
    title: 'Accounting rules',
    body: 'Deterministic code, not a model. Debits must equal credits. Anything that fails a check does not post.',
  },
  {
    n: '03',
    tag: 'Immutable',
    title: 'Ledger engine',
    body: 'Append-only. Balances are derived, never typed. Corrections post as new, linked, visible entries.',
  },
];

const ROUTING: { trigger: string; outcome: string }[] = [
  { trigger: 'Large-value entry', outcome: 'Human review' },
  { trigger: 'AI confidence is low', outcome: 'Escalated, then human review' },
  { trigger: 'Suspected duplicate', outcome: 'Reviewer sees both' },
  { trigger: 'Dated inside a closed period', outcome: 'Human review' },
  { trigger: 'Confident and all checks pass', outcome: 'Posted' },
];

const CAPABILITIES = [
  {
    title: 'Bank and card connections',
    body: 'Transactions arrive automatically through Plaid — we never see your bank credentials.',
  },
  {
    title: 'Real double-entry books',
    body: 'A true ledger with journal entries behind every number, not a categorized list of expenses.',
  },
  {
    title: 'Financial statements',
    body: 'Profit and Loss, Balance Sheet, and tax summaries generated from the ledger itself.',
  },
  {
    title: 'Jurisdiction-aware tax handling',
    body: 'Canadian organizations get GST/HST registration status, input tax credits, and filing deadlines. US organizations receive US-appropriate treatment.',
  },
  {
    title: 'Internal human review',
    body: 'Trained reviewers on our own staff work the pending queue. The queue never reaches you.',
  },
  {
    title: 'Your accountant, invited',
    body: 'Give your accountant their own workspace with the access they need, and nothing more.',
  },
];

const MESSY = [
  {
    title: 'Paid with a personal card',
    body: 'It still belongs in the books. The entry records what the business owes you, instead of quietly disappearing.',
  },
  {
    title: 'Credit-card payments',
    body: 'A payment to your card is money moving between your own accounts — a settlement, not an expense. Booking it twice is one of the most common ways small-business books go wrong.',
  },
  {
    title: "Receipt hasn't arrived yet",
    body: 'The transaction is recorded and reconciled now, and waits for its document. Nothing sits in a shoebox until year end.',
  },
];

const TODAY_CARDS = [
  {
    title: 'Snap or send',
    body: 'Photograph a receipt in the web app or send it to our Telegram bot. JPEG, PNG, WebP, HEIC, and PDF are all accepted.',
  },
  {
    title: 'AI extraction',
    body: 'Vendor, date, total, and tax are read from the image — no typing, no spreadsheet template.',
  },
  {
    title: 'Smart categorization',
    body: 'Each expense is sorted into a category aligned to CRA expense categories.',
  },
  {
    title: 'GST/HST ITC tracking',
    body: 'Recoverable tax is tracked separately so input tax credits are ready when you file.',
  },
  {
    title: 'Reports and Excel',
    body: 'Expense reports and a clean annual workbook your accountant can open without cleanup.',
  },
  {
    title: 'Full manual control',
    body: 'Every extracted field stays editable. You can correct anything the AI got wrong.',
  },
];

const ADVANCED_INCLUDES = [
  'Bank and card connections with reconciliation',
  'Real double-entry ledger with an immutable audit trail',
  'Profit and Loss, Balance Sheet, and tax reports',
  'Internal reviewers resolve entries requiring human judgment',
  'Clients and suppliers maintained by our staff',
  'Accountant workspace and close workflow',
];

const WAITLIST_BENEFITS = [
  'Early access when the private beta opens.',
  'A 15-day free trial when Advanced launches — no credit card required.',
  'Pricing announced to waitlist members first.',
  'No commitment; unsubscribe anytime.',
];

const TRUST = [
  {
    title: 'Private storage',
    body: 'Documents are stored privately and reached through expiring signed links. There are no public file URLs.',
  },
  {
    title: 'Tenant isolation',
    body: "Every organization's data is walled off, and the permission rules are covered by deny-path tests.",
  },
  {
    title: 'Immutable history',
    body: 'Financial actions are recorded in an append-only audit log. Nothing is silently edited or deleted.',
  },
  {
    title: 'Canadian, PIPEDA-governed',
    body: 'Payments run through Stripe — we never touch card data. Your data is erased when you delete your account.',
  },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

const InDevPill: FC = () => (
  <span className="inline-flex items-center rounded-full bg-[#0066FF]/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[#0066FF]">
    In development
  </span>
);

const SectionHeading: FC<{ eyebrow?: string; title: string; sub?: string; dark?: boolean }> = ({
  eyebrow, title, sub, dark,
}) => (
  <div className="max-w-3xl">
    {eyebrow && (
      <p className={`font-mono text-xs uppercase tracking-[0.18em] ${dark ? 'text-white/40' : 'text-gray-400'}`}>
        {eyebrow}
      </p>
    )}
    <h2 className={`mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-gray-900'}`}>
      {title}
    </h2>
    {sub && (
      <p className={`mt-4 text-base leading-relaxed sm:text-lg ${dark ? 'text-white/60' : 'text-gray-600'}`}>
        {sub}
      </p>
    )}
  </div>
);

const Check: FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
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
    return () => { document.title = previous; };
  }, []);

  // JSON-LD — same inject-on-mount / remove-on-unmount pattern as before.
  // Offers list Tier 1 ONLY: Advanced pricing is never published. No logo
  // reference (that asset does not exist yet; C4 owns assets).
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
        'Bookkeeping done for you. Receipt automation is available today; Advanced — bank connections, double-entry books, financial statements, and internal human review — is in development.',
      offers: [
        { '@type': 'Offer', name: 'Starter', price: '29', priceCurrency: 'CAD' },
        { '@type': 'Offer', name: 'Growth', price: '49', priceCurrency: 'CAD' },
        { '@type': 'Offer', name: 'Pro', price: '69', priceCurrency: 'CAD' },
      ],
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // NOTE: Organization JSON-LD is NOT injected here. It lives statically in
  // index.html (S32 C4) so crawlers see it without executing JS, and so exactly
  // one Organization node exists site-wide.

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-gray-900">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-[#F9FAFB]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* F-S32-11: logo.svg already contains the "AI BOOKKEEPING" wordmark,
              so no text label sits beside it. alt carries the accessible name
              that the removed span used to provide. */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoSvg} alt="AI Bookkeeping" className="h-7 w-auto" />
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-amber-700">
              Beta
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((l) =>
              l.hash ? (
                <button
                  key={l.to}
                  type="button"
                  onClick={() => scrollTo(l.to)}
                  className="text-[14px] text-gray-600 transition hover:text-gray-900"
                >
                  {l.label}
                </button>
              ) : l.external ? (
                <a key={l.to} href={l.to} className="text-[14px] text-gray-600 transition hover:text-gray-900">
                  {l.label}
                </a>
              ) : (
                <Link key={l.to} to={l.to} className="text-[14px] text-gray-600 transition hover:text-gray-900">
                  {l.label}
                </Link>
              ),
            )}
            <Link to="/login" className="text-[14px] text-gray-600 transition hover:text-gray-900">
              Log in
            </Link>
            <button
              type="button"
              onClick={() => scrollTo('waitlist')}
              className="rounded-full bg-[#0066FF] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-[#0052cc]"
            >
              Join the waitlist
            </button>
          </nav>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden"
          >
            <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5'} />
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-[#F9FAFB] px-6 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((l) =>
                l.hash ? (
                  <button
                    key={l.to}
                    type="button"
                    onClick={() => scrollTo(l.to)}
                    className="py-2 text-left text-[15px] text-gray-700"
                  >
                    {l.label}
                  </button>
                ) : l.external ? (
                  <a
                    key={l.to}
                    href={l.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2 text-[15px] text-gray-700"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2 text-[15px] text-gray-700"
                  >
                    {l.label}
                  </Link>
                ),
              )}
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="py-2 text-[15px] text-gray-700">
                Log in
              </Link>
              <button
                type="button"
                onClick={() => scrollTo('waitlist')}
                className="mt-2 rounded-full bg-[#0066FF] px-4 py-2.5 text-[14px] font-semibold text-white"
              >
                Join the waitlist
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: NAVY }} className="text-white">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/70">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SKY }} />
              Advanced — In Development
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              You run the business.
              <br />
              <span style={{ color: SKY }}>We keep the books.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              AI Bookkeeping is building the end of DIY bookkeeping: bank connections, real
              double-entry books, financial statements, and trained reviewers on our own staff who
              resolve anything the AI isn't sure about. You never categorize a transaction.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => scrollTo('waitlist')}
                className="rounded-xl bg-[#0066FF] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0052cc]"
              >
                Join the Advanced waitlist
              </button>
              <button
                type="button"
                onClick={() => scrollTo('today')}
                className="rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white/90 transition hover:border-white/40 hover:bg-white/5"
              >
                Use receipt automation today
              </button>
            </div>

            <p className="mt-6 text-[13px] leading-relaxed text-white/45">
              Advanced is in development and not yet purchasable. Receipt automation is live today
              from $29 CAD/month.
            </p>
          </div>

          {/* Browser-chrome frame around the Advanced preview (C7). The image
              shows a DEMONSTRATION organization with fictional figures — the
              disclosure below the frame is load-bearing and must travel with
              it. aspect-[7/4] + object-top crops the empty space below the
              dashboard's last row rather than letterboxing it. */}
          <div>
            <div className="rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
              <div className="overflow-hidden rounded-xl bg-[#0f1424]">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="ml-3 font-mono text-[10px] text-white/30">ai-bookkeeping.ai</span>
                </div>
                <img
                  src={advancedPreview}
                  loading="lazy"
                  width={1120}
                  height={798}
                  alt="Preview of the AI Bookkeeping Advanced dashboard — demonstration organization"
                  className="block aspect-[7/4] w-full object-cover object-top"
                />
              </div>
            </div>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-white/35">
              Advanced private-beta preview — in development. Figures shown are from a
              demonstration organization.
            </p>
          </div>
        </div>
      </section>

      {/* ── Live banner ───────────────────────────────────────────────────── */}
      <div className="border-y border-white/10 bg-[#141829]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-white/70">
            <span className="font-semibold text-white">Live today:</span> Receipt automation is
            available today on Starter, Growth, and Pro plans.
          </p>
          <button
            type="button"
            onClick={() => scrollTo('today')}
            className="text-left font-medium text-[#93C5FD] transition hover:text-white"
          >
            Free trial — 5 documents included, no credit card →
          </button>
        </div>
      </div>

      {/* ── #advanced ─────────────────────────────────────────────────────── */}
      <section id="advanced" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="The end of DIY bookkeeping"
          title="Most bookkeeping software still hands the hard part back to you."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-8 ring-1 ring-gray-200">
            <p className="font-mono text-xs uppercase tracking-wider text-gray-400">Do-it-yourself software</p>
            <ul className="mt-5 space-y-3.5">
              {DIY_LIST.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-gray-600">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-8 ring-1 ring-[#0066FF]/25">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="font-mono text-xs uppercase tracking-wider text-[#0066FF]">Advanced</p>
              <InDevPill />
            </div>
            <ul className="mt-5 space-y-3.5">
              {ADVANCED_LIST.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-gray-700">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[#0066FF]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── #how ──────────────────────────────────────────────────────────── */}
      <section id="how" className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading
            eyebrow="The mechanism"
            title="AI drafts. Accounting rules decide. The ledger records."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {MECHANISM.map((m) => (
              <div key={m.n} className="rounded-2xl bg-[#F9FAFB] p-7 ring-1 ring-gray-200">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-2xl font-medium text-[#0066FF]">{m.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">{m.tag}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{m.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-gray-600">{m.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl ring-1 ring-gray-200">
            <div className="bg-[#F9FAFB] px-7 py-6">
              <h3 className="text-lg font-semibold text-gray-900">
                The AI is built to say "I'm not sure."
              </h3>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-gray-600">
                Confidence is not a marketing word here — it is a number the rules layer acts on.
                These are the conditions that take an entry away from the machine.
              </p>
            </div>
            <div className="divide-y divide-gray-100 bg-white">
              {ROUTING.map((r) => (
                <div key={r.trigger} className="flex flex-col gap-1 px-7 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[14.5px] text-gray-700">{r.trigger}</span>
                  <span className="font-mono text-[12.5px] text-[#0066FF]">{r.outcome}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#0066FF]/[0.06] px-7 py-5">
              <p className="text-[14.5px] font-medium text-gray-800">
                The pending queue never reaches the customer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="What the waitlist is for"
          title="Everything below is being built for the Advanced plan."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="rounded-2xl bg-white p-7 ring-1 ring-gray-200">
              <InDevPill />
              <h3 className="mt-4 text-[17px] font-semibold text-gray-900">{c.title}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-gray-600">{c.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-[13px] leading-relaxed text-gray-500">
          Every capability on this page is in development on the Advanced plan and is not available
          to purchase today.
        </p>
      </section>

      {/* ── Messy reality ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div style={{ backgroundColor: NAVY }} className="rounded-2xl px-8 py-14 text-white sm:px-12">
          <SectionHeading
            dark
            eyebrow="Real books are messy"
            title="The awkward cases are the whole job."
          />
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {MESSY.map((m) => (
              <div key={m.title}>
                <h3 className="text-[16px] font-semibold" style={{ color: SKY }}>{m.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/65">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── #today (also carries the legacy #features anchor) ─────────────── */}
      {/* #features is an alias target — external links and existing blog copy
          point at it, so it must keep resolving. */}
      <div id="features" aria-hidden="true" />
      <section id="today" className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading
            eyebrow="Live today"
            title="While Advanced is being built, receipts are already handled."
            sub="Receipt automation is a shipped, paid product with real customers. It is the part of the job you feel every week."
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/register"
              className="rounded-xl bg-[#0066FF] px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-[#0052cc]"
            >
              Start your free trial
            </Link>
            <p className="text-[13px] leading-relaxed text-gray-500">
              Free trial — 5 documents included, no credit card required. Plans from $29 CAD/month.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {TODAY_CARDS.map((c) => (
              <div key={c.title} className="rounded-2xl bg-[#F9FAFB] p-7 ring-1 ring-gray-200">
                <h3 className="text-[17px] font-semibold text-gray-900">{c.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-gray-600">{c.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-[13px] leading-relaxed text-gray-500">
            Today's plans cover expense receipts. Invoices, bills, bank transactions, journal
            entries, and financial statements are part of Advanced, in development.
          </p>
        </div>
      </section>

      {/* ── #pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="Plans"
          title="Software prices. Bookkeeper outcomes. Human accountability."
        />
        <p className="mt-5 inline-flex rounded-full bg-white px-3.5 py-1.5 text-[13px] text-gray-600 ring-1 ring-gray-200">
          Human accountability is part of Advanced — in development.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div style={{ backgroundColor: NAVY }} className="rounded-2xl p-8 text-white sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-bold">Advanced</h3>
              <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70">
                Coming soon
              </span>
            </div>
            <p className="mt-3 text-[14.5px] leading-relaxed text-white/60">
              Full bookkeeping, done for you — with our own staff accountable for what the AI
              cannot resolve.
            </p>

            <ul className="mt-7 space-y-3">
              {ADVANCED_INCLUDES.map((item) => (
                <li key={item} className="flex gap-3 text-[14.5px] leading-relaxed text-white/80">
                  <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: SKY }} />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 space-y-1.5 border-t border-white/10 pt-6">
              <p className="text-[14px] font-medium text-white">
                15-day free trial at launch — no credit card required.
              </p>
              <p className="text-[13px] text-white/50">
                Pricing announced at launch. Waitlist members hear first.
              </p>
            </div>

            <button
              type="button"
              onClick={() => scrollTo('waitlist')}
              className="mt-7 w-full rounded-xl bg-[#0066FF] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0052cc]"
            >
              Join the waitlist
            </button>
          </div>

          <div className="flex flex-col rounded-2xl bg-white p-8 ring-1 ring-gray-200 sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-bold text-gray-900">Receipt automation</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                Live today
              </span>
            </div>
            <p className="mt-3 text-[14.5px] leading-relaxed text-gray-600">
              Receipt automation is available today — Starter, Growth, and Pro plans from
              $29 CAD/month. Free trial — 5 documents included, no credit card required.
            </p>

            <div className="mt-auto pt-8">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="rounded-xl bg-[#0066FF] px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-[#0052cc]"
                >
                  Start free trial
                </Link>
                <Link
                  to="/pricing"
                  className="rounded-xl border border-gray-300 px-6 py-3.5 text-center text-sm font-semibold text-gray-700 transition hover:border-gray-400"
                >
                  View receipt-automation plans →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-[13px] leading-relaxed text-gray-500">
          Prices in CAD/USD. Taxes may apply. Cancel anytime — no cancellation fee, access to the
          end of the period.
        </p>
      </section>

      {/* ── #waitlist ─────────────────────────────────────────────────────── */}
      <section id="waitlist" className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div style={{ backgroundColor: NAVY }} className="rounded-2xl p-8 text-white sm:p-10">
              <SectionHeading dark eyebrow="Advanced waitlist" title="Be first when the books keep themselves." />
              <ul className="mt-8 space-y-4">
                {WAITLIST_BENEFITS.map((b) => (
                  <li key={b} className="flex gap-3 text-[14.5px] leading-relaxed text-white/75">
                    <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: SKY }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <WaitlistForm source="homepage" variant="inline" />
              <p className="mt-4 text-[13px] leading-relaxed text-gray-500">
                Advanced is in development and not yet purchasable. We'll never publish a launch
                date we can't keep — you'll hear it here first.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading eyebrow="Trust" title="Security that's structural, not promised." />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="rounded-2xl bg-white p-7 ring-1 ring-gray-200">
              <h3 className="text-[16px] font-semibold text-gray-900">{t.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-gray-600">{t.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-[13px] leading-relaxed text-gray-500">
          Formal security review program in place; independent assessment planned as the platform
          scales. AI Bookkeeping prepares books — it does not file returns and does not provide tax,
          legal, or financial advice. Work with your accountant.
        </p>
      </section>

      {/* ── Featured On (restored in C3) ──────────────────────────────────── */}
      {/* The human-visible directory badges. The JS-blind verifiers actually
          read the hidden static copies in index.html — these are for people. */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
            Featured on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://betalist.com/startups/ai-bookkeeping?utm_campaign=badge-ai-bookkeeping&utm_medium=badge&utm_source=badge-featured"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://betalist.com/badges/featured?id=170360&theme=color"
                alt="Featured on BetaList"
                className="h-11 w-auto"
              />
            </a>
            <a href="https://launchbuff.com" target="_blank" rel="noopener noreferrer" title="Featured on LaunchBuff">
              <img
                src="https://launchbuff.com/badge-featured-dark.svg"
                alt="Featured on LaunchBuff"
                className="h-11 w-auto"
              />
            </a>
            <a href="https://tools.cafe" target="_blank" rel="noopener noreferrer" title="Featured on tools.cafe">
              <img src="https://tools.cafe/b/dark.svg" alt="Featured on tools.cafe" className="h-11 w-auto" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: NAVY }} className="text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div>
              {/* F-S32-11: wordmark lives in the SVG — no duplicate text label. */}
              <img src={logoSvg} alt="AI Bookkeeping" className="h-7 w-auto" />
              <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-white/50">
                Bookkeeping done for you, by Time2Win Inc. — a Canadian corporation serving small
                businesses in Canada and the United States.
              </p>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">Product</p>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                <li><button type="button" onClick={() => scrollTo('advanced')} className="text-white/70 transition hover:text-white">Advanced</button></li>
                <li><button type="button" onClick={() => scrollTo('today')} className="text-white/70 transition hover:text-white">Available today</button></li>
                <li><button type="button" onClick={() => scrollTo('pricing')} className="text-white/70 transition hover:text-white">Plans</button></li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">Learn</p>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                <li><a href="/blog" className="text-white/70 transition hover:text-white">Blog</a></li>
                <li><Link to="/faq" className="text-white/70 transition hover:text-white">FAQ</Link></li>
                <li><button type="button" onClick={() => scrollTo('how')} className="text-white/70 transition hover:text-white">How it works</button></li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">Company</p>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                <li><a href="mailto:support@ai-bookkeeping.ai" className="text-white/70 transition hover:text-white">Contact</a></li>
                <li><Link to="/privacy-policy" className="text-white/70 transition hover:text-white">Privacy Policy</Link></li>
                <li><Link to="/terms-of-service" className="text-white/70 transition hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8">
            <p className="max-w-4xl text-[12.5px] leading-relaxed text-white/40">
              Advanced capabilities described on this page are in development and are not available
              for purchase. Receipt capture, AI extraction, categorization, GST/HST ITC reporting,
              reports, and Excel export are live today. © 2026 Time2Win Inc.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
