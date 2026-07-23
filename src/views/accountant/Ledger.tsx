// Accountant Ledger (/accountant/ledger) — U1 stub; the real register lands in
// U2. Kept minimal so the U1 routes compile and render without crashing.
import { type FC } from 'react';
import { PageHeader } from '@/components/t2/PageHeader';

export const AccountantLedger: FC = () => (
  <div className="min-h-screen bg-gray-50 text-gray-900">
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="Ledger" subtitle="Loading…" />
    </div>
  </div>
);
