import { type FC, type FormEvent, useState } from 'react';
import api from '@/utils/api';

const CATEGORIES = ['Bug', 'Suggestion', 'Compliment'] as const;

const StarRating: FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          aria-label={`${star} star`}
        >
          <svg
            className={`w-8 h-8 transition-colors ${
              star <= (hovered || value) ? 'text-amber-400' : 'text-gray-200'
            }`}
            fill="currentColor" viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
};

export const Feedback: FC = () => {
  const [rating, setRating]       = useState(5);
  const [category, setCategory]   = useState<typeof CATEGORIES[number]>('Suggestion');
  const [comment, setComment]     = useState('');
  const [email, setEmail]         = useState('');
  const [submitting, setSubmit]   = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) { setError('Please add a comment.'); return; }
    setSubmit(true); setError('');
    try {
      const res = await api.post('/api/feedback/', {
        feedback: comment,
        rating,
        category,
        email_address: email || undefined,
      });
      if (res?.status === 201) {
        setDone(true);
      } else {
        setError(res?.data?.error ?? 'Submission failed. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmit(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex-1 overflow-y-auto px-8 py-8 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h2>
            <p className="text-sm text-gray-500">Your feedback has been received. We read every submission.</p>
            <button
              onClick={() => { setDone(false); setComment(''); setEmail(''); setRating(5); setCategory('Suggestion'); }}
              className="mt-6 text-sm font-medium text-[#0066FF] hover:underline"
            >
              Send more feedback
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
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
          <p className="mt-1 text-sm text-gray-500">
            Help us improve AI Bookkeeping — every submission is read by the team.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-6">
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">How would you rate your experience?</label>
              <StarRating value={rating} onChange={setRating} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition bg-white"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
              <textarea
                required value={comment} onChange={(e) => setComment(e.target.value)} rows={5}
                placeholder="Tell us what you think…"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email <span className="text-gray-400 font-normal">(optional — if you'd like us to follow up)</span>
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
