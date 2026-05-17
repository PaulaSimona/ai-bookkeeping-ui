import { type FC } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useUser } from '@/api/user/useUser';
import { RedirectPage } from '@/components/Redirect';
import { AppShell } from '@/components/Layout/AppShell';
import { Login } from '@/views/auth/Login';
import { Register } from '@/views/auth/Register';
import { Dashboard } from '@/views/dashboard';
import { Documents } from '@/views/documents';
import { Workbook } from '@/views/workbook';
import { Reports } from '@/views/reports';
import { Settings } from '@/views/settings';
import { Support } from '@/views/support';

const PrivateLayout: FC = () => (
  <RedirectPage privatePath>
    <AppShell>
      <Outlet />
    </AppShell>
  </RedirectPage>
);

const App: FC = () => {
  const { getUser } = useUser(true);

  return (
    <Routes>
      {/* Root — always redirect to /dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public */}
      <Route
        path="/login"
        element={
          <RedirectPage>
            <Login getUser={getUser} />
          </RedirectPage>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectPage>
            <Register getUser={getUser} />
          </RedirectPage>
        }
      />

      {/* Private — inside AppShell with sidebar */}
      <Route element={<PrivateLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/workbook"  element={<Workbook />} />
        <Route path="/reports"   element={<Reports />} />
        <Route path="/settings"  element={<Settings />} />
        <Route path="/support"   element={<Support />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
