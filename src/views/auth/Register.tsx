import { type FC, type FormEvent, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useRegister } from '@/api/auth/useRegister';
import { Loader } from '@/components/Loader';
import logoSvg from '@/assets/logo.svg';

interface Props {
  getUser?: () => void;
}

export const Register: FC<Props> = ({ getUser }) => {
  const navigate = useNavigate();
  const { register, success, error, inProgress, errors } = useRegister();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm: '',
  });

  useEffect(() => {
    if (success) {
      getUser?.();
      navigate('/dashboard');
    }
  }, [success, getUser, navigate]);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
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
        <p className="text-white/30 text-sm">© {new Date().getFullYear()} AI Bookkeeping Inc.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <img src={logoSvg} alt="AI Bookkeeping" className="h-7 mb-10 lg:hidden" />

          <h2 className="text-2xl font-semibold text-gray-900">Create account</h2>
          <p className="mt-1 text-sm text-gray-500">Free 14-day trial, no credit card required</p>

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

            {[
              { field: 'email' as const,        label: 'Email address',  type: 'email',    placeholder: 'you@company.com' },
              { field: 'phone_number' as const,  label: 'Phone number',   type: 'tel',      placeholder: '+1 613 555 1234' },
              { field: 'password' as const,      label: 'Password',       type: 'password', placeholder: 'Min. 8 characters' },
              { field: 'confirm' as const,       label: 'Confirm password', type: 'password', placeholder: 'Repeat password' },
            ].map(({ field, label, type, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <input
                  type={type}
                  required
                  value={form[field]}
                  onChange={set(field)}
                  placeholder={placeholder}
                  autoComplete={field === 'password' ? 'new-password' : undefined}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition ${fieldError(field) ? 'border-red-400' : 'border-gray-300'}`}
                />
                {fieldError(field) && (
                  <p className="mt-1 text-xs text-red-600">{fieldError(field)}</p>
                )}
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
        </div>
      </div>
    </div>
  );
};
