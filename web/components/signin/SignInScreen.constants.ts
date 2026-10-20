/**
 * Every word the sign-in page renders, and the mark it draws.
 *
 * The page is the product's front door and it says only what it is: what to do
 * (sign in with your email), how it works (no password; a code arrives), and the
 * documents the account is opened against. No category claim ("a bank", "a
 * neobank") — the first is a licensed word in this market and the second is
 * internal shorthand — and no crypto vocabulary: "sign in" is the only verb for
 * asking.
 *
 * The h1 is the INSTRUCTION rather than a promise, and that is deliberate. The
 * promise belongs to the landing page that sent the visitor here, and a second copy
 * of it on this page was one sentence said twice on the way in — so it is gone, and
 * what is left standing at heading level is the thing the page actually asks for.
 * The h1 is display type because it is the page's one heading, and the lede carries
 * the single mechanic a visitor needs before typing (a code is emailed; there is no
 * password).
 */
/**
 * The front door wears the FRIENDLY mark: this is the one screen in the product
 * whose whole job is to welcome someone, so it is the expressive face's first
 * and clearest home. Drawn by `<BrandMark expression="friendly" canvas="dark" />`
 * at the call site, on the dark canvas this page already paints.
 */

export const SIGN_IN_COPY = {
  /** The page's one heading: the instruction, in the customer's own words. */
  title: 'Sign in with your email.',
  /** The mechanic, said once — no password, and the code arrives by email. */
  lede: 'No password. We email you a code.',
  emailLabel: 'Email',
  submit: 'Continue with email',
  errorTitle: 'Could not sign in',
  /** The shared with the app sentence for Google, and the divider above the email form. */
  google: 'Continue with Google',
  /** Says what the field below is FOR, so the two doors do not read as a choice of equals. */
  orEmail: 'or use your email',
  /** Shared with the app: the same "we are still finding out" line it renders. */
  restoring: 'One moment…',
  /**
   * The footnote at the foot of the column.
   *
   * Not a marketing line and not a second promise: it is the one thing a person handing
   * over money should know before they type an address, said in the product's own
   * words. "Not a bank" is deliberate — `bank` is a licensed word in this market and
   * this product is not one.
   */
  footnote: 'Seti is not a bank. Your money is held in stablecoins you control.',
} as const;

export const SIGN_IN_SENT_COPY = {
  title: 'Check your email',
  bodyPrefix: 'We sent a sign-in code to',
  bodySuffix: 'Enter it below to sign in.',
  codeLabel: 'Code',
  submit: 'Sign in',
  deliverabilityLead: 'Nothing in your inbox? Check your spam folder, then',
  resend: 'send a new code',
  /** While a new code is on its way. Says why the control is not tappable. */
  resending: 'sending a new code…',
  deliverabilityMiddle: '. Wrong email?',
  useAnother: 'Use a different email',
  deliverabilityTail: '.',
} as const;

/**
 * The dev-source note, and the way to see the sent screen on a build that has no
 * Privy app id to send anything with.
 *
 * A local build is not the product path and a screenshot of it should never be
 * mistaken for one, so this page names the dev source on screen. Its dev source
 * signs in on the first press, so without the preview control below the sent
 * screen could not be looked at at all on a local build.
 */
export const SIGN_IN_DEV_COPY = {
  note: 'Local build. Privy is not configured, so this signs you in directly.',
  preview: 'Preview the sent screen',
} as const;

/**
 * A secondary action drawn as a link, on the dark canvas.
 *
 * No cobalt: `design/revolut.md` steps inline links on the dark canvas up to
 * weight 700 and leaves the accent out, because the cobalt accent does not hold
 * contrast on black. Underlined, so the affordance is not colour-only.
 */
const LINK_BASE =
  'inline rounded-sm bg-transparent p-0 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark';

/** Hover is the pointer state; these two `active` utilities are the PRESS,
 *  answered on pointer-down and emitted after `hover:` by Tailwind's variant order. */
export const SIGN_IN_LINK_CLASSES = `${LINK_BASE} text-on-dark transition-colors duration-(--duration-quick) ease-out hover:text-on-dark-mute active:text-on-dark-mute active:underline-offset-2`;

/** The same control mid-action: still legible, visibly not available. */
export const SIGN_IN_LINK_BUSY_CLASSES = `${LINK_BASE} cursor-wait text-on-dark-mute`;
