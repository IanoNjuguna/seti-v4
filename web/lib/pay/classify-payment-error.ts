/**
 * Why a payment failed, when the cause is actionable.
 *
 * Ported verbatim from `mobile/src/hooks/usePayMerchant.ts:36-120` — the ordering
 * is the behaviour, not a style choice, so do not reorder the checks.
 *
 * Gas is paid in the same stablecoin the customer is spending, so the payment
 * balance and the gas balance move together — but they are not the same thing. A
 * customer can hold 100 and still be unable to pay if the network fee cannot be
 * met from what is left after the transfer. Reporting that as a generic failure
 * makes a precondition look like a bug.
 */
export type PayErrorKind =
  | 'insufficient-gas'
  | 'insufficient-funds'
  | 'rejected'
  | 'unknown';

export interface ClassifiedPaymentError {
  kind: PayErrorKind;
  message: string;
}

export function classifyPaymentError(error: unknown): ClassifiedPaymentError {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.toLowerCase();

  // Node/wallet-level balance and fee failures. Matched BEFORE the generic
  // "insufficient funds" case, because a missing fee balance is the more
  // specific and more actionable diagnosis. `insufficient funds for gas * price
  // + value` contains both markers, which is the case that regresses.
  const gasMarkers = [
    'insufficient funds for gas',
    'insufficient gas',
    'gas required exceeds',
    'max fee per gas',
    'intrinsic gas too low',
    'could not satisfy max cost',
    'fee token',
  ];
  if (gasMarkers.some((marker) => text.includes(marker))) {
    return {
      kind: 'insufficient-gas',
      message:
        'Not enough {ASSET} left to cover the network fee. Add a little, then try again.',
    };
  }

  if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
    return {
      kind: 'insufficient-funds',
      message: 'Not enough {ASSET} to cover this payment.',
    };
  }

  // User declined in the wallet UI, or the wallet reported a rejection.
  if (
    text.includes('rejected') ||
    text.includes('denied') ||
    text.includes('user cancelled') ||
    text.includes('user canceled')
  ) {
    return { kind: 'rejected', message: 'Payment cancelled.' };
  }

  return {
    kind: 'unknown',
    message:
      error instanceof Error && error.message
        ? error.message
        : 'Payment failed. Please try again.',
  };
}
