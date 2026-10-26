'use client';

import { Button } from '@/components/ui';
import { ONBOARDING_COPY } from './Onboarding.constants';
import type { WalletRepairActionProps } from './Onboarding.types';

/**
 * What a device with no wallet can do about it, in the order it should try.
 *
 * ## Why this is two controls and not one
 *
 * "Sign in again" was the whole answer to a missing wallet, and it is a heavy
 * answer: it ends the session and puts the person through an emailed code to fix
 * something the app can fix with a call. So the repair comes first — it resolves the
 * account's own registered address and, where the account genuinely holds nothing,
 * creates a wallet in place — and signing in stays beside it as the way out when
 * the repair cannot help.
 *
 * When the repair has already been tried and failed, it is gone from here and only
 * the sign-in is left, because a second press of a control whose call has just
 * failed is a button that teaches nothing. The sentence above it says what failed.
 *
 * Both are `Button`s and both sit in the failure block's action slot, so the step
 * keeps one shape whether it can help itself or not.
 */
export function WalletRepairAction({
  showRepair,
  showSignIn,
  repairing,
  onRepair,
  onSignIn,
}: WalletRepairActionProps) {
  return (
    <div className="flex flex-col items-start gap-2">
      {showRepair ? (
        <Button onClick={onRepair} loading={repairing}>
          {ONBOARDING_COPY.setUpWallet}
        </Button>
      ) : null}

      {showSignIn ? (
        <Button variant="secondary" onClick={onSignIn} disabled={repairing}>
          {ONBOARDING_COPY.signInAgain}
        </Button>
      ) : null}
    </div>
  );
}
