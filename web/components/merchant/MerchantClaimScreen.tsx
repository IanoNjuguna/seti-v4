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
 */
export function MerchantClaimScreen({ kind }: MerchantClaimScreenProps) {
  const session = useSession();
  const claim = useMerchantClaim(kind);

  useClaimedIdentitySync(claim.step === 'done');

  if (session.status === 'loading') {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!session.isAuthenticated) {
    return (
      <SignInCard
        onSignIn={() => void session.signIn()}
        error={session.error}
        source={session.source}
        pending={session.signingIn}
      />
    );
  }

  return <ClaimForm claim={claim} />;
}
