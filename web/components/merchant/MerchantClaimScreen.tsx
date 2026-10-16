'use client';

import { SignInCard } from '@/components/auth/SignInCard';
import { ClaimForm } from '@/components/merchant/ClaimForm';
import { Skeleton } from '@/components/ui';
import { useClaimedIdentitySync } from '@/hooks/useClaimedIdentitySync';
import { useMerchantClaim } from '@/hooks/useMerchantClaim';
import { useSession } from '@/lib/auth';
import type { HandleKind } from '@/lib/api';

export interface MerchantClaimScreenProps {
  /** Which kind of handle this screen claims — decides the copy and the purpose signed. */
  kind: HandleKind;
}

/**
 * Claim a name — the same form for a username and a business name.
 *
 * The KIND is the only thing that varies: it picks the copy and, through the claim
 * hook, the `purpose` the wallet signs. One form, one namespace, one claim path.
 *
 * A landed claim re-reads the account (`useClaimedIdentitySync`), because the gate
 * and the Profile card read that one answer: without it the row would exist in the
 * database while Profile still showed "no business name yet".
 *
 * The `restoring` branch is the app's own loading convention — an `aria-busy`
 * region with a line a screen reader can hear — because a bare skeleton is a
 * screen with nothing to say: no title, no status, no announcement. `AppLoading`
 * and `SendLoading` carry the same shape for the same reason.
 */
export function MerchantClaimScreen({ kind }: MerchantClaimScreenProps) {
  const session = useSession();
  const claim = useMerchantClaim(kind);

  useClaimedIdentitySync(claim.step === 'done');

  if (session.status === 'restoring') {
    return (
      <div aria-busy="true">
        <p className="sr-only">Checking your session…</p>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!session.isAuthenticated) {
    return <SignInCard error={session.error} />;
  }

  return <ClaimForm claim={claim} />;
}
