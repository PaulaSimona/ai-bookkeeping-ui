// Accountant Period close (/accountant/close) — U1 stub; the real close flow
// lands in U3.
import { type FC } from 'react';
import { PageHeader } from '@/components/t2/PageHeader';

export const PeriodClose: FC = () => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader title="Period close" subtitle="Loading…" />
    </div>
  </div>
);
