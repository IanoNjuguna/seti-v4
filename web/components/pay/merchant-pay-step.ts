import { COVERAGE_REFUSAL } from '@/lib/pay/quote-asset';
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
  // `no-single-asset-covers` is drawn by the token selector, because beside it sits
  // the balance that can pay it (#228). But the selector draws it in ONE of the
  // refusal's two cases: a pinned token that cannot cover, while another balance can.
  // When no single balance covers, there is nothing to offer, and `buildTokenSelector`
  // says so in its own rule 3 ("the sentence is shown on its own by the step").
  // Suppressing on the CODE alone therefore dropped the sentence in that case and left
  // a pressable `Pay` with no reason above it (#235), so this asks whether the
  // selector is actually drawing something, not whether the code matches. Send solved
  // the same problem the same way (`sendFormFlags`, #232).
  const drawnBySelector =
    payment.errorCode === COVERAGE_REFUSAL && payment.tokenSelector.refusal !== null;
  const blockError = payment.error && !amountError && !drawnBySelector ? payment.error : null;

  return { canPay, amountError, blockError };
}
