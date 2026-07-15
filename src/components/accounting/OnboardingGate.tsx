// Onboarding soft-gate (§14 14A-2 — rulings D1-as-amended, D-14A2-2, D-14A2-3).
// Two-layer structure so Tier 1 users NEVER trigger the org fetch:
//   - Outer OnboardingGate: Redux-only tier check, same flag derivation as
//     RequireStaffOrSuperuser. Non-staff → children returned as-is: no hook
//     mounts, no fetch, zero Tier 1 cost. Interim gate per D-14A2-2.
//     TODO: swap to Tier 2 subscription check when Advanced plan is live
//   - Inner gated layer: useOrgMe-driven banner + once-per-session redirect.
//     Never a wall (D1): children render under ALL states — loading included —
//     and uploads/every other page stay reachable after the single redirect.
import { type FC, type PropsWithChildren, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import { useOrgMe } from '@/hooks/useAccounts';

const REDIRECT_FLAG = 'onboarding_redirect_done';

const GatedLayer: FC<PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasTaxProfile, openingBalanceChoice, isLoading, refetch } = useOrgMe();

  // Refresh org state on navigation: this is a SEPARATE useOrgMe instance from
  // the wizard's (no shared cache), so finishing a step inside /onboarding
  // would otherwise leave this gate stale until a full reload. Skip the first
  // run — the hook's own mount effect already fetched. Staff-gated, so the
  // per-navigation GET costs Tier 1 users nothing.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    refetch();
  }, [pathname, refetch]);

  // Once-per-session redirect (D1 first-login + D-14A2-3): keys on
  // hasTaxProfile === false ONLY — STRICT (F-14A2-a). The contract says
  // has_tax_profile is a real boolean, never null, so undefined here means
  // "org load failed / state unknown", and a soft-gate must fail SILENT on an
  // error state — inert: no redirect, no banner, children as-is. The flag is
  // set FIRST so nothing can ever loop the user back — one redirect per
  // browser session, then every page (uploads included) stays reachable: a
  // nudge, never a wall. No redirect mid-load.
  useEffect(() => {
    if (isLoading) return;
    if (hasTaxProfile !== false) return;
    if (pathname === '/onboarding') return;
    if (sessionStorage.getItem(REDIRECT_FLAG)) return;
    sessionStorage.setItem(REDIRECT_FLAG, '1');
    navigate('/onboarding');
  }, [isLoading, hasTaxProfile, pathname, navigate]);

  // Banner only on KNOWN-incomplete states (strict boolean checks — undefined
  // = unknown = inert, never nag on a failed load).
  const showBanner =
    !isLoading &&
    pathname !== '/onboarding' &&
    (hasTaxProfile === false || (hasTaxProfile === true && openingBalanceChoice == null));

  return (
    <>
      {showBanner && (
        <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-sm text-amber-800">
          <span className="flex-1">
            Finish setting up your books — the accounting agent can't post documents until setup is complete.
          </span>
          <Link
            to="/onboarding"
            className="shrink-0 font-semibold text-amber-900 underline hover:text-amber-700"
          >
            Finish setup
          </Link>
        </div>
      )}
      {children}
    </>
  );
};

export const OnboardingGate: FC<PropsWithChildren> = ({ children }) => {
  const auth = useSelector((s: RootState) => s.auth);
  const isStaff = auth.user?.user?.is_staff ?? auth.user?.is_staff ?? false;
  const isSuperuser = auth.user?.user?.is_superuser ?? auth.user?.is_superuser ?? false;

  // Interim tier scope (D-14A2-2): non-staff Tier 1 users bypass the gated
  // layer entirely — the org fetch never happens for them.
  // TODO: swap to Tier 2 subscription check when Advanced plan is live
  if (!isStaff && !isSuperuser) return <>{children}</>;

  return <GatedLayer>{children}</GatedLayer>;
};
