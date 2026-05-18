import { type FC, type FormEvent, useState } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import api from '@/utils/api';

export const Support: FC = () => {
  const auth = useSelector((s: RootState) => s.auth);
  const prefillEmail: string = auth.user?.user?.email ?? auth.user?.email ?? '';
  const prefillName: string =
    [auth.user?.user?.first_name, auth.user?.user?.last_name].filter(Boolean).join(' ') ||
    [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || '';

  const [form, setForm] = useState({
    name: prefillName,
    email: prefillEmail,
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket]         = useState<string | null>(null);
  const [error, setError]           = useState('');

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/api/support/', form);
      if (res?.data?.ticket_number) {
        setTicket(res.data.ticket_number);
      } else {
        setError(res?.data?.error ?? 'Submission failed. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (ticket) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-1 overflow-y-auto px-8 py-8 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Message received!</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your message has been received. Your ticket number is{' '}
              <span className="font-mono font-semibold text-[#0066FF]">{ticket}</span>.
              We'll get back to you within 24 hours.
            </p>
            <p className="mt-3 text-xs text-gray-400">
              A confirmation has been sent to {form.email}.
            </p>
            <button
              onClick={() => { setTicket(null); setForm({ name: prefillName, email: prefillEmail, subject: '', message: '' }); }}
              className="mt-6 text-sm font-medium text-[#0066FF] hover:underline"
            >
              Send another message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto px-8 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="mt-1 text-sm text-gray-500">
            Send us a message and we'll get back to you within 24 hours.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-6">
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <input
                  type="text" required value={form.name} onChange={set('name')}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email" required value={form.email} onChange={set('email')}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
              <input
                type="text" required value={form.subject} onChange={set('subject')}
                placeholder="Brief summary of your issue"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
              <textarea
                required value={form.message} onChange={set('message')} rows={6}
                placeholder="Describe your issue or question in detail…"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition resize-none"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {submitting ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
