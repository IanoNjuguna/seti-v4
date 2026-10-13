/**
 * Copy for the public PERSON page — the page a `seti.live/u/<handle>` link opens.
 *
 * Deliberately not a merchant page: no till language, no "pay". A customer landing
 * here from a chat message should know within a line that this is a person they
 * are about to send money to and where it goes.
 */
export const PERSON_COPY = {
  brand: 'Seti',
  /** The eyebrow above the name. Plain, additive, no product jargon. */
  eyebrow: 'Send money',
  /** The one action. Not "Pay" — a person is sent money, a shop is paid. */
  send: 'Send',
  signInNote: 'You’ll sign in to Seti to send.',
  moneyNote: 'The money goes straight to their wallet — Seti never holds it.',
  verified: 'Name verified',
  unverified: 'Name not verified',
  noAddress: 'This handle has no address yet, so it cannot be sent to.',
} as const;

/**
 * The send action as a black pill — the `button-dark` recipe from
 * `design/revolut.md`, whose only CTA on a white band is black. The same recipe
 * the business page's Pay action uses, kept local so neither page owns the other's
 * styling.
 */
export const SEND_ACTION_CLASS =
  'bg-canvas-dark text-on-dark hover:bg-charcoal rounded-full min-touch h-12 w-full px-7 ' +
  'inline-flex items-center justify-center text-button font-semibold transition-colors ' +
  'duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary focus-visible:ring-offset-2';
