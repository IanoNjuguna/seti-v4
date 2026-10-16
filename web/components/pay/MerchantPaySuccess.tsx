'use client';

import { PaySuccess } from './PaySuccess';
import type { MerchantPaySuccessProps } from './MerchantPayStep.types';

/**
 * The merchant step, done: the receipt for the payment that just landed.
 *
 * It lives INSIDE the step because a payment that landed is the same step
 * completed — the flow above does not need to know that the merchant branch has a
 * third state of its own. Every figure comes from the server's own quote and the
 * merchant's own profile: nothing here recomputes an amount, which is the whole
 * reason the summary is passed rather than derived from the field.
 *
 * `gasEstimated` is carried through as the server stated it: an estimated network
 * fee is a different claim from a settled one, and the receipt says which it is.
 */
export function MerchantPaySuccess({ payment }: MerchantPaySuccessProps) {
  const preview = payment.preview;
  const merchant = payment.merchant;

  const summary =
    preview && merchant
      ? {
          merchant: merchant.name,
          amountFiat: preview.fiatAmount,
          feeFiat: preview.feeFiat,
          networkFeeFiat: preview.networkFeeFiat,
          totalFiat: preview.totalFiat,
          fiatCurrency: preview.fiatCurrency,
          gasEstimated: preview.networkFeeSource === 'estimate',
        }
      : null;

  return (
    <PaySuccess txHash={payment.txHash} onDone={() => payment.reset()} summary={summary} />
  );
}
