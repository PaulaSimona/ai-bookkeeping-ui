import { type FC, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: FC<AppShellProps> = ({ children }) => (
  <div className="flex h-screen bg-gray-50">
    <Sidebar />
    <main className="flex-1 overflow-y-auto">
      {children}
    </main>
  </div>
);
