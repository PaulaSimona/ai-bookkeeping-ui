// v2 pricing flow
import { type FC, type PropsWithChildren, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import { StaffInviteAccept } from '@/views/auth/StaffInviteAccept';
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
import { LandingPage } from '@/pages/LandingPage';
import { ChartOfAccounts } from '@/pages/accounts/ChartOfAccounts';
import { BankConnections } from '@/views/accounting/BankConnections';
import { DocumentsPage } from '@/views/accounting/DocumentsPage';
import { AccountingDashboard } from '@/views/accounting/dashboard';
import { PlaidOauthCallback } from '@/views/accounting/PlaidOauthCallback';
import { AccountingReview } from '@/pages/accounting/AccountingReview';
import { TaxProfile } from '@/pages/accounting/TaxProfile';
import { Onboarding } from '@/pages/accounting/Onboarding';
import { OnboardingGate } from '@/components/accounting/OnboardingGate';
import { ReviewerManagement } from '@/pages/accounting/ReviewerManagement';
import { BlogList } from '@/views/blog/BlogList';
import { BlogPost } from '@/views/blog/BlogPost';
import { FAQ } from '@/views/faq';

const PrivateLayout: FC = () => (
  <RedirectPage privatePath>
    <AppShell>
      {/* Onboarding soft-gate (§14 14A-2): banner + once-per-session redirect,
          tier-scoped inside the component — Tier 1 users pass through with
          zero cost. Mounted here (not in AppShell, which is Tier 1-shared). */}
      <OnboardingGate>
        <Outlet />
      </OnboardingGate>
    </AppShell>
  </RedirectPage>
);

// Unauthenticated → landing page; authenticated → Tier 2 users land on the
// Tier 2 dashboard, everyone else keeps today's /documents landing (D-14B-7).
const HomeRedirect: FC = () => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);
  const hasTier2 = user?.user?.has_tier2 ?? user?.has_tier2 ?? false;
  if (inProgress) return <PageLoader />;
  if (user) return <Navigate to={hasTier2 ? '/accounting/dashboard' : '/documents'} replace />;
  return <LandingPage />;
};

// Tier 2 feature route guards. Mirror the /reviewer page's auth check
// (auth.user flags, wait out inProgress, redirect to /dashboard) but enforce it
// at the route so a Tier 1 user can't reach the page by typing the URL.
// §21: /accounts + /reviewer-management stay superuser (staff tools). Chart of
// Accounts is exposed to Tier 2 users deliberately at §14 — no swap here yet.
const RequireSuperuser: FC<PropsWithChildren> = ({ children }) => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);
  const isSuperuser = user?.user?.is_superuser ?? user?.is_superuser ?? false;
  if (inProgress) return <PageLoader />;
  if (!isSuperuser) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// §21: retained for the staff-only Accounting Review queue (internal reviewer
// surface) — deliberately NOT swapped to the Tier 2 entitlement gate (D-21-4).
const RequireStaffOrSuperuser: FC<PropsWithChildren> = ({ children }) => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);
  const isStaff = user?.user?.is_staff ?? user?.is_staff ?? false;
  const isSuperuser = user?.user?.is_superuser ?? user?.is_superuser ?? false;
  if (inProgress) return <PageLoader />;
  if (!isStaff && !isSuperuser) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// §21 Tier 2 entitlement gate (D-21-4, 2026-07-18) — user Tier 2 surfaces render
// iff the account has Tier 2 access (has_tier2: an active membership in an
// entitled org). Replaces the interim staff/superuser gate on client Tier 2
// pages; mirrors RequireStaffOrSuperuser (inProgress → loader, else /dashboard).
const RequireTier2: FC<PropsWithChildren> = ({ children }) => {
  const { user, inProgress } = useSelector((s: RootState) => s.auth);
  const hasTier2 = user?.user?.has_tier2 ?? user?.has_tier2 ?? false;
  if (inProgress) return <PageLoader />;
  if (!hasTier2) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App: FC = () => {
  const { getUser } = useUser(true);
  const location = useLocation();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gtag?.('event', 'page_view', {
      page_path: location.pathname + location.search,
    });
  }, [location]);

  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/pricing"           element={<Pricing />} />
      <Route path="/login"             element={<RedirectPage><Login getUser={getUser} /></RedirectPage>} />
      <Route path="/register"          element={<RedirectPage><Register /></RedirectPage>} />
      <Route path="/check-email"       element={<CheckEmail />} />
      <Route path="/verify-email"      element={<VerifyEmail />} />
      <Route path="/forgot-password"   element={<ForgotPassword />} />
      <Route path="/reset-password"    element={<ResetPassword />} />
      <Route path="/staff-invite/accept" element={<StaffInviteAccept />} />
      <Route path="/privacy-policy"    element={<PrivacyPolicy />} />
      <Route path="/terms-of-service"  element={<TermsOfService />} />
      <Route path="/blog"              element={<BlogList />} />
      <Route path="/blog/:slug"        element={<BlogPost />} />
      <Route path="/faq"               element={<FAQ />} />

      <Route element={<PrivateLayout />}>
        <Route path="/dashboard"            element={<Dashboard />} />
        <Route path="/documents"            element={<Documents />} />
        <Route path="/workbook"             element={<Workbook />} />
        <Route path="/reports"              element={<Reports />} />
        <Route path="/settings"             element={<Settings />} />
        {/* Tier 2 user features — §21 Tier 2 entitlement gate (owner gating is
            also enforced inside each page via useOrgMe()). */}
        {/* §21 gate swap DONE (D-21-4, 2026-07-18) — was interim staff/superuser. */}
        <Route path="/accounting/dashboard" element={<RequireTier2><AccountingDashboard /></RequireTier2>} />
        <Route path="/accounting/tax-profile" element={<RequireTier2><TaxProfile /></RequireTier2>} />
        <Route path="/accounting/bank-connections" element={<RequireTier2><BankConnections /></RequireTier2>} />
        <Route path="/accounting/documents" element={<RequireTier2><DocumentsPage /></RequireTier2>} />
        {/* Onboarding wizard (§14 14A-2) — §21 gate swap DONE (D-21-4, 2026-07-18). */}
        <Route path="/onboarding" element={<RequireTier2><Onboarding /></RequireTier2>} />
        {/* MUST match the Plaid-registered redirect URI verbatim
            (https://ai-bookkeeping.ai/plaid/oauth-callback) — do not rename.
            Deliberately NOT under /accounting: the registered URI has no prefix. */}
        <Route path="/plaid/oauth-callback" element={<PlaidOauthCallback />} />
        <Route path="/support"              element={<Support />} />
        <Route path="/feedback"             element={<Feedback />} />
        <Route path="/subscription"         element={<Subscription />} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/reviewer"             element={<ReviewerDashboard />} />
        <Route path="/accounts"             element={<RequireSuperuser><ChartOfAccounts /></RequireSuperuser>} />
        <Route path="/reviewer-management"  element={<RequireSuperuser><ReviewerManagement /></RequireSuperuser>} />
        <Route path="/accounting-review"    element={<RequireStaffOrSuperuser><AccountingReview /></RequireStaffOrSuperuser>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
