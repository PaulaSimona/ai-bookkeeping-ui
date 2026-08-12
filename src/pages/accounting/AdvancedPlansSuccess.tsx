// Bookkeeping Service checkout success page (S45 §21 Chain C, route
// /accounting/subscription/success). Ratified flow (a) with O-S45-1(c) bounds:
// a self-contained poll of GET /api/user/me waiting for has_tier2 to flip true
// after the Stripe webhook grants entitlement, then route into onboarding.
//
// The poll is deliberately NOT the getUser callback (that self-limits to 3
// retries). Interval 2s, max 30 attempts (60s), cleared on unmount. On the flip
// it dispatches the same setUser update the app uses (merged over the current
// user so staff/other flags are preserved), then navigates to /onboarding.
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from '@/store/store';
import { setUser } from '@/store/features/authSlice';
import { hasTier2Of } from '@/utils/activeOrg';
import api from '@/utils/api';

const INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30;

export const AdvancedPlansSuccess: FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const current = useSelector((s: RootState) => s.auth.user);

  // Keep the latest store user available inside the interval closure without
  // re-arming the interval on every render.
  const currentRef = useRef(current);
  currentRef.current = current;

  const [phase, setPhase] = useState<'polling' | 'timeout'>('polling');
  const attempts = useRef(0);
  const finished = useRef(false);

  // One /me check. Returns true (and applies the entitlement flip to the store)
  // when has_tier2 is now true.
  const checkOnce = useCallback(async (): Promise<boolean> => {
    const res = await api.get('/api/user/me');
    if (res == null || res.status !== 200) return false;
    const me = res.data;
    if (hasTier2Of(me)) {
      const prev = currentRef.current ?? {};
      const merged = {
        ...prev,
        ...me,
        user: { ...(prev.user ?? {}), ...(me.user ?? {}) },
      };
      dispatch(setUser(merged));
      return true;
    }
    return false;
  }, [dispatch]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (finished.current) return;
      attempts.current += 1;
      const ok = await checkOnce();
      if (ok) {
        finished.current = true;
        clearInterval(id);
        navigate('/onboarding');
        return;
      }
      if (attempts.current >= MAX_ATTEMPTS) {
        finished.current = true;
        clearInterval(id);
        setPhase('timeout');
      }
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkOnce, navigate]);

  const handleCheckAgain = async () => {
    const ok = await checkOnce();
    if (ok) navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {phase === 'polling' ? (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Activating your subscription…</h1>
              <p className="mt-1 text-sm text-gray-500">
                Payment received. We’re turning on your Bookkeeping Service — this takes a few seconds.
              </p>
            </div>
            {/* Loading skeleton (TaxProfile precedent) */}
            <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
                  <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Your subscription is being activated</h1>
              <p className="mt-1 text-sm text-gray-500">
                This can take a moment. You can check again, or come back shortly — your access will be
                ready soon.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCheckAgain}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Check again
              </button>
              <button
                type="button"
                onClick={() => navigate('/accounting/subscription')}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                Back to plans
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
