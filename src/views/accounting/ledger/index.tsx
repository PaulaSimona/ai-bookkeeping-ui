import { FC } from 'react';

// §14 14-C Tier 2 Ledger register. Placeholder heading only (U1); the five-tab
// register body (tabs, filters, table) lands in U2, consuming useLedgerEntries.
// Exported as LedgerRegister to avoid colliding with any other page component.
export const LedgerRegister: FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Ledger</h1>
      </div>
    </div>
  );
};
