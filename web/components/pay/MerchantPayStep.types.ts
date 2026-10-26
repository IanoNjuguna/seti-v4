import type { UsePayMerchantReturn } from '@/hooks/usePayMerchant.types';

export interface MerchantPayStepProps {
  /** The payment machinery for the resolved merchant, owned by the caller. */
  payment: UsePayMerchantReturn;
  /** Cancel: reset the payment, and put the customer back at the step before. */
  onCancel: () => void;
}

/**
 * What the pay step's controls need from the payment, derived in one place.
 *
 * Pure and deliberately outside the component: `canPay` decides whether `Pay` is
 * pressable, `amountError` decides which message lands ON the amount field, and
 * `blockError` decides which one is about the payment as a whole. Three
 * derivations read in JSX is how a failed payment ends up blaming the customer's
 * arithmetic for a wallet problem.
 */
export interface MerchantPayStepFlags {
  canPay: boolean;
  amountError: string | undefined;
  blockError: string | null;
}

export interface MerchantPaySuccessProps {
  /** The payment that landed — its quote and merchant name are the receipt. */
  payment: UsePayMerchantReturn;
}

/** What the amount section draws: the payment, and the message the field carries. */
export interface MerchantAmountSectionProps {
  payment: UsePayMerchantReturn;
  /** The field's own error — only a balance problem belongs there. */
  amountError: string | undefined;
}
