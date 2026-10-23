import type { PayeeDisplay } from '@/lib/charges/charge.types';
import { shortAddress } from './pay-public.format';
import type { PayeeIdentity, PayeeTier } from './PayPublic.types';

/**
 * ============================================================================
 * THE TWO PAYEE TIERS (#154), DECIDED IN ONE PLACE.
 * ============================================================================
 *
 * Anyone can make a charge naming any address, so the page owes the payer a distinction
 * it can act on: a merchant Seti has reviewed, or a stranger's request. Both failures this
 * fixes are the same missing distinction — a page that implies trust it has not got, and a
 * page that makes a real shop look like a phishing page.
 *
 * The tier is a STORED fact, never a deduction. It takes three answers, each from a
 * different place, and no fourth thing is allowed to influence it:
 *
 *  1. `payee.kind === 'handle'` — the directory has a Seti name bound to the charge's
 *     recipient address right now (`resolve-payee.ts`). A name that no longer points at
 *     this address is not a name for it, so it never reaches here.
 *  2. `payee.verified` — that binding's claim signature still holds. Recomputed by the
 *     backend from the stored bytes on every read; there is no flag to flip.
 *  3. `payee.merchantVerifiedAt !== null` — a person at Seti reviewed the merchant record
 *     and recorded what they reviewed (`merchants."verifiedAt"` plus its evidence).
 *
 * Volume, age, the amount, the memo, the currency and the payer's own declaration are all
 * deliberately absent: a page that guessed would be selling a trust signal it does not hold.
 *
 * WHAT THE TIER IS NOT. It never says Seti holds the money, never guarantees a payment or
 * a refund, and never says Seti pays the merchant. The money goes to the address on the
 * charge in both tiers, which is why the address, our facilitated-by line and the charge id
 * stay on the page whichever tier draws. The difference is the name and the mark.
 */
export function payeeTier(payee: PayeeDisplay): PayeeTier {
  if (payee.kind !== 'handle') return 'unverified';
  if (!payee.verified) return 'unverified';
  if (payee.merchantVerifiedAt === null) return 'unverified';

  return 'verified';
}

/**
 * The recipient as every string a block draws, so the components hold no branches.
 *
 * The heading is the tier's whole visual argument: a reviewed merchant gets its NAME, and
 * everything else gets `@handle` or the short address. That is not cosmetic. A name is the
 * one thing on this page a screenshot can be forged from, so a name only appears where a
 * person has reviewed the merchant behind it — a claim whose signature lapsed keeps its
 * handle and loses the name, which is exactly what #154 asks for ("cannot display a logo
 * or a name it did not sign for").
 */
export function payeeIdentity(payee: PayeeDisplay): PayeeIdentity {
  const tier = payeeTier(payee);
  const fullAddress = payee.address;
  const address = shortAddress(fullAddress);

  if (payee.kind === 'address') {
    return {
      tier,
      heading: address,
      headingIsAddress: true,
      address,
      fullAddress,
      handle: null,
      showAddressLine: false,
      noName: true,
    };
  }

  const named = tier === 'verified';

  return {
    tier,
    heading: named ? payee.name : `@${payee.handle}`,
    headingIsAddress: false,
    address,
    fullAddress,
    handle: payee.handle,
    showAddressLine: true,
    noName: false,
  };
}
