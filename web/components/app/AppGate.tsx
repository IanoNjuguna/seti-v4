'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccountIdentity } from '@/lib/account';
import { useSession } from '@/lib/auth';
import { AppLoading } from './AppLoading';
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
    /*
      NOTHING runs on the way in any more. This branch used to mount a settlement pass
      that converted bridged stablecoins into OUSD a few seconds after the app opened,
      signed by the customer's own wallet — money moving because a screen appeared,
      under a UI that now shows each token as itself (#222). A wallet may not move a
      balance the customer did not ask it to move, and "they opened the app" is not an
      instruction. `useSettlementRunner` stays in the tree for a swap the customer
      actually asks for; the planner and its record path stay for the same reason.
      `check:balances` fails if anything mounts it here again.
    */
    return <AppShell>{children}</AppShell>;
  }

  // A redirect is in flight. The destination's own surfaces must not paint in the
  // meantime — that frame is the half-onboarded state this gate exists to refuse.
  return <AppLoading />;
}
