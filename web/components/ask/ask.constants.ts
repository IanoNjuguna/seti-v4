/**
 * Everything the ask screen says, in one place (#465).
 *
 * The rules the copy follows: second person, no jargon, and never a promise the record cannot keep.
 * That last one is why nothing here says "one payment settles this": an ask can be paid once today,
 * and whether it can be paid twice is #449, still undecided.
 */
export const ASK_COPY = {
  /*
   * The thing is a CLAIM, in the customer's words, everywhere it is offered. It is still an `ask` in
   * this module and in the API (`claimPublicId` on a payment, `publicId` on the record), because the
   * two names describe two different readers: the customer sees what they sent, the code sees a link
   * that a payment may name. Renaming the internal half would have touched a table and a route for a
   * word only the UI needed (#465).
   */
  title: 'Claim',
  subtitle: 'Send a link with the amount in it. They pay it with any Seti link, or by scanning your QR.',
  amountLabel: 'Amount',
  amountPlaceholder: '0.00',
  memoLabel: 'What is it for',
  memoPlaceholder: 'Rent, half the taxi, the haircut',
  payeeLabel: 'Paid to',
  /* The optional answers, behind one row (#483). */
  extrasOpen: 'Note or expiry',
  extrasClose: 'Done',
  extrasEmpty: 'Add a note or an expiry',
  expiryLabel: 'Expires',
  expiryOptions: [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: null, label: 'Never' },
  ] as const,
  submit: 'Create claim',
  saving: 'Creating',
  /* The result. */
  resultTitle: 'Claim ready',
  resultBody: (amount: string, name: string): string => `${amount} to ${name}, once it is paid.`,
  copy: 'Copy link',
  copied: 'Copied',
  share: 'Share',
  another: 'Claim something else',
  /* States. */
  signedOutTitle: 'Sign in to ask for money',
  signedOutBody: 'A link is created against your account, so it needs one.',
  noHandleTitle: 'Claim a name first',
  noHandleBody: 'An ask is paid to your name. Claim one on Receive and come back.',
  errorTitle: "Couldn't create the link",
} as const;

/**
 * Refusal codes, in the caller's terms.
 *
 * The server answers with a code and never prose, because a surface owns its sentences. These are the
 * ones a person can actually hit from this screen; anything else falls back to the server's own words,
 * which is better than inventing a message for a condition nobody anticipated.
 */
export const ASK_REFUSALS: Record<string, string> = {
  'amount-invalid': 'Enter an amount above zero, with at most two decimals.',
  'destination-not-found': 'That name could not be found. Check it and try again.',
  'destination-not-yours': 'A claim is paid to your own name. Pick one of yours.',
  'expiry-invalid': 'Pick an expiry between one day and a year.',
  'currency-invalid': 'An ask has to be in KES.',
};

/** The default window: what the service defaults to, named here so the chips and the server agree. */
export const ASK_DEFAULT_EXPIRY_DAYS = 30;

/**
 * The amount's shape, restated from the service (#513).
 *
 * `REQUEST_AMOUNT_PATTERN` and `isValidRequestAmount` in `backend/src/services/requests.ts` are the
 * authority. This is the same rule on the client for one reason: the ask used to get it for free
 * from the keypad's `applyKey`, and with the grid gone a typed value is the only way in. A submit
 * the server would refuse should not be offered, and a disabled button should say why, so the
 * sentence is `ASK_REFUSALS['amount-invalid']` rather than a second wording of the same rule.
 *
 * Matched, not parsed, for the reason the service gives: `Number('1e9')` is a valid number and a
 * different amount from the one a payer will read.
 */
export const ASK_AMOUNT_PATTERN = /^[0-9]{1,9}(\.[0-9]{1,2})?$/;

export function isValidAskAmount(amount: string): boolean {
  const trimmed = amount.trim();
  if (!ASK_AMOUNT_PATTERN.test(trimmed)) return false;
  return Number(trimmed) > 0;
}
