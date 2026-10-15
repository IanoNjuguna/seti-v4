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

  // The token contract's own refusal, which is what a Tempo transfer that cannot
  // be paid for actually returns:
  //
  //   Execution reverted with reason: TIP20 token error: InsufficientBalance(
  //     InsufficientBalance { available: 0, required: 154172089, token: 0x20c0… })
  //
  // Before this case existed the text matched none of the markers below, so it fell
  // through to the fallback and printed the whole revert — a Rust enum, a raw token
  // amount and a contract address — on a payment screen. `available: 0` and
  // `required` in base units are ours to translate, not the customer's to decode.
  if (
    text.includes('insufficientbalance') ||
    text.includes('insufficient balance') ||
    text.includes('insufficient funds') ||
    text.includes('exceeds balance')
  ) {
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

  // The wallet SDK refusing the chain. Privy reports `Unsupported chainId 42431`
  // (PrivyConnectorError 4901) when the chain it is asked to sign for is not in
  // `config.supportedChains`, and a connector mismatch when the wallet is sitting
  // on a different chain than the transaction names. Both are one thing to the
  // customer — this wallet cannot sign this transfer right now — and neither is
  // retryable without something changing first.
  if (
    text.includes('unsupported chain') ||
    text.includes('privyconnectorerror') ||
    text.includes('chain mismatch') ||
    text.includes('connectorchainmismatch')
  ) {
    return {
      kind: 'unknown',
      message: 'This wallet cannot sign for the network this transfer is on. Nothing was sent.',
    };
  }

  // Nothing matched, and the customer gets the calm line rather than whatever the
  // wallet or the node said. A vendor's phrasing in the middle of a payment screen
  // is the failure this classifier exists to prevent — an unrecognised error is the
  // case where that matters MOST, because it is the one nobody has translated yet.
  //
  // The cause still goes to the console. A refusal whose reason is invisible is a
  // bug report with no evidence, and this branch is only reachable for an error no
  // marker above recognises — so the log is the one place it can be found.
  console.error('[payment] unclassified failure', error);

  // And on a DEV build the cause also rides in the sentence, because a stack in a
  // console the developer has not opened is the same as no evidence at all. Gated
  // on NODE_ENV so a customer never sees it: the shipped line is the calm one, and
  // an unclassified error is exactly the case where somebody has to see the raw
  // text to add the marker it is missing.
  const cause = error instanceof Error ? error.message : String(error ?? 'unknown error');

  return {
    kind: 'unknown',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Payment failed. Please try again.'
        : `Payment failed. Please try again. — dev: ${cause.split('\n')[0].slice(0, 180)}`,
  };
}
