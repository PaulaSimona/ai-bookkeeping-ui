import { type FC, type FormEvent, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useRegister } from '@/api/auth/useRegister';
import { Loader } from '@/components/Loader';
import logoSvg from '@/assets/logo.svg';

// ─── Password input with show/hide toggle ─────────────────────────────────────

const EyeIcon: FC<{ visible: boolean }> = ({ visible }) => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    {visible ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    ) : (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </>
    )}
  </svg>
);

const PasswordInput: FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`pr-10 ${className}`} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <EyeIcon visible={show} />
      </button>
    </div>
  );
};

// ─── Password strength indicator ─────────────────────────────────────────────

function getStrength(pw: string): { level: 1 | 2 | 3 | 4; label: string; bar: string; text: string } {
  const types = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length < 8 || types < 2) return { level: 1, label: 'Weak',   bar: 'bg-red-500',     text: 'text-red-500'    };
  if (types === 2)                 return { level: 2, label: 'Fair',   bar: 'bg-orange-400',  text: 'text-orange-500' };
  if (types === 3)                 return { level: 3, label: 'Good',   bar: 'bg-yellow-400',  text: 'text-yellow-600' };
  return                                  { level: 4, label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600'};
}

const PasswordStrength: FC<{ password: string }> = ({ password }) => {
  const { level, label, bar, text } = getStrength(password);
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {([1, 2, 3, 4] as const).map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${n <= level ? bar : 'bg-gray-200'}`} />
        ))}
      </div>
      <span className={`text-[11px] font-semibold w-12 text-right shrink-0 ${text}`}>{label}</span>
    </div>
  );
};

// ─── Location data ───────────────────────────────────────────────────────────

const CANADA_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  getUser?: () => void;
}

export const Register: FC<Props> = () => {
  const navigate = useNavigate();
  const { register, success, requiresVerification, registeredEmail, error, inProgress, errors } = useRegister();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    confirm_email: '',
    password: '',
    confirm: '',
    country: 'CA',
    province: '',
  });
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [provinceError, setProvinceError] = useState(false);

  useEffect(() => {
    if (requiresVerification && registeredEmail) {
      navigate('/check-email', { state: { email: registeredEmail }, replace: true });
    }
  }, [requiresVerification, registeredEmail, navigate]);

  useEffect(() => {
    if (success) navigate('/dashboard');
  }, [success, navigate]);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.email !== form.confirm_email) {
      setEmailMismatch(true);
      return;
    }
    setEmailMismatch(false);
    if (!form.province.trim()) {
      setProvinceError(true);
      return;
    }
    setProvinceError(false);
    register(form);
  };

  const fieldError = (key: keyof typeof errors): string | undefined =>
    errors?.[key]?.[0];

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-[#0A1628] px-12 py-12">
        <img src={logoSvg} alt="AI Bookkeeping" className="h-8 w-auto" />
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Start organizing<br />your finances today.
          </h1>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            Join thousands of freelancers and small businesses who let AI handle
            their bookkeeping.
          </p>
        </div>
        <div className="text-white/30 text-xs space-y-1">
          <p>© 2026 Time2Win Inc.</p>
          <p className="flex items-center gap-2">
            <NavLink to="/privacy-policy"   className="hover:text-white/50 transition-colors">Privacy Policy</NavLink>
            <span>·</span>
            <NavLink to="/terms-of-service" className="hover:text-white/50 transition-colors">Terms of Service</NavLink>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <img src={logoSvg} alt="AI Bookkeeping" className="h-7 mb-10 lg:hidden" />

          <h2 className="text-2xl font-semibold text-gray-900">Create account</h2>
          <p className="mt-1 text-sm text-gray-500">5-day free trial · No credit card required</p>

          {error && !Object.values(errors ?? {}).some((e) => Array.isArray(e) && e.length > 0) && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(['first_name', 'last_name'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 capitalize">
                    {field === 'first_name' ? 'First name' : 'Last name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={form[field]}
                    onChange={set(field)}
                    placeholder={field === 'first_name' ? 'Jane' : 'Smith'}
                    className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition ${fieldError(field) ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {fieldError(field) && (
                    <p className="mt-1 text-xs text-red-600">{fieldError(field)}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Email fields */}
            {([
              { field: 'email' as const,         label: 'Email address',         type: 'email', placeholder: 'you@company.com' },
              { field: 'confirm_email' as const, label: 'Confirm email address', type: 'email', placeholder: 'you@company.com' },
            ] as const).map(({ field, label, type, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <input
                  type={type}
                  required
                  value={form[field]}
                  onChange={set(field)}
                  placeholder={placeholder}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition ${fieldError(field) ? 'border-red-400' : 'border-gray-300'}`}
                />
                {fieldError(field) && <p className="mt-1 text-xs text-red-600">{fieldError(field)}</p>}
                {field === 'confirm_email' && emailMismatch && (
                  <p className="mt-1 text-xs text-red-600">Email addresses do not match.</p>
                )}
              </div>
            ))}

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
              <select
                value={form.country}
                onChange={(e) => {
                  setForm((f) => ({ ...f, country: e.target.value, province: '' }));
                  setProvinceError(false);
                }}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
              >
                <option value="CA">Canada</option>
                <option value="US">United States</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Province / State */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {form.country === 'CA' ? 'Province' : form.country === 'US' ? 'State' : 'Province / State / Region'}
              </label>
              {form.country === 'CA' && (
                <select
                  value={form.province}
                  onChange={(e) => { setForm((f) => ({ ...f, province: e.target.value })); setProvinceError(false); }}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition ${provinceError || fieldError('province') ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select province…</option>
                  {CANADA_PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              )}
              {form.country === 'US' && (
                <select
                  value={form.province}
                  onChange={(e) => { setForm((f) => ({ ...f, province: e.target.value })); setProvinceError(false); }}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition ${provinceError || fieldError('province') ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select state…</option>
                  {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              )}
              {form.country === 'OTHER' && (
                <input
                  type="text"
                  value={form.province}
                  onChange={(e) => { setForm((f) => ({ ...f, province: e.target.value })); setProvinceError(false); }}
                  placeholder="Enter your province, state, or region"
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition ${provinceError || fieldError('province') ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}
              {provinceError && <p className="mt-1 text-xs text-red-600">Province/State is required.</p>}
              {fieldError('province') && <p className="mt-1 text-xs text-red-600">{fieldError('province')}</p>}
            </div>

            {/* Password fields */}
            {([
              { field: 'password' as const, label: 'Password',         placeholder: 'Min. 8 characters' },
              { field: 'confirm' as const,  label: 'Confirm password', placeholder: 'Repeat password'   },
            ] as const).map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <PasswordInput
                  required
                  value={form[field]}
                  onChange={set(field)}
                  placeholder={placeholder}
                  autoComplete="new-password"
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition ${fieldError(field) ? 'border-red-400' : 'border-gray-300'}`}
                />
                {field === 'password' && form.password && <PasswordStrength password={form.password} />}
                {fieldError(field) && <p className="mt-1 text-xs text-red-600">{fieldError(field)}</p>}
              </div>
            ))}

            <button
              type="submit"
              disabled={inProgress}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors mt-2"
            >
              {inProgress ? <><Loader /> Creating account…</> : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <NavLink to="/login" className="font-medium text-[#0066FF] hover:underline">
              Sign in
            </NavLink>
          </p>

          <p className="mt-4 text-center text-xs text-gray-400">
            By continuing, you agree to our{' '}
            <NavLink to="/terms-of-service" className="underline hover:text-gray-600 transition-colors">Terms of Service</NavLink>
            {' '}and{' '}
            <NavLink to="/privacy-policy" className="underline hover:text-gray-600 transition-colors">Privacy Policy</NavLink>
          </p>
        </div>
      </div>
    </div>
  );
};
