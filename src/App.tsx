// v2 pricing flow
import { type FC } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { useUser } from '@/api/user/useUser';
import { RedirectPage } from '@/components/Redirect';
import { PageLoader } from '@/components/Loader';
import { AppShell } from '@/components/Layout/AppShell';
import { Login } from '@/views/auth/Login';
import { Register } from '@/views/auth/Register';
import { CheckEmail } from '@/views/auth/CheckEmail';
import { VerifyEmail } from '@/views/auth/VerifyEmail';
import { ForgotPassword } from '@/views/auth/ForgotPassword';
import { ResetPassword } from '@/views/auth/ResetPassword';
import { Dashboard } from '@/views/dashboard';
import { Documents } from '@/views/documents';
import { Workbook } from '@/views/workbook';
import { Reports } from '@/views/reports';
import { Settings } from '@/views/settings';
import { Support } from '@/views/support';
import { Feedback } from '@/views/feedback';
import { Subscription, SubscriptionSuccess } from '@/views/subscription';
import { Pricing } from '@/views/pricing';
import { PrivacyPolicy } from '@/views/legal/PrivacyPolicy';
import { TermsOfService } from '@/views/legal/TermsOfService';
import { ReviewerDashboard } from '@/views/reviewer';

const PrivateLayout: FC = () => (
  <RedirectPage privatePath>
    <AppShell>
      <Outlet />
    </AppShell>
  </RedirectPage>
);

// Unauthenticated → /pricing, authenticated → /dashboard
const HomeRedirect: FC = () => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);
  if (inProgress) return <PageLoader />;
  return <Navigate to={user ? '/dashboard' : '/pricing'} replace />;
};

const App: FC = () => {
  const { getUser } = useUser(true);

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/pricing"          element={<Pricing />} />
      <Route path="/login"        element={<RedirectPage><Login getUser={getUser} /></RedirectPage>} />
      <Route path="/register"     element={<RedirectPage><Register /></RedirectPage>} />
      <Route path="/check-email"     element={<CheckEmail />} />
      <Route path="/verify-email"    element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />
      <Route path="/privacy-policy"   element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />

      <Route element={<PrivateLayout />}>
        <Route path="/dashboard"            element={<Dashboard />} />
        <Route path="/documents"            element={<Documents />} />
        <Route path="/workbook"             element={<Workbook />} />
        <Route path="/reports"              element={<Reports />} />
        <Route path="/settings"             element={<Settings />} />
        <Route path="/support"              element={<Support />} />
        <Route path="/feedback"             element={<Feedback />} />
        <Route path="/subscription"         element={<Subscription />} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/reviewer"             element={<ReviewerDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
