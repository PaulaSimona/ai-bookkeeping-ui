// Settings (s24 U1 restyle — O-S24-1am, ADDENDUM_12 Part A). The single scrolling
// page becomes a tabbed shell (Business profile · Bank & integrations ·
// Subscription · Security); the tier-2 tabs (Tax profile, Chart of accounts,
// Team & access) arrive in U2/U3 and are not shown yet. This is a VISUAL restyle
// only: every request/response shape below is byte-preserved against the s24 trace
// (item 14). Own data layer (wrapped api client) — no Tier 1 hook edits. Brand
// tokens + Tailwind neutrals only; ZERO raw hex.
import { type FC, type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import api from '@/utils/api';
import { PageHeader } from '@/components/t2/PageHeader';
import {
  Field,
  Input,
  SaveButton,
  Section,
  Select,
  Spinner,
  TabBar,
  ToastBanner,
  useToast,
} from './ui';
// O-S33-1: the canonical jurisdiction tables. A local 11-entry copy used to
// live in this file — no territories, and 'Québec' where every other table
// said 'Quebec'. That was the FOURTH divergent province list in the product.
import { CA_PROVINCES, US_STATES } from '@/utils/constants';
import { TaxProfileTab } from './TaxProfileTab';
import { PlaidConnectionsCard } from './PlaidConnectionsCard';
import { ChartOfAccountsPanel } from './ChartOfAccountsPanel';
import { TeamAccessTab } from './TeamAccessTab';

// ─── Constants ────────────────────────────────────────────────────────────────

type ToastFns = { showSuccess: (m: string) => void; showError: (m: string) => void };

// ─── Business profile ─────────────────────────────────────────────────────────
// GET  /api/user/profile  → {..., phone_number, company:{7 keys}}   (byte-preserved)
// PUT  /api/user/profile  ← {phone_number, company:{ALL 7 keys}}    (byte-preserved)
const BusinessProfileSection: FC<ToastFns> = ({ showSuccess, showError }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [country, setCountry] = useState('CA'); // LOCAL only — never persisted
  const [form, setForm] = useState({
    phone_number:    '',
    company_name:    '',
    business_number: '',
    address:         '',
    number:          '',
    city:            '',
    province:        '',
    postal_code:     '',
  });

  useEffect(() => {
    api.get('/api/user/profile').then((res) => {
      if (res?.data) {
        const c = res.data.company ?? {};
        setForm({
          phone_number:    res.data.phone_number ?? '',
          company_name:    c.company_name    ?? '',
          business_number: c.business_number ?? '',
          address:         c.address         ?? '',
          number:          c.number          ?? '',
          city:            c.city            ?? '',
          province:        c.province        ?? '',
          postal_code:     c.postal_code     ?? '',
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // All 7 company keys ALWAYS sent — a partial block 500s server-side (KeyError).
      const { phone_number, ...companyFields } = form;
      const res = await api.put('/api/user/profile', { phone_number, company: companyFields });
      if (res?.status === 200) {
        showSuccess('Business profile saved.');
      } else {
        showError('Failed to save. Please try again.');
      }
    } catch {
      showError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Section title="Business Profile">
      <div className="flex h-48 items-center justify-center"><Spinner /></div>
    </Section>
  );

  return (
    <Section title="Business Profile" description="Used on your Excel reports and for tax calculations.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Business name">
          <Input value={form.company_name} onChange={set('company_name')} placeholder="Acme Corp" />
        </Field>

        <Field label="Phone number">
          <Input type="tel" value={form.phone_number} onChange={set('phone_number')} placeholder="+1 604 555 1234" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Street address">
            <Input value={form.address} onChange={set('address')} placeholder="123 Main St" />
          </Field>
          <Field label="Unit / suite">
            <Input value={form.number} onChange={set('number')} placeholder="Suite 400" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="City">
            <Input value={form.city} onChange={set('city')} placeholder="Toronto" />
          </Field>
          <Field label="Country">
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="CA">Canada</option>
              <option value="US">United States</option>
            </Select>
          </Field>
          <Field label={country === 'CA' ? 'Province' : 'State'}>
            {country === 'CA' ? (
              <Select value={form.province} onChange={set('province')}>
                <option value="">Select…</option>
                {CA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </Select>
            ) : (
              <Select value={form.province} onChange={set('province')}>
                <option value="">Select…</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Postal / ZIP code">
            <Input value={form.postal_code} onChange={set('postal_code')} placeholder={country === 'CA' ? 'M5H 1A1' : '10001'} />
          </Field>
          {country === 'CA' && (
            <Field label="GST / HST registration number">
              <Input value={form.business_number} onChange={set('business_number')} placeholder="123456789 RT 0001" />
            </Field>
          )}
        </div>

        <div className="pt-1">
          <SaveButton saving={saving} />
        </div>
      </form>
    </Section>
  );
};

// ─── Bank & integrations (U1 = Telegram card only; Plaid list arrives U2) ──────
// GET    /api/telegram/status/     → {linked, chat_id}          (byte-preserved)
// POST   /api/telegram/link-token/ → {token, expires_in_seconds}(byte-preserved)
// DELETE /api/telegram/unlink/     → {unlinked:true}            (byte-preserved)
// ─── Cards summary (O-S31-1 C3) ───────────────────────────────────────────────
// Read-only pointer to the Cards page. Counts UNIDENTIFIED cards, which is the
// only number that asks anything of the owner.
//
// page_size=200 deliberately (the useAccounts chart precedent): the server
// orders cards by classification ASC, so 'unidentified' sorts LAST — reading
// only the default first page could miss every card that needs action and
// report a truthful-looking zero.
const CardsSummarySection: FC = () => {
  const [pending, setPending] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/accounting/cards/', { params: { page_size: 200 } })
      .then((res) => {
        if (cancelled || res == null || res.status !== 200) return;
        const rows = Array.isArray(res.data?.results) ? res.data.results : [];
        setPending(rows.filter((c: { classification?: string }) => c.classification === 'unidentified').length);
        setTotal(typeof res.data?.count === 'number' ? res.data.count : rows.length);
      })
      .catch(() => { /* leave null — the section degrades to its calm copy */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <Section
      title="Cards"
      description="Cards detected in your bank activity, and who they belong to."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-gray-600">
          {pending === null
            ? 'Cards appear here automatically when card payments show up in your bank activity.'
            : pending > 0
              ? `${pending} card${pending === 1 ? '' : 's'} still ${pending === 1 ? 'needs' : 'need'} identifying — payments to ${pending === 1 ? 'it' : 'them'} wait for review until then.`
              : total > 0
                ? `All ${total} card${total === 1 ? '' : 's'} identified — payments to them file automatically.`
                : 'No cards detected yet.'}
        </p>
        <Link
          to="/accounting/cards"
          className="shrink-0 text-[13px] font-semibold text-[var(--color-primary)] hover:underline"
        >
          Manage cards
        </Link>
      </div>
    </Section>
  );
};

const BankIntegrationsSection: FC<ToastFns> = ({ showSuccess, showError }) => {
  const [loading, setLoading]       = useState(true);
  const [linked, setLinked]         = useState(false);
  const [chatId, setChatId]         = useState<number | null>(null);
  const [token, setToken]           = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking]   = useState(false);

  useEffect(() => {
    api.get('/api/telegram/status/').then((res) => {
      if (res?.data) {
        setLinked(res.data.linked);
        setChatId(res.data.chat_id);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleGenerateToken = async () => {
    setGenerating(true);
    setToken(null);
    try {
      const res = await api.post('/api/telegram/link-token/');
      if (res?.data?.token) setToken(res.data.token);
      else showError('Could not generate link token.');
    } catch {
      showError('Could not generate link token.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await api.delete('/api/telegram/unlink/');
      setLinked(false);
      setChatId(null);
      setToken(null);
      showSuccess('Telegram account unlinked.');
    } catch {
      showError('Failed to unlink. Please try again.');
    } finally {
      setUnlinking(false);
    }
  };

  const StepDot: FC<{ n: number }> = ({ n }) => (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[10px] font-bold text-[var(--color-primary)]">
      {n}
    </span>
  );

  return (
    <Section title="Telegram" description="Link your Telegram account to upload documents directly from the bot.">
      {loading ? (
        <div className="flex h-20 items-center"><Spinner /></div>
      ) : linked ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
              <svg className="h-5 w-5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Telegram connected</p>
              <p className="text-xs text-gray-400">Chat ID: {chatId}</p>
            </div>
          </div>
          <button
            onClick={handleUnlink}
            disabled={unlinking}
            className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : (
        <div className="space-y-5 rounded-xl border border-[var(--color-primary-light)] bg-[var(--color-primary-light)]/40 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              <svg className="h-4 w-4 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Connect Telegram Bot</p>
              <p className="mt-0.5 text-xs text-gray-500">Upload receipts directly from your phone</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row">
            <ol className="flex-1 space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2.5"><StepDot n={1} /><span>Download Telegram on your phone</span></li>
              <li className="flex items-start gap-2.5">
                <StepDot n={2} />
                <span>
                  Scan the QR code or tap{' '}
                  <a href="https://t.me/Accuratebooks_bot" target="_blank" rel="noreferrer" className="font-medium text-[var(--color-primary)] hover:underline">
                    @Accuratebooks_bot
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <StepDot n={3} />
                <span>
                  Send <code className="rounded border border-[var(--color-primary-light)] bg-white px-1.5 py-0.5 font-[var(--font-family-mono)] text-xs">/start</code> to the bot
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <StepDot n={4} />
                <span>
                  Generate your link token below and send{' '}
                  <code className="rounded border border-[var(--color-primary-light)] bg-white px-1.5 py-0.5 font-[var(--font-family-mono)] text-xs">/link &lt;token&gt;</code> to the bot
                </span>
              </li>
            </ol>

            <div className="flex justify-center sm:shrink-0">
              <img
                src="/t_me-Accuratebooks_bot.jpg"
                alt="Scan to open @Accuratebooks_bot on Telegram"
                className="rounded-lg border border-[var(--color-primary-light)] object-contain"
                style={{ width: 180, height: 180 }}
              />
            </div>
          </div>

          {token && (
            <div className="rounded-lg border border-[var(--color-primary-light)] bg-white px-4 py-3">
              <p className="mb-1.5 text-xs font-medium text-[var(--color-primary)]">Your link token (valid 15 minutes)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all font-[var(--font-family-mono)] text-sm text-gray-900">/link {token}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(`/link ${token}`)}
                  className="shrink-0 text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateToken}
            disabled={generating}
            className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {generating && <Spinner light />}
            {generating ? 'Generating…' : 'Generate link token'}
          </button>
        </div>
      )}
    </Section>
  );
};

// ─── Subscription ─────────────────────────────────────────────────────────────
// GET  /api/packages/user_package         → plan_name, ...to_upload_total, ...uploaded
// POST /api/stripe/create-portal-session/  → {url}   (both byte-preserved)
interface PkgStatus {
  number_of_documents_to_upload_total: number;
  number_of_documents_uploaded: number;
  plan_name: string;
}

const SubscriptionSection: FC<{ showError: (m: string) => void }> = ({ showError }) => {
  const [status, setStatus]     = useState<PkgStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    api.get('/api/packages/user_package').then((res) => {
      if (res?.data) setStatus(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleManageBilling = async () => {
    setManaging(true);
    try {
      const res = await api.post('/api/stripe/create-portal-session/');
      if (res?.data?.url) {
        window.location.href = res.data.url;
      } else {
        showError(res?.data?.error ?? 'Could not open billing portal. Please try again.');
      }
    } catch {
      showError('Could not open billing portal. Please try again.');
    } finally {
      setManaging(false);
    }
  };

  // Presentation-only ratio for the usage bar (never money math). used / (used + remaining).
  const used = status?.number_of_documents_uploaded ?? 0;
  const remaining = status?.number_of_documents_to_upload_total ?? 0;
  const denom = used + remaining;
  const pct = denom > 0 ? Math.min(100, Math.round((used / denom) * 100)) : 0;

  return (
    <Section title="Subscription" description="Your current plan and document quota.">
      {loading ? (
        <div className="flex h-16 items-center"><Spinner /></div>
      ) : status ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{status.plan_name}</p>
              <p className="mt-1 text-xs text-gray-400">
                {remaining} document{remaining !== 1 ? 's' : ''} remaining{' · '}{used} used
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleManageBilling}
                disabled={managing}
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-50"
              >
                {managing ? 'Opening…' : 'Manage billing'}
              </button>
              <Link
                to="/subscription"
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Upgrade plan
              </Link>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-500">No active plan.</p>
          <Link
            to="/subscription"
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            View plans
          </Link>
        </div>
      )}
    </Section>
  );
};

// ─── Security ─────────────────────────────────────────────────────────────────
// PUT /api/user/password  ← {old_password, new_password, new_password2}  (byte-preserved)
const SecuritySection: FC<ToastFns> = ({ showSuccess, showError }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ old_password: '', new_password: '', new_password2: '' });

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.new_password !== form.new_password2) {
      showError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/api/user/password', form);
      if (res?.status === 200) {
        showSuccess('Password updated successfully.');
        setForm({ old_password: '', new_password: '', new_password2: '' });
      } else {
        const detail = res?.data?.old_password?.[0]
          || res?.data?.new_password?.[0]
          || res?.data?.detail
          || 'Password change failed.';
        showError(detail);
      }
    } catch {
      showError('Password change failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Security" description="Change your account password.">
      <form onSubmit={handleSubmit} className="max-w-sm space-y-5">
        <Field label="Current password" required>
          <Input type="password" value={form.old_password} onChange={set('old_password')} autoComplete="current-password" placeholder="••••••••" required />
        </Field>
        <Field label="New password" required>
          <Input type="password" value={form.new_password} onChange={set('new_password')} autoComplete="new-password" placeholder="Min. 8 characters" required />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" value={form.new_password2} onChange={set('new_password2')} autoComplete="new-password" placeholder="Repeat new password" required />
        </Field>
        <div className="pt-1">
          <SaveButton saving={saving} label="Update password" />
        </div>
      </form>
    </Section>
  );
};

// ─── Tabbed shell ─────────────────────────────────────────────────────────────
// The three Tier-2 tabs (Tax profile, Chart of accounts) are shown ONLY to
// entitled orgs, resolved via the same convention the s23 accounting surfaces use
// (App.tsx RequireTier2): redux auth `has_tier2`. Non-entitled users see the U1
// four-tab set unchanged. Team & access is U3.
const BASE_TABS = {
  business:     { id: 'business',     label: 'Business profile' },
  tax:          { id: 'tax',          label: 'Tax profile' },
  integrations: { id: 'integrations', label: 'Bank & integrations' },
  chart:        { id: 'chart',        label: 'Chart of accounts' },
  subscription: { id: 'subscription', label: 'Subscription' },
  security:     { id: 'security',     label: 'Security' },
  team:         { id: 'team',         label: 'Team & access' },
};

export const Settings: FC = () => {
  const { toast, showSuccess, showError } = useToast();
  const [active, setActive] = useState('business'); // default: Business profile

  // Entitlement — identical expression to App.tsx RequireTier2 (do not invent a
  // new check). Non-entitled → the U1 four-tab set only.
  const { user } = useSelector((s: RootState) => s.auth);
  const hasTier2 = user?.user?.has_tier2 ?? user?.has_tier2 ?? false;

  // Team & access is LAST in the tab bar (ruled order).
  const tabs = hasTier2
    ? [BASE_TABS.business, BASE_TABS.tax, BASE_TABS.integrations, BASE_TABS.chart, BASE_TABS.subscription, BASE_TABS.security, BASE_TABS.team]
    : [BASE_TABS.business, BASE_TABS.integrations, BASE_TABS.subscription, BASE_TABS.security];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* max-w-5xl (F-S24-2): matches the sibling accounting pages and fits all
          seven tabs on one row at desktop widths; cards inherit this width for a
          consistent, un-lopsided page. Narrow viewports fall back to the TabBar's
          visible horizontal scroll. */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Settings"
          subtitle="Manage your business profile, integrations, and account security."
        />

        <div className="mt-6">
          <TabBar tabs={tabs} active={active} onChange={setActive} />
        </div>

        <div className="mt-6">
          {active === 'business'     && <BusinessProfileSection showSuccess={showSuccess} showError={showError} />}
          {active === 'tax'          && hasTier2 && <TaxProfileTab onSaved={showSuccess} />}
          {active === 'integrations' && (
            <div className="space-y-6">
              {hasTier2 && <PlaidConnectionsCard />}
              {hasTier2 && <CardsSummarySection />}
              <BankIntegrationsSection showSuccess={showSuccess} showError={showError} />
            </div>
          )}
          {active === 'chart'        && hasTier2 && <ChartOfAccountsPanel />}
          {active === 'subscription' && <SubscriptionSection showError={showError} />}
          {active === 'security'     && <SecuritySection showSuccess={showSuccess} showError={showError} />}
          {active === 'team'         && hasTier2 && <TeamAccessTab showSuccess={showSuccess} showError={showError} />}
        </div>
      </div>

      <ToastBanner toast={toast} />
    </div>
  );
};
