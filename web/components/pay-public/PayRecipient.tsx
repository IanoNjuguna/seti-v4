import { Text } from '@/components/ui';
import { PAY_COPY } from './PayPublic.constants';
import { payeeIdentity } from './pay-public.tier';
import { PayFacilitatorNote } from './PayFacilitatorNote';
import { PayRecipientUnverified } from './PayRecipientUnverified';
import { PayRecipientVerified } from './PayRecipientVerified';
import type { PayRecipientProps } from './PayPublic.types';

/**
 * Who is being paid, in the two tiers #154 defines.
 *
 * The two blocks are separate files because they are different READINGS, not two branches
 * of one layout: a verified merchant is "this business, and here is where the money goes",
 * an unverified one is "this handle or this address, and Seti has not verified it". Keeping
 * them in one file invites a shared layout that flattens the distinction, which is exactly
 * how a name-shaped heading ends up over a stranger's wallet.
 *
 * Under both, the same `PayFacilitatorNote`: our mark on the page is a claim about what we
 * did, so it comes with the charge id on every request, verified or not. The tier changes
 * the name and the mark. It changes nothing about the money.
 *
 * All of it is decided in `pay-public.tier.ts` from what the server resolved. Nothing here
 * reads a query parameter: a payer cannot put a name on this page.
 */
export function PayRecipient({ payee, chargeId }: PayRecipientProps) {
  const identity = payeeIdentity(payee);

  return (
    <div>
      <Text variant="micro" as="p">
        {PAY_COPY.payeeEyebrow}
      </Text>

      {identity.tier === 'verified' ? (
        <PayRecipientVerified identity={identity} />
      ) : (
        <PayRecipientUnverified identity={identity} />
      )}

      <PayFacilitatorNote chargeId={chargeId} />
    </div>
  );
}
