/**
 * Copy for the public merchant page — the page a `seti.live/m/<handle>` link
 * opens. Plain and specific: a stranger landing here from a sticker should know
 * within a line who they are paying and what happens next.
 */
export const PUBLIC_COPY = {
  brand: 'Seti',
  eyebrow: 'Pay with Seti',
  pay: 'Pay',
  signInNote: 'You’ll sign in to Seti to pay.',
  moneyNote: 'The money goes straight to their wallet.',
  verified: 'Name verified',
  unverified: 'Name not verified',
  noAddress: 'This merchant has no payout address yet, so it cannot be paid.',
} as const;

/**
 * The pay action as a black button — the `button-dark` recipe from
 * `design/revolut.md`, whose only CTA on a white band is black.
 *
 * Written as classes on a `next/link` rather than composing `Button` inside a
 * `<Link>`: a button nested in an anchor is invalid HTML, and the href on the
 * anchor is also the honest thing to verify ("where does Pay go?"). The recipe
 * matches `components/ui/Button.constants.ts` → `primary`.
 */
export const PAY_ACTION_CLASS =
  'bg-canvas-dark text-on-dark hover:bg-charcoal rounded-md min-touch h-12 w-full px-7 ' +
  'inline-flex items-center justify-center text-button font-semibold transition-colors ' +
  'duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary focus-visible:ring-offset-2';
