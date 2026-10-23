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
  /**
   * The two tiers (#154). A merchant Seti has reviewed, and everyone else.
   *
   * The verified sentences are claims about OUR ACTION — we checked the name and the
   * address it pays to — and never about the money: reviewing a merchant does not mean
   * Seti holds it, pays it, or guarantees it. The unverified sentence is the agreed line
   * the issue names, kept verbatim, because it is the one a payer reads when a link has
   * been forwarded to them by someone they do not know.
   */
  verifiedBadge: 'Verified merchant',
  verifiedNote: 'Seti has checked this merchant’s name and the address above. Both are the merchant’s own.',
  unverifiedBadge: 'Not verified',
  unverifiedNote: 'The recipient is not verified with Seti. The address above is where the money goes.',
  /**
   * What Seti did, on BOTH tiers: rendered this request, and once the money arrives,
   * checked the transfer. It never says who the recipient is, which is why it can sit
   * under a stranger's address without endorsing it.
   */
  facilitatedBy: 'Payment facilitated by Seti',
  /** The charge id's label beside the facilitated-by line. The shop can quote this back. */
  requestLabel: 'Request',
  /**
   * The note under the unverified mark. "Above" is where the address is drawn: the
   * heading and the address both sit over the note, and "below" once sent a payer
   * looking for an address that was never there.
   */
  noNameNote: 'This address has no Seti name. Check it with the person who sent the link.',
  /**
   * The way out of an unverified name, on the page where money is at stake.
   *
   * `#148` removed the held-brand queue, so a name goes live and payable the moment
   * it verifies. That makes this link the only recourse a payer has, and it is why it
   * sits under the badge rather than in a policy page nobody opens. The subject
   * carries the handle, so a report arrives already naming what it is about, and the
   * address is the published channel in `docs/brand-policy.md`.
   */
  reportName: 'Report this name',
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

/**
 * The address a name report goes to, published once so the page and the policy
 * cannot disagree about where a report lands (`docs/brand-policy.md`, §4).
 */
export const TAKEDOWN_EMAIL = 'hey@seti.live';

/**
 * The payer's three states (#153): what the page owes someone who is not the Seti
 * app's user, and who may have no wallet and no dollars at all.
 *
 * The rules this copy follows:
 *
 *  - **Say what paying needs, first.** One line, in every state, because it answers
 *    the question a stranger arrives with. It never promises an on-ramp: there is no
 *    card, no bank transfer and no way to buy dollars on this page in v1.
 *  - **"You said", not "we detected".** The state is a declaration in the URL, and
 *    copy that pretended otherwise would be claiming a fact about someone's wallet
 *    this page has never seen.
 *  - **No state is a dead end.** The payer with no wallet is given what to do instead
 *    and a way back to the request if they get one. They are never shown a payment
 *    prompt they cannot use.
 *  - **The amount is the total.** Everything a payer copies or is asked for is what
 *    leaves their wallet, fee included, so nobody underpays the 2% by accident.
 */
export const PAYER_COPY = {
  /** The heading over everything that answers "can I pay this, and how". */
  section: 'How to pay',
  /**
   * The one line stating what this request needs before anyone can pay it, drawn in
   * all three states. The network sentence is the half that stops a payer sending on
   * the wrong one; the second half is the answer to "can Seti just take my card".
   */
  need:
    'To pay this, your wallet needs dollars on the same network as the person you are paying. ' +
    'Seti does not sell dollars. Nothing here takes a card or a bank transfer.',

  /** A wallet with no dollars in it: the fact, then the only two things to do next. */
  emptyLine: 'You said your wallet has no dollars in it, so it cannot send this yet.',
  emptyNext: 'Send dollars to your wallet, then open this link again.',
  emptyOther: 'A different coin, or dollars on another network, cannot pay this.',
  /** When a deadline exists it is the charge's own, printed in the page's one date format. */
  stayOpen: (day: string | null) =>
    day === null ? 'This request has no deadline.' : `This request stays open until ${day}.`,
  backToPaying: 'I have dollars now',

  /**
   * No wallet at all. There is no payment prompt in this state, so there is nothing
   * to try: the instruction is who to ask, and the only promise is that the link
   * survives. Wallet creation is out of scope for #153, so it is not offered here.
   */
  noneLine: 'You said you do not have a wallet that holds dollars, so there is nothing here you can pay with.',
  noneNext: 'Ask the person who sent this link for another way to pay.',
  noneKeep: (day: string | null) =>
    day === null
      ? 'If you get a wallet, this link still works.'
      : `If you get a wallet before ${day}, this link still works.`,
  backFromNone: 'I do have a wallet',

  /** The request itself, for a wallet other than the browser reading the page. */
  diyTitle: 'Pay from another wallet',
  diyLead:
    'Send the amount below to this address from any wallet that holds dollars. ' +
    'It includes the 2% fee.',
  addressLabel: 'Address',
  amountLabel: 'Amount to send',
  referenceLabel: 'Reference',
  copyAddress: 'Copy the address',
  copyAmount: 'Copy the amount to send',
  copyReference: 'Copy the reference',
  copyFailed: 'Could not copy. Select it and copy it by hand.',
  copied: 'Copied',

  /** The two answers that are not "I can pay", offered as links on every paying state. */
  switchEmpty: 'No dollars in your wallet?',
  switchNone: 'No wallet at all?',
} as const;

/**
 * The mailto a payer opens from the unverified state.
 *
 * The handle goes in the SUBJECT, not the body: a report has to name its subject
 * before it is read, and a body would be discarded by whoever forwards it. Nothing
 * else is pre-filled, because a payer reporting a name knows why and Seti does not.
 */
export function reportNameMailto(handle: string): string {
  return `mailto:${TAKEDOWN_EMAIL}?subject=${encodeURIComponent(`Report the Seti name @${handle}`)}`;
}
