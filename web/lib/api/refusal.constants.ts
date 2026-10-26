/**
 * What a refusal reads like to a person.
 *
 * The server sends a machine-readable `code`, one plain sentence, and a
 * `requestId`; the sentence is written for a log, not for a customer, and it is
 * the raw text of whatever failed — a Prisma error naming a column, a validation
 * message naming a field, a stack-adjacent string. Rendering it verbatim is how
 * the owner came to read a database's vocabulary while signing in.
 *
 * So this file is the OTHER end of that contract: the code goes in, OUR sentence
 * comes out. Three rules hold it together:
 *
 *  1. **Nothing here is the server's text.** Every string is written for a person
 *     and matched by code only.
 *  2. **A payments app says what to do next.** The sentence names the next action
 *     ("check your wallet before trying again"), not the internal fault.
 *  3. **An unknown code is not a hole.** Anything unmapped falls back to a calm,
 *     generic sentence rather than leaking the server's own words.
 *
 * `requestId` is carried (on `ApiError`) rather than rendered: it is what support
 * needs to find the log line, and a customer reading a hex id is being handed the
 * server's problem. A network failure has no code at all and reads as calmly as a
 * refusal, because from the customer's side the two are the same event.
 */

/** One sentence per refusal code. The code is the contract; the words are ours. */
export const REFUSAL_BY_CODE: Record<string, string> = {
  // --- entry the customer can correct -------------------------------------
  'amount-invalid':
    'That is not an amount we can send. Enter a figure with up to two decimal places.',
  'recipient-invalid':
    'That is not a valid address or username. Check it and try again.',
  'recipient-is-self': 'That is this account’s own address. Enter someone else’s.',
  'invalid-address': 'That address is not valid on this network. Check it and try again.',
  'invalid-handle-name':
    'That name is not one Seti can issue. Use 2 to 24 letters, numbers, periods or underscores, not starting or ending with a period.',
  'handle-taken': 'That name is already taken. Choose another one.',
  'reserved-handle': 'That name is reserved. Choose another one.',
  'merchant-not-found':
    'No merchant matches that name or link. Check the spelling, or paste the link again.',

  // --- the claim, once the signature is in ---------------------------------
  // Every one of these is a SPECIFIC reason the claim was refused, so none of
  // them may fall through to the generic sentence: a claim that failed for a
  // reason the person can act on has to say which reason. `address-not-owned` is
  // the one that used to have no sentence at all — the owner's mainnet claim was
  // refused 403 `address-not-owned` and the form could only say "Seti could not
  // complete that. Try again in a moment."
  'address-not-owned':
    'That wallet does not belong to this account. Sign in with the wallet that will receive the payments.',
  'signature-mismatch': 'Your wallet’s signature could not be verified. Try signing again.',
  'invalid-signature': 'Your wallet’s signature could not be verified. Try signing again.',
  'purpose-mismatch': 'Your wallet signed for a different action. Try again.',
  'invalid-issued-at': 'Your wallet’s signature timestamp was rejected. Try signing again.',

  // --- the signature that never happened ----------------------------------
  // Both are reachable BEFORE any request: `lib/claim/classify-claim-error.ts`
  // decides which one, and both used to read as "Nothing was claimed. Try again."
  // A person with no wallet that can sign, and a person whose wallet refused, need
  // different next steps, and the first cannot be fixed by pressing the same
  // button: that is why only one of them offers a retry anywhere.
  //
  // The sentence names a sign-in because that is the fix on every surface that
  // renders it. Onboarding can do better and says so with its own control
  // ("Set up my wallet", `components/onboarding/WalletRepairAction.tsx`), which is
  // offered FIRST there; it does not need its own copy of this sentence to do that,
  // because the meaning has not changed — there is still nothing here that signs.
  'wallet-missing':
    'There is no wallet on this device that can sign, so nothing was claimed. Sign in again to set one up.',
  'wallet-signing-failed':
    'Your wallet did not sign the claim, so nothing was claimed. Try again, and allow the request if your wallet asks.',
  // The wallet exists and is on its way, which is a second, not a fault: the only
  // honest thing to say is that pressing it again in a moment is fine.
  'wallet-not-ready':
    'Your wallet is still getting ready, so nothing was claimed. Try again in a moment.',
  // Setting a wallet up IN PLACE failed (`useEmbeddedWallet` → `repair`). This is
  // the one wallet failure whose cause is the app's own action rather than the
  // device's state, so it says that and then names the fallback — pressing "set up
  // my wallet" again would repeat the same failing call, which is why the surface
  // stops offering it. Before #226 the cause was swallowed by an empty catch and
  // the person saw the same sentence about a wallet that was never coming.
  'wallet-create-failed':
    'Setting up a wallet on this device failed, so nothing was claimed. Sign in again and Seti will create one when you do.',

  // A takedown acts on a NAME, not on money: these are the operator's refusals,
  // and they read as such.
  'handle-not-found': 'No name matches that handle. Nothing was changed.',
  'evidence-required':
    'Reassigning a name needs the evidence that proves the brand. Nothing was changed.',
  'reason-required':
    'Reassigning a name needs the reason the current holder is released. Nothing was changed.',

  // --- a precondition of the payment itself -------------------------------
  'no-active-wallet':
    'This account has no wallet for that token yet. Add money, then try again.',
  'insufficient-funds': 'Not enough to cover this payment. Add money, then try again.',
  // Nothing is signed when the payment cannot come from ONE balance: the money is
  // there, and a payment still spends a single asset (#223). So this sentence must
  // not say "not enough" — that was true of the account and false of the figure
  // beside it, which is the bug. It says where the money is instead, in the
  // customer's currency and never in a token's name, because the screen shows the
  // customer's currency: a balance is a balance, not a stablecoin.
  'no-single-asset-covers':
    'Your money is in more than one balance, and a payment can only come from a single one. Pay a smaller amount, or add money to one balance.',
  'merchant-no-payout-address': 'This merchant has no payout address yet, so it cannot be paid.',
  'send-requires-batch':
    'Sending is not available in this configuration, and nothing left your wallet.',

  // --- the quote moved under the customer ---------------------------------
  'quote-expired': 'That price has expired. Review the new figure before paying.',
  'quote-missing': 'That price has expired. Review the new figure before paying.',
  'quote-invalid': 'That price did not check out. Review the figure before paying again.',
  'quote-not-yours': 'That price was issued for a different account. Start the payment again.',
  'quote-wrong-network': 'That price was issued for another network. Start the payment again.',
  'quote-check-frozen': 'That price could not be confirmed. Review the figure before paying again.',

  // --- the wallet, which the customer can retry ---------------------------
  // (`signature-mismatch`, `invalid-signature`, `purpose-mismatch` and
  // `invalid-issued-at` are above, with the claim they belong to.)
  'signer-mismatch':
    'The wallet that signed is not the one this account is registered with. Sign in again, then retry.',
  'signer-not-declared':
    'The wallet that signed did not identify itself. Sign in again, then retry.',
  'signer-not-owned':
    'That wallet does not belong to this account. Sign in again, then retry.',
  'not-a-token': 'Your session token was not recognised. Sign in again to continue.',
  'session-identity-unknown':
    'Your session does not resolve to an account. Sign in again to continue.',

  // --- the chain, after a signature --------------------------------------
  'receipt-reverted': 'The chain rejected that transfer, and nothing was sent. Try again.',
  'receipt-unavailable':
    'We could not read that transaction from the chain yet. Try again in a moment.',
  'transfer-not-found':
    'That transaction is not visible on-chain yet. Try again in a moment.',
  'amount-mismatch':
    'The amount that settled on-chain did not match the quote, so nothing was recorded. Check your wallet before trying again.',
  'fee-leg-unverified':
    'The fee transfer could not be verified on-chain, so nothing was recorded. Check your wallet before paying again.',

  // --- account, session, configuration ------------------------------------
  unauthorized: 'Your session has ended. Sign in again to continue.',
  'bad-request': 'Something about that request was incomplete. Check the details and try again.',
  'invalid-intent': 'That account mode is not one we recognise. Reload and choose again.',
  'invalid-kind': 'That account mode is not one we recognise. Reload and choose again.',
  'invalid-network': 'That network is not one this build serves. Reload and try again.',
  'mainnet-not-ready': 'Live payments are not switched on for this build yet.',
  'inside-transfer':
    'Sending to a person is paused while this server collects fees inside the transfer. Try again later.',

  // --- the charge path (#131) ---------------------------------------------
  // A charge is a request to be PAID, so these are read by the person who created
  // it (a merchant, in the app or through the API), not by the payer: each one names
  // what to fix. `charge-object.md` listed them as missing copy until #131; that is
  // closed here rather than left to whichever surface rendered them first.
  'charge-signature-invalid':
    'That charge was signed by a different wallet, so it cannot be used. Create it again with the wallet that should receive the money.',
  'charge-signature-contract-wallet':
    'That wallet is a contract account, and charges signed by one cannot be checked yet. Sign the charge from a wallet key instead.',
  'charge-id-invalid':
    'That charge id is not one Seti can issue. Use 6–64 lower-case letters, digits, "-" or "_".',
  'charge-id-taken':
    'That charge id is already in use for this wallet. Create the charge with a new id.',
  'charge-invalid':
    'That charge is incomplete. Check the amount and the expiry, then create it again.',
  'charge-expired': 'That charge has expired, so nothing can be paid on it. Create a new one.',
  'charge-not-pending':
    'That charge is already decided, and nothing leaves a finished charge. Create a new one for another payment.',
  'charge-admin-stale':
    'That signature is too old to use. Sign again and retry.',
  'idempotency-key-reused':
    'That request key was already used for a different charge. Send a new key for a new charge.',
  'webhook-url-invalid':
    'That webhook address cannot be used. It must be an https URL.',
  'rate-limited':
    'Too many requests just now. Wait a moment and try again.',

  // --- the server's own two fault codes -----------------------------------
  // Mapped so they can never be mistaken for "an unknown failure": the generic
  // sentence is reserved for a code this build does not know, and these two ARE
  // known. Both mean nothing was changed, which is the first thing a person needs
  // to hear about a payment app.
  INTERNAL_ERROR:
    'Seti had a problem on our side, and nothing was changed. Try again in a moment.',
  INVALID_REQUEST_BODY: 'That request was incomplete. Reload the page and try again.',
  'client-network-refused':
    'This build decides which network your account is on, so that request was refused. Reload and try again.',
};

/** Anything with no code of its own. Calm, and never the server's words. */
export const REFUSAL_UNKNOWN =
  'Seti could not complete that. Try again in a moment.';

/** Nothing answered at all — offline, DNS, blocked, or the API is down. */
export const REFUSAL_NETWORK =
  'We could not reach Seti. Check your connection and try again.';

/** A request that never reached a verdict is worth trying again. */
export const REFUSAL_NETWORK_STATUS = 0;

/**
 * The sentence for one refusal code, or the generic one.
 *
 * Exported separately from the map so a caller can never accidentally render a
 * code that is in the map but was written for a log line.
 */
export function refusalMessageFor(code: string | undefined | null): string {
  if (!code) return REFUSAL_UNKNOWN;
  return REFUSAL_BY_CODE[code] ?? REFUSAL_UNKNOWN;
}
