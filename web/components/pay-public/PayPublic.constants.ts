/**
 * Copy for the public PAY page — the page a `seti.live/pay/<id>` link opens.
 *
 * The rules this copy follows, in order of what the payer needs:
 *
 *  - **The amount first, in their currency.** A payment request that leads with
 *    brand or process is a page someone closes.
 *  - **Who, in words they can check.** A name, whether it was checked, and the
 *    address underneath it. Never a name alone.
 *  - **The fee before anything is signed.** Seti's 2% is added to what the payer
 *    sends; it is never taken out of what the recipient receives, and it is never
 *    mentioned for the first time on a receipt.
 *  - **No product vocabulary.** No asset names, no "settlement", no "non-custodial".
 *    That last idea is said in one plain sentence (`custody`) and it is the one line
 *    that must survive any edit here.
 */
export const PAY_COPY = {
  brand: 'Seti',
  /** The word above the amount. */
  eyebrow: 'Payment request',
  /** The word above the recipient. */
  payeeEyebrow: 'Paying',
  /** The custody sentence — the promise the whole page rests on. */
  custody: 'The money goes straight to the recipient’s own wallet — Seti never holds it.',
  /** Fee row label; the percentage is appended where it is drawn, from the constant. */
  feeLabel: 'Platform fee',
  amountRowLabel: 'To the recipient',
  totalRowLabel: 'Total you pay',
  /** The caption above a code, and the label on the link a person can copy instead. */
  scanCaption: 'Scan this code with the Seti app',
  uriCaption: 'Or open this link in Seti',
  /** The action on a paid charge. */
  receipt: 'View receipt',
  /** The way back to the product, from a refusal or a dead link. */
  goToApp: 'Go to Seti',
  /** A re-read of a charge whose state can still change: a plain link, so it works with JS off. */
  again: 'Check again',
  /** The three recipient states, and the one line each carries. */
  verified: 'Name verified',
  unverified: 'Name not verified',
  noName: 'Not a Seti name',
  unverifiedNote: 'Seti has not checked this name. The address below is where the money goes.',
  noNameNote: 'This address has no Seti name. Check it with the person who sent the link.',
  /** The refusal. Never softened, and never a payment prompt. */
  refusedTitle: 'This request is not valid',
  refusedBody:
    'The details on this link do not match what Seti signed, so it cannot be paid. Nothing has been charged.',
  refusedNext: 'Ask the person who sent it to open Seti and send a new request.',
} as const;

/** The one label per state. Colour never carries the state on its own. */
export const STATUS_LABEL = {
  pending: 'Waiting for payment',
  paid: 'Paid',
  underpaid: 'Partly paid',
  overpaid: 'Overpaid',
  expired: 'Expired',
} as const;

/** The badge each state wears — a role, paired with the label above. */
export const STATUS_BADGE = {
  pending: 'neutral',
  paid: 'success',
  underpaid: 'warning',
  overpaid: 'warning',
  expired: 'danger',
} as const;

/**
 * A link on a white band. The same recipe as the public receipt's one action, kept
 * local so neither page owns the other's styling.
 */
export const PAY_LINK_CLASS =
  'inline-flex rounded-sm text-body-sm font-semibold text-link hover:underline ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light';

/** One hairline between sections inside the card. Never a filled band. */
export const PAY_DIVIDER_CLASS = 'border-t border-hairline-light';
