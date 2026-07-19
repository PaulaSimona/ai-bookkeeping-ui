import { FC } from 'react';

// §14 14-B Tier 2 client dashboard. Placeholder heading only (C1); the real
// financial-profile cards land in C2, consuming useDashboardSummary. Exported
// as AccountingDashboard to avoid colliding with the Tier 1 Dashboard.
export const AccountingDashboard: FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>
    </div>
  );
};
