// Suppliers page (§14 14-C-2b) — payables side. Thin role config over the
// shared CounterpartyManager; owns its own route (/accounting/suppliers).
import { type FC } from 'react';
import { CounterpartyManager, type RoleConfig } from './CounterpartyManager';

const CONFIG: RoleConfig = {
  role: 'supplier',
  title: 'Suppliers',
  subtitle: "Who you owe, and how long it's been outstanding.",
  totalLabel: 'Total payable',
  columnLabel: 'Supplier',
  noun: 'supplier',
  addLabel: 'Add supplier',
  emptyActive: 'No suppliers yet. Add your first supplier to start tracking payables.',
  emptyArchived: 'No archived suppliers.',
  archivedExplainer:
    'Archiving keeps all history intact — it only removes the supplier from pickers.',
  avatarTint: 'green',
};

export const Suppliers: FC = () => <CounterpartyManager config={CONFIG} />;
