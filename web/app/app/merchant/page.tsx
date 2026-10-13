'use client';

import { SignInCard } from '@/components/auth/SignInCard';
import { ClaimForm } from '@/components/merchant/ClaimForm';
import { Skeleton } from '@/components/ui';
import { useMerchantClaim } from '@/hooks/useMerchantClaim';
import { useSession } from '@/lib/auth';

/**
 * Claim a business name — `/app/merchant`.
 *
 * Gated like Home, Pay and Activity: a signed-out visitor has no wallet to sign
 * with, so the form would offer a button that can only fail.
 *
 * A route of its own rather than a fifth tab: the tab bar mirrors the mobile
 * app's four destinations exactly, and claiming is something a merchant does
 * once, not a place they live. It is linked from Profile.
 */
export default function MerchantClaimPage() {
  const session = useSession();
  const claim = useMerchantClaim();

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
