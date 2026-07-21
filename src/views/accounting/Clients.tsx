// Clients page (§14 14-C-2b) — receivables side. Thin role config over the
// shared CounterpartyManager; owns its own route (/accounting/clients).
import { type FC } from 'react';
import { CounterpartyManager, type RoleConfig } from './CounterpartyManager';

const CONFIG: RoleConfig = {
  role: 'client',
  title: 'Clients',
  subtitle: "Who owes you money, and how long it's been outstanding.",
  totalLabel: 'Total receivable',
  columnLabel: 'Client',
  noun: 'client',
  addLabel: 'Add client',
  emptyActive: 'No clients yet. Add your first client to start tracking receivables.',
  emptyArchived:
    'No archived clients. Archiving keeps all history intact — it only removes the client from pickers.',
  archivedExplainer:
    'Archiving keeps all history intact — it only removes the client from new-invoice pickers.',
  avatarTint: 'blue',
};

export const Clients: FC = () => <CounterpartyManager config={CONFIG} />;
