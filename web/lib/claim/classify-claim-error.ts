/**
 * Why a claim failed when the SERVER was never the one that refused.
 *
 * ## The gap this closes
 *
 * A claim has two halves that fail differently: the wallet signs, then the
 * backend verifies. A backend refusal arrives as an `ApiError` carrying a
 * machine-readable code, and `refusal.constants.ts` turns that code into a
 * sentence a person can act on. Everything BEFORE the request had no such
 * vocabulary, so `useMerchantClaim`'s catch could only say "Nothing was claimed.
 * Try again." for a missing wallet, a wallet that refused, a wrong chain and a
 * bug, alike.
 *
 * That is what a new account hit: step three of onboarding answered "That name
 * could not be claimed" for a name the backend had already called free, because
 * the failure happened in the wallet and the app had no words for it. The name
 * looked at fault, the person retried the same impossible tap three times, and
 * nothing anywhere recorded what actually threw.
 *
 * ## Same shape as `classify-payment-error.ts`, deliberately
 *
 * That module already answered this question for payments: markers in order, and
 * an unrecognised error gets the calm line PLUS a console entry, because an
 * untranslated failure is the case where the log is the only evidence there will
 * ever be. This is the claim's copy of that decision, narrowed to the two shapes a
 * signature can fail in.
 *
 * ## The ordering is the behaviour
 *
 * "No wallet" is checked before "the wallet did not sign", for the same reason the
 * payment classifier checks gas before funds: the more specific and more
 * actionable diagnosis wins, and Privy's own "Unable to connect to wallet" would
 * otherwise read as a refusal by a wallet the person does not have.
 *
 * The messages here are matched, never rendered. The sentence a person reads comes
 * from `refusal.constants.ts`, keyed by the code this returns, so a claim failure
 * and a payment refusal are one vocabulary rather than two.
 */

/** The two ways a signature step fails, as codes the copy table already speaks. */
export type ClaimWalletFailureCode = 'wallet-missing' | 'wallet-signing-failed';

/**
 * Markers for "there is nothing here that can sign".
 *
 * These are Privy's and our own, in the order they were observed:
 *
 *  - `no embedded wallet` / `no embedded or connected wallet found` — the SDK
 *    found no embedded wallet for the address the app asked about;
 *  - `wallet is not a privy wallet` — the same absence, said by a different branch;
 *  - `disconnected` — the EIP-1193 provider is not connected (JSON-RPC 4900), so
 *    every request through it fails instantly, which is exactly the shape of an
 *    onboarding claim that dies in under 200ms with no prompt;
 *  - `unable to connect to wallet` — the SDK could not re-establish the wallet
 *    before signing.
 *
 * None of these is fixable by pressing the same button, which is the distinction
 * the copy needs: one gets "sign in again", the other gets "try again".
 */
const MISSING_WALLET_MARKERS = [
  'no embedded wallet',
  'no embedded or connected wallet',
  'wallet is not a privy wallet',
  'disconnected',
  'unable to connect to wallet',
  'failed to connect to wallet',
  'wallet not found',
];

/** JSON-RPC 4900 is Privy's "Disconnected", and it is definitive on its own. */
const DISCONNECTED_RPC_CODE = 4900;

/** The error's numeric JSON-RPC code, when it carries one. */
function rpcCode(error: unknown): number | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : null;
}

/**
 * Classify anything thrown between the tap and the request.
 *
 * Never throws, never returns the wallet's own words, and logs the cause on the
 * branch that has to guess: a claim failure with no code is a bug report with no
 * evidence, and this function is the last place the evidence still exists.
 */
export function classifyClaimError(error: unknown): ClaimWalletFailureCode {
  const text = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();

  if (rpcCode(error) === DISCONNECTED_RPC_CODE) return 'wallet-missing';

  if (MISSING_WALLET_MARKERS.some((marker) => text.includes(marker))) {
    return 'wallet-missing';
  }

  // Everything else reached a wallet and came back without a signature: a prompt
  // dismissed in the wallet UI, a chain the wallet will not sign for, a signature
  // the provider returned in a shape we cannot use. Repeating the action is a
  // sensible next step, so it keeps the retryable sentence.
  return 'wallet-signing-failed';
}

/**
 * The same classification, with the cause written down.
 *
 * Kept separate from {@link classifyClaimError} so the pure decision stays pure
 * and testable, and so the logging happens once, at the one call site in
 * `useMerchantClaim`. Every claim failure that never reached the server is
 * otherwise invisible: no request id, no server log line, no row in the database.
 */
export function reportClaimFailure(error: unknown): ClaimWalletFailureCode {
  const code = classifyClaimError(error);

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[claim] failure before the server (${code})`, error);
  } else {
    // Production keeps one line without the object: the message alone is what
    // finds the fault in a browser console when the object is a vendor's class.
    console.error(`[claim] failure before the server (${code}):`, (error as Error | null)?.message);
  }

  return code;
}
