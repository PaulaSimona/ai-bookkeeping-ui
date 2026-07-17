import { type FC, type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { message: string; type: 'success' | 'error' }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (message: string, type: Toast['type']) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 3500);
  };

  return { toast, showSuccess: (m: string) => show(m, 'success'), showError: (m: string) => show(m, 'error') };
}

const ToastBanner: FC<{ toast: Toast | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-lg text-sm font-medium transition-all ${
      toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {toast.type === 'success'
        ? <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        : <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      }
      {toast.message}
    </div>
  );
};

// ─── Section card ─────────────────────────────────────────────────────────────

const Section: FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title, description, children,
}) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
    <div className="px-6 py-5 border-b border-gray-100">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
    <div className="px-6 py-6">{children}</div>
  </div>
);

const Field: FC<{ label: string; children: React.ReactNode; required?: boolean }> = ({
  label, children, required,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Input: FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400"
  />
);

const Select: FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition bg-white disabled:bg-gray-50"
  >
    {children}
  </select>
);

const SaveButton: FC<{ saving: boolean; label?: string }> = ({ saving, label = 'Save changes' }) => (
  <button
    type="submit"
    disabled={saving}
    className="flex items-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
  >
    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
    {saving ? 'Saving…' : label}
  </button>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Québec' },
  { code: 'SK', name: 'Saskatchewan' },
];

// ─── Section 1 — Business Profile ─────────────────────────────────────────────

const BusinessProfileSection: FC<{ showSuccess: (m: string) => void; showError: (m: string) => void }> = ({
  showSuccess, showError,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [country, setCountry] = useState('CA');
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
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
      </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Street address">
            <Input value={form.address} onChange={set('address')} placeholder="123 Main St" />
          </Field>
          <Field label="Unit / suite">
            <Input value={form.number} onChange={set('number')} placeholder="Suite 400" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <Input value={form.province} onChange={set('province')} placeholder="CA" maxLength={2} />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

// ─── Section 2 — Telegram ─────────────────────────────────────────────────────

const TelegramSection: FC<{ showSuccess: (m: string) => void; showError: (m: string) => void }> = ({
  showSuccess, showError,
}) => {
  const [loading, setLoading]     = useState(true);
  const [linked, setLinked]       = useState(false);
  const [chatId, setChatId]       = useState<number | null>(null);
  const [token, setToken]         = useState<string | null>(null);
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

  return (
    <Section title="Telegram" description="Link your Telegram account to upload documents directly from the bot.">
      {loading ? (
        <div className="h-20 flex items-center">
          <div className="w-5 h-5 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : linked ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#0066FF]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
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
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-[#EFF8FF] border border-[#BFDBFE] p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#0088CC' }}>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Connect Telegram Bot</p>
              <p className="text-xs text-gray-500 mt-0.5">Upload receipts directly from your phone</p>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Steps */}
            <ol className="flex-1 space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0088CC] text-[10px] font-bold text-white">1</span>
                <span>Download Telegram on your phone</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0088CC] text-[10px] font-bold text-white">2</span>
                <span>
                  Scan the QR code or tap{' '}
                  <a href="https://t.me/Accuratebooks_bot" target="_blank" rel="noreferrer" className="font-medium text-[#0088CC] hover:underline">
                    @Accuratebooks_bot
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0088CC] text-[10px] font-bold text-white">3</span>
                <span>
                  Send <code className="rounded bg-white border border-[#BFDBFE] px-1.5 py-0.5 font-mono text-xs">/start</code> to the bot
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0088CC] text-[10px] font-bold text-white">4</span>
                <span>
                  Generate your link token below and send{' '}
                  <code className="rounded bg-white border border-[#BFDBFE] px-1.5 py-0.5 font-mono text-xs">/link &lt;token&gt;</code> to the bot
                </span>
              </li>
            </ol>

            {/* QR code */}
            <div className="sm:shrink-0 flex justify-center">
              <img
                src="/t_me-Accuratebooks_bot.jpg"
                alt="Scan to open @Accuratebooks_bot on Telegram"
                className="rounded-lg border border-[#BFDBFE] object-contain"
                style={{ width: 180, height: 180 }}
              />
            </div>
          </div>

          {/* Token display */}
          {token && (
            <div className="rounded-lg border border-blue-100 bg-white px-4 py-3">
              <p className="text-xs font-medium text-blue-700 mb-1.5">Your link token (valid 15 minutes)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm text-blue-900 break-all">/link {token}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(`/link ${token}`)}
                  className="text-xs text-blue-600 hover:text-blue-800 shrink-0 font-medium"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerateToken}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-[#0088CC] hover:bg-[#0077b3] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {generating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {generating ? 'Generating…' : 'Generate link token'}
          </button>
        </div>
      )}
    </Section>
  );
};

// ─── Section 3 — Security ─────────────────────────────────────────────────────

const SecuritySection: FC<{ showSuccess: (m: string) => void; showError: (m: string) => void }> = ({
  showSuccess, showError,
}) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    old_password:  '',
    new_password:  '',
    new_password2: '',
  });

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
      <form onSubmit={handleSubmit} className="space-y-5 max-w-sm">
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

// ─── Section 3 — Subscription ─────────────────────────────────────────────────

interface PkgStatus {
  number_of_documents_to_upload_total: number;
  number_of_documents_uploaded: number;
  storage_space_total: number;
  storage_space_used: number;
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

  return (
    <Section title="Subscription" description="Your current plan and document quota.">
      {loading ? (
        <div className="h-16 flex items-center">
          <div className="w-5 h-5 border-2 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : status ? (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{status.plan_name}</p>
            <p className="mt-1 text-xs text-gray-400">
              {status.number_of_documents_to_upload_total} document{status.number_of_documents_to_upload_total !== 1 ? 's' : ''} remaining
              {' · '}{status.number_of_documents_uploaded} used
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManageBilling}
              disabled={managing}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
            >
              {managing ? 'Opening…' : 'Manage billing'}
            </button>
            <Link
              to="/subscription"
              className="rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              Upgrade plan
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm text-gray-500">No active plan.</p>
          <Link
            to="/subscription"
            className="rounded-lg bg-[#0066FF] hover:bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            View plans
          </Link>
        </div>
      )}
    </Section>
  );
};

// ─── Settings page ────────────────────────────────────────────────────────────

export const Settings: FC = () => {
  const { toast, showSuccess, showError } = useToast();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto px-8 py-8 max-w-3xl space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your business profile, integrations, and account security.</p>
        </div>

        <BusinessProfileSection showSuccess={showSuccess} showError={showError} />
        <TelegramSection        showSuccess={showSuccess} showError={showError} />
        <SubscriptionSection    showError={showError} />
        <SecuritySection        showSuccess={showSuccess} showError={showError} />
      </div>

      <ToastBanner toast={toast} />
    </div>
  );
};
