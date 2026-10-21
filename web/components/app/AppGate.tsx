'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccountIdentity } from '@/lib/account';
import { useSession } from '@/lib/auth';
import { AppLoading } from './AppLoading';
import { SettlementRunner } from './SettlementRunner';
import { AppShell } from './AppShell';
import { ONBOARDING_PATH } from './AppGate.constants';
import { decideGatePlacement, isOnboardingRoute } from './gate-decision';
import type { AppGateProps } from './AppGate.types';

/**
 * The onboarding gate that wraps every `/app` surface.
 *
 * It answers one question — does this account hold a handle? — from the server's
 * own derived answer (`GET /account`), and it is the ONLY place that decides
 * whether the app renders. A URL is not a way in: a direct hit on `/app/activity`
 * is the same code path as a tap on the tab bar, so an account without a handle
 * is sent to onboarding wherever it lands, including on a first paint by URL.
 *
 * The decision itself is pure and lives in `gate-decision.ts`; this component
 * only renders the outcome and performs the navigation it implies.
 */
export function AppGate({ children }: AppGateProps) {
  const session = useSession();
  const account = useAccountIdentity();
  const pathname = usePathname();
  const router = useRouter();

  const placement = decideGatePlacement({
    sessionLoading: session.status === 'restoring',
    identityLoading: account.loading,
    authenticated: session.isAuthenticated,
    onboarded: account.onboarded,
    onOnboardingRoute: isOnboardingRoute(pathname, ONBOARDING_PATH),
  });

  useEffect(() => {
    if (placement === 'redirect-to-onboarding') router.replace(ONBOARDING_PATH);
  }, [placement, router]);

  if (placement === 'loading') return <AppLoading />;
  if (placement === 'onboarding') return <>{children}</>;
  if (placement === 'shell') {
    return (
      <>
        {/*
          The settlement pass lives here rather than in the layout because this is
          the one branch that means "an onboarded account with a wallet, on a real
          app surface". It renders nothing; it signs a swap into OUSD only while
          the customer has the app open, which is the only time their own wallet can
          sign. See useSettlementRunner.
        */}
        <SettlementRunner />
        <AppShell>{children}</AppShell>
      </>
    );
  }

  // A redirect is in flight. The destination's own surfaces must not paint in the
  // meantime — that frame is the half-onboarded state this gate exists to refuse.
  return <AppLoading />;
}
