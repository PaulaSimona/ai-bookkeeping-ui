// Accountant New Adjustment (/accountant/adjustments/new) — U1 stub; the real
// balanced-entry composer lands in U2.
import { type FC } from 'react';
import { PageHeader } from '@/components/t2/PageHeader';

export const NewAdjustment: FC = () => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader title="New adjustment" subtitle="Loading…" />
    </div>
  </div>
);
