import { type FC, type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import logoSvg from '@/assets/logo.svg';

// ─── Data ─────────────────────────────────────────────────────────────────────

const SHARED_FEATURES = [
  'AI extraction & categorization',
  'Annual Excel workbook',
  'Expense & tax reports',
  'Telegram bot intake',
  'GST/HST ITC reports',
  'Email support',
] as const;

const ADVANCED_FEATURES = [
  'Everything in Pro',
  'Supplier invoice recording',
  'Supplier payment tracking',
  'Customer invoice recording',
  'Customer payment tracking',
  'Bank & credit card connection (via Plaid)',
  'Bank reconciliation',
  'Profit & Loss reports',
  'Accounts Payable balance',
  'Accounts Receivable balance',
  'Tax reports (CA & US)',
] as const;

const WAITLIST_FEATURES = [
  'Supplier invoice recording',
  'Supplier payment tracking',
  'Customer invoice recording',
  'Customer payment tracking',
  'Bank & credit card connection (via Plaid)',
  'Bank reconciliation',
  'Profit & Loss reports',
  'Accounts Payable balance',
  'Accounts Receivable balance',
  'Tax reports — Canada GST/HST',
  'Tax reports — US deductions',
] as const;

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    docs: '100 documents / month',
    storage: '1 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 49,
    docs: '300 documents / month',
    storage: '5 GB storage',
    features: SHARED_FEATURES,
    highlight: true,
    badge: 'Most popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 69,
    docs: '500 documents / month',
    storage: '20 GB storage',
    features: SHARED_FEATURES,
    highlight: false,
  },
] as const;

// ─── Waitlist modal ────────────────────────────────────────────────────────────

const WaitlistModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [email, setEmail]           = useState('');
  const [selected, setSelected]     = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');

  const toggleFeature = (f: string) =>
    setSelected((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/waitlist/', { email, features_wanted: selected });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Join the Advanced waitlist</h2>
              <p className="text-xs text-gray-400 mt-0.5">Be first to know when it launches.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {success ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-900 mb-1">You're on the list!</p>
                <p className="text-sm text-gray-500">We'll notify you when Advanced launches.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Which features matter most to you?</p>
                  <div className="space-y-2">
                    {WAITLIST_FEATURES.map((f) => (
                      <label key={f} className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selected.includes(f)}
                          onChange={() => toggleFeature(f)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF] cursor-pointer shrink-0"
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors leading-snug">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A1628] hover:bg-[#112040] disabled:opacity-60 py-3 text-sm font-semibold text-white transition-colors"
                >
                  {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {submitting ? 'Joining…' : 'Join Waitlist'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Shared check icon ─────────────────────────────────────────────────────────

const CheckIcon: FC = () => (
  <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

// ─── Landing page ──────────────────────────────────────────────────────────────

export const LandingPage: FC = () => {
  const [showWaitlist, setShowWaitlist]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <>
      <div className="min-h-screen bg-[#0f172a] text-white">

        {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

            {/* Logo + beta */}
            <div className="flex items-center gap-3">
              <img src={logoSvg} alt="AI Bookkeeping" className="h-7 w-auto" />
              <span className="bg-amber-500 text-white text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded">
                Beta
              </span>
            </div>

            {/* Center links (desktop) */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollTo('features')}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollTo('pricing')}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Pricing
              </button>
            </div>

            {/* Auth buttons (desktop) */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg border border-white/20 text-sm font-medium text-white hover:border-white/40 hover:bg-white/5 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-white transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Hamburger (mobile) */}
            <button
              className="md:hidden text-white/60 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden px-6 pb-5 border-t border-white/10 pt-4 space-y-3">
              <button
                onClick={() => scrollTo('features')}
                className="block w-full text-left text-sm text-white/60 hover:text-white transition-colors py-2"
              >
                Features
              </button>
              <button
                onClick={() => scrollTo('pricing')}
                className="block w-full text-left text-sm text-white/60 hover:text-white transition-colors py-2"
              >
                Pricing
              </button>
              <div className="flex gap-3 pt-1">
                <Link
                  to="/login"
                  className="flex-1 text-center px-4 py-2.5 rounded-lg border border-white/20 text-sm font-medium text-white hover:border-white/40 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="flex-1 text-center px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-white transition-colors"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <section className="relative px-6 pt-20 pb-24 overflow-hidden">
          {/* Ambient glows */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/8 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto text-center">
            {/* Trial pill */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/60 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
              5 documents free · No credit card required
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              <span className="text-white">Bookkeeping</span>
              <br />
              <span className="bg-gradient-to-r from-[#4DA6FF] to-emerald-400 bg-clip-text text-transparent">
                Made Easy
              </span>
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-lg text-white/55 leading-relaxed">
              AI-powered bookkeeping for small businesses, freelancers, and growing companies across North America.
              Upload a receipt, let AI do the rest.
            </p>

            {/* CTA buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-white transition-colors shadow-lg shadow-emerald-900/40"
              >
                Start Free Trial →
              </Link>
              <button
                onClick={() => scrollTo('pricing')}
                className="px-7 py-3.5 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 text-sm font-semibold text-white transition-colors"
              >
                View Pricing
              </button>
            </div>

            {/* Video placeholder */}
            <div className="mt-16 max-w-3xl mx-auto">
              <div className="relative rounded-2xl bg-[#0A1628] border border-white/10 overflow-hidden shadow-2xl shadow-black/50" style={{ aspectRatio: '16/9' }}>
                {/* Subtle grid */}
                <div
                  className="absolute inset-0 opacity-[0.035]"
                  aria-hidden
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <button
                    className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/15 transition-colors"
                    aria-label="Play video"
                  >
                    <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <p className="text-sm text-white/35">See AI Bookkeeping in action</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOR WHO ────────────────────────────────────────────────────────── */}
        <section id="features" className="px-6 py-20 border-t border-white/8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">Who it's for</p>
              <h2 className="text-3xl font-bold text-white">Built for every business size</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Small Businesses */}
              <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-6 hover:border-white/20 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Small Businesses</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Manage receipts, track expenses by category, and generate GST/HST tax reports — all without a bookkeeper.
                </p>
              </div>

              {/* Freelancers */}
              <div className="rounded-2xl bg-[#0A1628] border border-white/10 p-6 hover:border-white/20 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Freelancers</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Stay organized through the year and arrive at tax season with clean, categorized expense records ready for your accountant.
                </p>
              </div>

              {/* Mid-size — Coming Soon */}
              <div className="relative rounded-2xl bg-[#0A1628] border border-white/8 p-6 opacity-55 overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden rounded-tr-2xl pointer-events-none" aria-hidden>
                  <div
                    className="absolute bg-gray-500/50 text-white text-[8px] font-bold tracking-widest uppercase text-center py-1.5 w-36"
                    style={{ top: 20, right: -32, transform: 'rotate(45deg)' }}
                  >
                    Tier 2
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Mid-size Businesses</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Full double-entry bookkeeping, bank reconciliation, P&L reports, and Accounts Payable/Receivable tracking. Coming soon.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
        <section className="px-6 py-20 border-t border-white/8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">How it works</p>
              <h2 className="text-3xl font-bold text-white">From receipt to report in seconds</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {([
                {
                  num: '01',
                  title: 'Upload your receipt',
                  body: 'Take a photo or upload a PDF. Supports receipts, invoices, and expense documents.',
                  icon: (
                    <svg className="w-5 h-5 text-[#4DA6FF]" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  ),
                },
                {
                  num: '02',
                  title: 'AI extracts the data',
                  body: 'AI reads the vendor, date, line items, amounts, and taxes automatically — no manual entry needed.',
                  icon: (
                    <svg className="w-5 h-5 text-[#4DA6FF]" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                  ),
                },
                {
                  num: '03',
                  title: 'Download your report',
                  body: 'Get an Excel workbook with categorized expenses and a GST/HST ITC summary, ready for your accountant.',
                  icon: (
                    <svg className="w-5 h-5 text-[#4DA6FF]" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  ),
                },
              ] as const).map((step) => (
                <div key={step.num} className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[#0A1628] border border-white/15 flex items-center justify-center shrink-0">
                      {step.icon}
                    </div>
                    <span className="text-3xl font-bold text-white/10 select-none">{step.num}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1.5">{step.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ────────────────────────────────────────────────────────── */}
        <section id="pricing" className="px-6 py-20 border-t border-white/8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">Pricing</p>
              <h2 className="text-3xl font-bold text-white">Simple, transparent pricing</h2>
              <p className="mt-3 text-white/50">
                All plans include AI extraction, Excel workbooks, and expense reports. Cancel anytime.
              </p>
            </div>

            {/* Trial banner */}
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-6 py-4 text-sm text-white/60 mb-10">
              <svg className="w-4 h-4 text-[#4DA6FF] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span>
                <span className="font-semibold text-white">5-day free trial</span>
                {' · '}5 documents included{' · '}No credit card required to create an account
              </span>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl flex flex-col ${
                    plan.highlight
                      ? 'bg-[#0A1628] border-2 border-[#0066FF] shadow-lg shadow-blue-900/30'
                      : 'bg-[#0A1628] border border-white/10'
                  }`}
                >
                  {'badge' in plan && (
                    <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                      <span className="bg-[#0066FF] text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="px-6 pt-8 pb-6 flex-1">
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">{plan.name}</p>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-4xl font-bold text-white">${plan.price}</span>
                      <span className="text-sm text-white/40 mb-1.5">CAD / mo</span>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <p className="text-sm font-medium text-white/80">{plan.docs}</p>
                      <p className="text-sm text-white/40">{plan.storage}</p>
                    </div>
                    <ul className="mt-6 space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                          <CheckIcon />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="px-6 pb-6">
                    <Link
                      to="/register"
                      className={`w-full flex items-center justify-center rounded-xl py-3 text-sm font-semibold transition-colors ${
                        plan.highlight
                          ? 'bg-[#0066FF] hover:bg-[#0052cc] text-white'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      Start Free Trial
                    </Link>
                  </div>
                </div>
              ))}

              {/* Advanced — Coming Soon */}
              <div className="relative rounded-2xl flex flex-col bg-[#0A1628] border border-white/8 overflow-hidden opacity-60">
                <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden rounded-tr-2xl pointer-events-none" aria-hidden>
                  <div
                    className="absolute bg-gray-500/50 text-white text-[9px] font-bold tracking-widest uppercase text-center py-1.5 w-36"
                    style={{ top: 20, right: -32, transform: 'rotate(45deg)' }}
                  >
                    Coming Soon
                  </div>
                </div>

                <div className="px-6 pt-8 pb-6 flex-1">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Advanced</p>
                  <div className="mt-3">
                    <span className="text-2xl font-bold text-white/40">Coming Soon</span>
                  </div>
                  <p className="mt-3 text-xs text-white/30 leading-relaxed">
                    Full double-entry bookkeeping for growing businesses
                  </p>
                  <ul className="mt-6 space-y-2.5">
                    {ADVANCED_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/30">
                        <svg className="w-4 h-4 text-white/20 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-6 pb-6" style={{ opacity: 1 }}>
                  <button
                    onClick={() => setShowWaitlist(true)}
                    className="w-full flex items-center justify-center rounded-xl bg-white/8 hover:bg-white/12 py-3 text-sm font-semibold text-white/70 hover:text-white transition-colors"
                  >
                    Join Waitlist
                  </button>
                </div>
              </div>

            </div>

            <p className="mt-8 text-center text-xs text-white/30">
              Prices in CAD / USD. Taxes may apply. Cancel anytime from your billing portal.{' '}
              By subscribing you agree to our{' '}
              <Link to="/terms-of-service" className="underline hover:text-white/50 transition-colors">
                Terms of Service
              </Link>.
            </p>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <footer className="px-6 py-10 border-t border-white/8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">© 2026 Time2Win Inc. · Canadian-based company</p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link to="/privacy-policy" className="text-sm text-white/30 hover:text-white/60 transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="text-sm text-white/30 hover:text-white/60 transition-colors">
                Terms of Service
              </Link>
              <a
                href="mailto:support@ai-bookkeeping.ai"
                className="text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </footer>

      </div>

      {showWaitlist && <WaitlistModal onClose={() => setShowWaitlist(false)} />}
    </>
  );
};
