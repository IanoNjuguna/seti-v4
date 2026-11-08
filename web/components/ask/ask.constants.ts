/**
 * Everything the ask screen says, in one place (#465).
 *
 * The rules the copy follows: second person, no jargon, and never a promise the record cannot keep.
 * That last one is why nothing here says "one payment settles this": an ask can be paid once today,
 * and whether it can be paid twice is #449, still undecided.
 */
export const ASK_COPY = {
  title: 'Ask for money',
  subtitle: 'Send a link with the amount in it. They pay it with any Seti link, or by scanning your QR.',
  amountLabel: 'Amount',
  amountPlaceholder: '0.00',
  keypadLabel: 'Amount keypad',
  memoLabel: 'What is it for',
  memoPlaceholder: 'Rent, half the taxi, the haircut',
  payeeLabel: 'Paid to',
  expiryLabel: 'Expires',
  expiryOptions: [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: null, label: 'Never' },
  ] as const,
  submit: 'Create link',
  saving: 'Creating',
  /* The result. */
  resultTitle: 'Link ready',
  resultBody: (amount: string, name: string): string => `${amount} from ${name}, once it is paid.`,
  copy: 'Copy link',
  copied: 'Copied',
  share: 'Share',
  another: 'Ask for something else',
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
  'destination-not-yours': 'You cannot ask yourself for money.',
  'expiry-invalid': 'Pick an expiry between one day and a year.',
  'currency-invalid': 'An ask has to be in KES.',
};

/** The default window: what the service defaults to, named here so the chips and the server agree. */
export const ASK_DEFAULT_EXPIRY_DAYS = 30;
