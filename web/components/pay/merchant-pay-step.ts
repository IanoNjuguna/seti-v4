import type { UsePayMerchantReturn } from '@/hooks/usePayMerchant.types';
import type { MerchantPayStepFlags } from './MerchantPayStep.types';

/**
 * The pay step's own arithmetic, as one pure function.
 *
 * A draft state only blocks `Pay` for the reasons Pay can actually act on: an
 * empty or zero amount, a step already in flight, and a balance the server has
 * already said is short. A wallet that is missing, a rejected signature or a
 * server refusal are NOT amount problems — those are reported by the step itself
 * and must leave `Pay` pressable, because the customer has just been told how to
 * fix them.
 */
export function merchantPayStepFlags(payment: UsePayMerchantReturn): MerchantPayStepFlags {
  const amountIsValid = payment.amount !== '' && Number(payment.amount) > 0;
  const canPay =
    amountIsValid &&
    !payment.isBusy &&
    !payment.previewLoading &&
    payment.preview?.hasEnoughBalance !== false;

  // Only a balance problem is the customer's entry, so only that one belongs on
  // the field; a wallet/config/rejection failure is not an amount problem.
  const amountError =
    payment.errorKind === 'insufficient-funds' ? (payment.error ?? undefined) : undefined;
  const blockError = payment.error && !amountError ? payment.error : null;

  return { canPay, amountError, blockError };
}
